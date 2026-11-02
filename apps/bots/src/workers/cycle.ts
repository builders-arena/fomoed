import {
  buildClaimPositionFeeTx,
  deriveMigratedPoolAddress,
  getConnection,
  getCpAmm,
  getPartnerPosition,
  loadWallets,
  splitPartnerClaim,
} from '@float/core';
import { prisma } from '@float/db';
import { MigrationFeeOption, U64_MAX } from '@meteora-ag/dynamic-bonding-curve-sdk';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { PublicKey, Transaction, type Keypair } from '@solana/web3.js';
import { botConfig } from '../config.js';
import { creditFlagship, creditHolders, creditTraders, isQuotePaused } from '../ledger.js';
import {
  airdropWallet,
  ataBalance,
  buybackWallet,
  dbcClient,
  log,
  mintDecimals,
  payoutWallet,
  tokenProgramForMint,
} from '../shared.js';
import { sendTx } from '../tx.js';

const CREATED_POOL = 3;

export interface CycleOptions {
  onlyPool?: string;
}

/** Claim fees for eligible coins and split them into the ledger buckets. */
export async function runCycle(opts: CycleOptions = {}): Promise<void> {
  const cfg = botConfig();
  const wallets = loadWallets();
  if (!wallets.feeClaimerSigner) {
    log.warn('cycle: FEE_CLAIMER_ADDRESS is external (no local key) — cannot claim; skipping');
    return;
  }
  const feeClaimer = wallets.feeClaimerSigner;
  const connection = getConnection();
  const dbc = dbcClient();

  const coins = opts.onlyPool
    ? await prisma.coin.findMany({ where: { pool: opts.onlyPool } })
    : await prisma.coin.findMany();

  for (const coin of coins) {
    try {
      if (await isQuotePaused(coin.quoteMint)) continue;

      const quoteMint = new PublicKey(coin.quoteMint);
      const metrics = await dbc.state.getPoolFeeMetrics(coin.pool).catch(() => null);
      const accrued = metrics ? BigInt(metrics.current.partnerQuoteFee.toString()) : 0n;
      const migrated = coin.migrationState >= CREATED_POOL;
      if (!migrated && accrued < cfg.CYCLE_MIN_FEE) continue;

      const tokenProgram = await tokenProgramForMint(connection, quoteMint);
      const balanceBefore = await ataBalance(connection, quoteMint, feeClaimer.publicKey, tokenProgram);

      const claimTx = await buildClaimTx(coin, feeClaimer, wallets.admin.publicKey);
      if (!claimTx) continue;

      const signers: Keypair[] = feeClaimer.publicKey.equals(wallets.admin.publicKey)
        ? [wallets.admin]
        : [wallets.admin, feeClaimer];

      const res = await sendTx({
        connection,
        transaction: claimTx,
        signers,
        feePayer: wallets.admin.publicKey,
        bot: 'cycle',
        action: 'claim',
        pool: coin.pool,
        mint: coin.quoteMint,
      });

      if (res.status !== 'CONFIRMED' || !res.signature) {
        // DRY_RUN or skipped: log the would-be split from accrued metrics.
        const est = splitPartnerClaim(accrued);
        log.info({ pool: coin.pool, accrued: accrued.toString(), est }, 'cycle: simulated claim');
        continue;
      }

      const balanceAfter = await ataBalance(connection, quoteMint, feeClaimer.publicKey, tokenProgram);
      const claimed = balanceAfter - balanceBefore;
      if (claimed <= 0n) {
        log.warn({ pool: coin.pool }, 'cycle: claim confirmed but no quote delta');
        continue;
      }

      const split = splitPartnerClaim(claimed);

      // Physically fan the claimed quote out to the destination wallets, so the
      // ledger accounting matches where the tokens actually sit.
      await fanOut(coin, quoteMint, tokenProgram, feeClaimer, wallets, split, res.signature);

      // Ledger accounting (treasury is paid directly, so it has no pool).
      await creditHolders(coin.pool, coin.quoteMint, split.holders);
      await creditFlagship(coin.quoteMint, split.flagship);
      await creditTraders(coin.quoteMint, split.traders);

      // Record the claim (unique on claimTx → idempotent).
      await prisma.feeClaim.upsert({
        where: { claimTx: res.signature },
        create: {
          claimTx: res.signature,
          pool: coin.pool,
          mint: coin.quoteMint,
          totalClaimed: claimed,
          holdersAmount: split.holders,
          creatorAmount: 0n, // creator paid on-chain via creatorTradingFeePercentage
          flagshipAmount: split.flagship,
          tradersAmount: split.traders,
          treasuryAmount: split.treasury,
        },
        update: {},
      });

      log.info({ pool: coin.pool, claimed: claimed.toString(), split }, 'cycle: claimed and split');
    } catch (err) {
      log.error({ err, pool: coin.pool }, 'cycle: coin failed');
    }
  }
}

async function buildClaimTx(
  coin: { pool: string; baseMint: string; quoteMint: string; migrationState: number; dammPool: string | null },
  feeClaimer: Keypair,
  payer: PublicKey,
): Promise<Transaction | null> {
  const dbc = dbcClient();
  if (coin.migrationState >= CREATED_POOL) {
    const cpAmm = getCpAmm();
    const dammPool = coin.dammPool
      ? new PublicKey(coin.dammPool)
      : deriveMigratedPoolAddress(
          new PublicKey(coin.baseMint),
          new PublicKey(coin.quoteMint),
          MigrationFeeOption.Customizable,
        );
    const partner = await getPartnerPosition(cpAmm, dammPool);
    if (!partner) return null;
    return buildClaimPositionFeeTx(cpAmm, {
      pool: dammPool,
      position: partner.position,
      positionNftAccount: partner.positionNftAccount,
      owner: feeClaimer.publicKey,
      feePayer: payer,
    });
  }
  return dbc.partner.claimPartnerTradingFee({
    feeClaimer: feeClaimer.publicKey,
    payer,
    pool: new PublicKey(coin.pool),
    maxBaseAmount: U64_MAX,
    maxQuoteAmount: U64_MAX,
  });
}

/** Distribute the four split shares from fee_claimer to their wallets in one tx. */
async function fanOut(
  coin: { pool: string },
  quoteMint: PublicKey,
  tokenProgram: PublicKey,
  feeClaimer: Keypair,
  wallets: ReturnType<typeof loadWallets>,
  split: { holders: bigint; flagship: bigint; traders: bigint; treasury: bigint },
  claimSig: string,
): Promise<void> {
  const connection = getConnection();
  const decimals = await mintDecimals(connection, quoteMint);
  const fromAta = getAssociatedTokenAddressSync(quoteMint, feeClaimer.publicKey, true, tokenProgram);

  const destinations: Array<{ owner: PublicKey; amount: bigint }> = [
    { owner: payoutWallet().publicKey, amount: split.holders },
    { owner: buybackWallet().publicKey, amount: split.flagship },
    { owner: airdropWallet().publicKey, amount: split.traders },
    { owner: wallets.treasury, amount: split.treasury },
  ];

  const tx = new Transaction();
  for (const d of destinations) {
    if (d.amount <= 0n) continue;
    const toAta = getAssociatedTokenAddressSync(quoteMint, d.owner, true, tokenProgram);
    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        wallets.admin.publicKey,
        toAta,
        d.owner,
        quoteMint,
        tokenProgram,
      ),
      createTransferCheckedInstruction(
        fromAta,
        quoteMint,
        toAta,
        feeClaimer.publicKey,
        d.amount,
        decimals,
        [],
        tokenProgram,
      ),
    );
  }
  if (tx.instructions.length === 0) return;

  const signers: Keypair[] = feeClaimer.publicKey.equals(wallets.admin.publicKey)
    ? [wallets.admin]
    : [wallets.admin, feeClaimer];

  await sendTx({
    connection,
    transaction: tx,
    signers,
    feePayer: wallets.admin.publicKey,
    bot: 'cycle',
    action: 'fan-out',
    pool: coin.pool,
    mint: quoteMint.toBase58(),
    idemKey: `fanout:${claimSig}`,
  });
}
