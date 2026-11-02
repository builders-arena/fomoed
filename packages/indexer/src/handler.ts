import { Prisma, prisma, SwapSide, SwapVenue } from '@float/db';
import { parseEventsFromLogs } from './parser.js';
import { resolveAmounts } from './swapMapping.js';

/** A transaction normalized from a webhook payload or an RPC fetch. */
export interface IndexedTx {
  signature: string;
  slot: number;
  blockTime: number | null;
  logs: string[];
  /** Trader wallet — the fee payer / first signer. */
  feePayer: string;
}

/** migrationProgress once the bonding curve completes (pre-migration). The
 * migrator bot advances the state to CreatedPool (3) after migrateToDammV2. */
const POST_BONDING = 1;

/** Index one transaction. Returns the number of new swap rows written. */
export async function handleTransaction(tx: IndexedTx): Promise<number> {
  const events = parseEventsFromLogs(tx.logs);
  if (events.length === 0) return 0;

  const ts = new Date((tx.blockTime ?? Math.floor(Date.now() / 1000)) * 1000);
  let written = 0;

  for (const ev of events) {
    if (ev.kind === 'curveComplete') {
      await prisma.coin.updateMany({
        where: { pool: ev.pool, migrationState: { lt: POST_BONDING } },
        data: { migrationState: POST_BONDING },
      });
      continue;
    }

    if (ev.kind === 'initPool') {
      // Coins are registered by launch.ts before their events arrive; only
      // backfill lifecycle pointers if the row already exists.
      await prisma.coin.updateMany({
        where: { pool: ev.pool },
        data: { config: ev.config, creator: ev.creator, baseMint: ev.baseMint },
      });
      continue;
    }

    // Swap: resolve the coin (by pool for DBC, by damm_pool for DAMM).
    const coin =
      ev.venue === 'DBC'
        ? await prisma.coin.findUnique({ where: { pool: ev.pool } })
        : await prisma.coin.findFirst({ where: { dammPool: ev.pool } });
    if (!coin) continue; // not one of our pools

    const { side, baseAmount, quoteAmount } = resolveAmounts(ev, coin);
    const feeAmount = ev.tradingFee + ev.protocolFee + ev.referralFee;
    const baseDelta = side === SwapSide.Buy ? baseAmount : -baseAmount;

    const created = await writeSwapIdempotent({
      sig: tx.signature,
      eventIndex: ev.eventIndex,
      slot: BigInt(tx.slot),
      ts,
      pool: coin.pool,
      wallet: tx.feePayer,
      side,
      venue: ev.venue === 'DBC' ? SwapVenue.DBC : SwapVenue.DAMM,
      baseAmount,
      quoteAmount,
      feeAmount,
      referral: ev.hasReferral,
      coinPool: coin.pool,
      baseDelta,
    });
    if (created) written++;
  }

  return written;
}

interface SwapWrite {
  sig: string;
  eventIndex: number;
  slot: bigint;
  ts: Date;
  pool: string;
  wallet: string;
  side: SwapSide;
  venue: SwapVenue;
  baseAmount: bigint;
  quoteAmount: bigint;
  feeAmount: bigint;
  referral: boolean;
  coinPool: string;
  baseDelta: bigint;
}

/**
 * Create the swap row and apply the holder delta atomically. A duplicate
 * delivery hits the (sig, eventIndex) unique constraint and is skipped, so
 * holder balances are never double-counted.
 */
async function writeSwapIdempotent(w: SwapWrite): Promise<boolean> {
  try {
    await prisma.$transaction([
      prisma.swap.create({
        data: {
          sig: w.sig,
          eventIndex: w.eventIndex,
          slot: w.slot,
          ts: w.ts,
          pool: w.pool,
          wallet: w.wallet,
          side: w.side,
          venue: w.venue,
          baseAmount: w.baseAmount,
          quoteAmount: w.quoteAmount,
          feeAmount: w.feeAmount,
          referral: w.referral,
        },
      }),
      prisma.holder.upsert({
        where: { coin_wallet: { coin: w.coinPool, wallet: w.wallet } },
        create: {
          coin: w.coinPool,
          wallet: w.wallet,
          balance: w.baseDelta,
          updatedSlot: w.slot,
        },
        update: {
          balance: { increment: w.baseDelta },
          updatedSlot: w.slot,
        },
      }),
    ]);
    return true;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return false; // already indexed
    }
    throw err;
  }
}
