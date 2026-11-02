import { getConnection, loadWallets } from '@float/core';
import { prisma } from '@float/db';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { PublicKey, Transaction } from '@solana/web3.js';
import { botConfig, isDryRun } from '../config.js';
import { usdValue } from '../feeds.js';
import { debitHolders, isQuotePaused } from '../ledger.js';
import {
  airdropWallet,
  buybackWallet,
  dbcClient,
  log,
  mintDecimals,
  payoutWallet,
  tokenProgramForMint,
} from '../shared.js';
import { sendTx } from '../tx.js';

export interface PayoutOptions {
  onlyPool?: string;
}

/** Pay holders their pro-rata share of a coin's holders_pool, in the quote token. */
export async function runPayout(opts: PayoutOptions = {}): Promise<void> {
  const cfg = botConfig();
  const connection = getConnection();
  const wallets = loadWallets();
  const payout = payoutWallet();

  const coins = opts.onlyPool
    ? await prisma.coin.findMany({ where: { pool: opts.onlyPool } })
    : await prisma.coin.findMany();

  for (const coin of coins) {
    try {
      if (await isQuotePaused(coin.quoteMint)) continue;

      const pool = await prisma.holdersPool.findUnique({
        where: { coin_mint: { coin: coin.pool, mint: coin.quoteMint } },
      });
      const pending = pool?.amount ?? 0n;
      if (pending <= 0n) continue;

      const quoteMint = new PublicKey(coin.quoteMint);
      const tokenProgram = await tokenProgramForMint(connection, quoteMint);
      const decimals = await mintDecimals(connection, quoteMint);

      // Exclude program/bot accounts from the holder set.
      const denylist = await buildDenylist(coin, wallets, payout.publicKey);
      const holders = (
        await prisma.holder.findMany({ where: { coin: coin.pool, balance: { gt: 0n } } })
      ).filter((h) => !denylist.has(h.wallet));

      const totalBalance = holders.reduce((s, h) => s + h.balance, 0n);
      if (totalBalance <= 0n) continue;

      // Compute owed, keeping only wallets above the dust floor (others carry forward).
      const payees: Array<{ wallet: string; amount: bigint }> = [];
      for (const h of holders) {
        const owed = (pending * h.balance) / totalBalance;
        if (owed <= 0n) continue;
        const usd = await usdValue(coin.quoteMint, owed, decimals);
        if (usd !== null && usd < cfg.PAYOUT_MIN_USD) continue; // carry forward
        payees.push({ wallet: h.wallet, amount: owed });
      }
      if (payees.length === 0) continue;

      const totalPaid = payees.reduce((s, p) => s + p.amount, 0n);
      const round = await prisma.payoutRound.create({
        data: { coin: coin.pool, mint: coin.quoteMint, totalAmount: totalPaid, status: 'pending' },
      });
      await prisma.payout.createMany({
        data: payees.map((p) => ({
          roundId: round.id,
          coin: coin.pool,
          wallet: p.wallet,
          mint: coin.quoteMint,
          amount: p.amount,
          status: 'pending',
        })),
      });

      const fromAta = getAssociatedTokenAddressSync(quoteMint, payout.publicKey, true, tokenProgram);
      let allConfirmed = true;

      for (let i = 0; i < payees.length; i += cfg.PAYOUT_BATCH) {
        const batch = payees.slice(i, i + cfg.PAYOUT_BATCH);
        const tx = new Transaction();
        for (const p of batch) {
          const owner = new PublicKey(p.wallet);
          const toAta = getAssociatedTokenAddressSync(quoteMint, owner, true, tokenProgram);
          tx.add(
            createAssociatedTokenAccountIdempotentInstruction(
              payout.publicKey,
              toAta,
              owner,
              quoteMint,
              tokenProgram,
            ),
            createTransferCheckedInstruction(
              fromAta,
              quoteMint,
              toAta,
              payout.publicKey,
              p.amount,
              decimals,
              [],
              tokenProgram,
            ),
          );
        }

        const res = await sendTx({
          connection,
          transaction: tx,
          signers: [payout],
          feePayer: payout.publicKey,
          bot: 'payout',
          action: 'payout-batch',
          pool: coin.pool,
          mint: coin.quoteMint,
          idemKey: `payout:${round.id}:batch${i / cfg.PAYOUT_BATCH}`,
        });

        if (res.status === 'CONFIRMED') {
          await prisma.payout.updateMany({
            where: { roundId: round.id, wallet: { in: batch.map((b) => b.wallet) } },
            data: { status: 'sent', tx: res.signature },
          });
        } else {
          allConfirmed = false;
        }
      }

      if (allConfirmed && !isDryRun()) {
        await debitHolders(coin.pool, coin.quoteMint, totalPaid);
        await prisma.payoutRound.update({ where: { id: round.id }, data: { status: 'sent' } });
      }
      log.info(
        { pool: coin.pool, payees: payees.length, totalPaid: totalPaid.toString() },
        'payout: round processed',
      );
    } catch (err) {
      log.error({ err, pool: coin.pool }, 'payout: coin failed');
    }
  }
}

async function buildDenylist(
  coin: { pool: string; dammPool: string | null },
  wallets: ReturnType<typeof loadWallets>,
  payoutPubkey: PublicKey,
): Promise<Set<string>> {
  const set = new Set<string>([
    coin.pool,
    wallets.feeClaimer.toBase58(),
    wallets.treasury.toBase58(),
    wallets.admin.publicKey.toBase58(),
    payoutPubkey.toBase58(),
    buybackWallet().publicKey.toBase58(),
    airdropWallet().publicKey.toBase58(),
  ]);
  if (coin.dammPool) set.add(coin.dammPool);
  const vp = await dbcClient().state.getPool(coin.pool).catch(() => null);
  if (vp) {
    set.add(vp.poolState.baseVault.toBase58());
    set.add(vp.poolState.quoteVault.toBase58());
  }
  return set;
}
