import {
  getConnection,
  isMainnet,
  loadWallets,
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
} from '@float/core';
import { prisma } from '@float/db';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { PublicKey, Transaction } from '@solana/web3.js';
import { botConfig, isDryRun } from '../config.js';
import { getQuote, getSwapTx, priceImpactBps } from '../jupiter.js';
import { debitTraders } from '../ledger.js';
import {
  airdropWallet,
  ataBalance,
  buybackWallet,
  log,
  mintDecimals,
  payoutWallet,
  tokenProgramForMint,
} from '../shared.js';
import { sendTx, sendVersionedTx } from '../tx.js';

function usdcMint(): PublicKey {
  return isMainnet() ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;
}

/**
 * Build an airdrop round from trading volume over a window. Writes shares with
 * status `pending_review`; an admin must approve before `runAirdropSend`.
 */
export async function runAirdropSnapshot(windowHours = 24): Promise<string | null> {
  const cfg = botConfig();
  const wallets = loadWallets();
  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - windowHours * 60 * 60_000);

  const swaps = await prisma.swap.findMany({
    where: { ts: { gte: windowStart, lte: windowEnd } },
    select: { wallet: true, quoteAmount: true, ts: true },
  });
  if (swaps.length === 0) return null;

  const denylist = new Set<string>([
    wallets.feeClaimer.toBase58(),
    wallets.treasury.toBase58(),
    wallets.admin.publicKey.toBase58(),
    payoutWallet().publicKey.toBase58(),
    buybackWallet().publicKey.toBase58(),
    airdropWallet().publicKey.toBase58(),
  ]);

  // Volume + per-hour swap counts per wallet.
  const volume = new Map<string, bigint>();
  const hourly = new Map<string, Map<number, number>>();
  for (const s of swaps) {
    if (denylist.has(s.wallet)) continue;
    volume.set(s.wallet, (volume.get(s.wallet) ?? 0n) + s.quoteAmount);
    const hour = Math.floor(s.ts.getTime() / 3_600_000);
    const m = hourly.get(s.wallet) ?? new Map<number, number>();
    m.set(hour, (m.get(hour) ?? 0) + 1);
    hourly.set(s.wallet, m);
  }

  // Exclude wallets that exceeded the per-hour swap cap (likely bots).
  const eligible: Array<{ wallet: string; volume: bigint }> = [];
  for (const [wallet, vol] of volume) {
    const counts = hourly.get(wallet);
    const maxHour = counts ? Math.max(...counts.values()) : 0;
    if (maxHour > cfg.AIRDROP_MAX_SWAPS_PER_HOUR) continue;
    if (vol <= 0n) continue;
    eligible.push({ wallet, volume: vol });
  }
  if (eligible.length === 0) return null;

  const round = await prisma.airdropRound.create({
    data: { windowStart, windowEnd, status: 'pending_review' },
  });
  await prisma.airdrop.createMany({
    data: eligible.map((e) => ({
      roundId: round.id,
      wallet: e.wallet,
      mint: usdcMint().toBase58(),
      amount: 0n, // set at send time from the converted USDC pool
      volume: e.volume,
      status: 'pending',
    })),
  });
  log.info({ round: round.id, wallets: eligible.length }, 'airdrop: snapshot written (pending_review)');
  return round.id;
}

/** Convert traders_pool to USDC and pay approved rounds pro-rata by volume. */
export async function runAirdropSend(): Promise<void> {
  const cfg = botConfig();
  const connection = getConnection();
  const airdrop = airdropWallet();
  const usdc = usdcMint();

  // Convert each traders-pool mint to USDC into the airdrop wallet.
  const pools = await prisma.tradersPool.findMany({ where: { amount: { gt: cfg.BUCKET_MIN } } });
  for (const p of pools) {
    try {
      if (p.mint === usdc.toBase58()) continue;
      const quote = await getQuote({
        inputMint: p.mint,
        outputMint: usdc.toBase58(),
        amount: p.amount,
        slippageBps: cfg.SWAP_MAX_BPS,
      });
      if (priceImpactBps(quote) > cfg.SWAP_MAX_BPS) continue;
      const vtx = await getSwapTx({ quote, userPublicKey: airdrop.publicKey.toBase58() });
      const res = await sendVersionedTx({
        connection,
        vtx,
        signers: [airdrop],
        bot: 'airdrop',
        action: 'convert-to-usdc',
        mint: p.mint,
        idemKey: `airdrop-conv:${p.mint}:${p.amount}`,
      });
      if (res.status === 'CONFIRMED') await debitTraders(p.mint, p.amount);
    } catch (err) {
      log.error({ err, mint: p.mint }, 'airdrop: conversion failed');
    }
  }

  const rounds = await prisma.airdropRound.findMany({ where: { status: 'approved' } });
  if (rounds.length === 0) return;

  const tokenProgram = await tokenProgramForMint(connection, usdc);
  const decimals = await mintDecimals(connection, usdc);
  const fromAta = getAssociatedTokenAddressSync(usdc, airdrop.publicKey, true, tokenProgram);

  for (const round of rounds) {
    try {
      const shares = await prisma.airdrop.findMany({ where: { roundId: round.id } });
      const totalVolume = shares.reduce((s, a) => s + a.volume, 0n);
      if (totalVolume <= 0n) continue;

      const available = await ataBalance(connection, usdc, airdrop.publicKey, tokenProgram);
      if (available <= 0n) {
        log.warn({ round: round.id }, 'airdrop: no USDC available to distribute');
        continue;
      }

      const payees = shares
        .map((a) => ({ wallet: a.wallet, amount: (available * a.volume) / totalVolume }))
        .filter((p) => p.amount > 0n);

      let allConfirmed = true;
      for (let i = 0; i < payees.length; i += cfg.PAYOUT_BATCH) {
        const batch = payees.slice(i, i + cfg.PAYOUT_BATCH);
        const tx = new Transaction();
        for (const p of batch) {
          const owner = new PublicKey(p.wallet);
          const toAta = getAssociatedTokenAddressSync(usdc, owner, true, tokenProgram);
          tx.add(
            createAssociatedTokenAccountIdempotentInstruction(airdrop.publicKey, toAta, owner, usdc, tokenProgram),
            createTransferCheckedInstruction(fromAta, usdc, toAta, airdrop.publicKey, p.amount, decimals, [], tokenProgram),
          );
        }
        const res = await sendTx({
          connection,
          transaction: tx,
          signers: [airdrop],
          feePayer: airdrop.publicKey,
          bot: 'airdrop',
          action: 'airdrop-batch',
          mint: usdc.toBase58(),
          idemKey: `airdrop:${round.id}:batch${i / cfg.PAYOUT_BATCH}`,
        });
        if (res.status === 'CONFIRMED') {
          await Promise.all(
            batch.map((b) =>
              prisma.airdrop.updateMany({
                where: { roundId: round.id, wallet: b.wallet },
                data: { amount: b.amount, status: 'sent', tx: res.signature },
              }),
            ),
          );
        } else {
          allConfirmed = false;
        }
      }

      if (allConfirmed && !isDryRun()) {
        await prisma.airdropRound.update({ where: { id: round.id }, data: { status: 'sent' } });
      }
      log.info({ round: round.id, payees: payees.length }, 'airdrop: round sent');
    } catch (err) {
      log.error({ err, round: round.id }, 'airdrop: round failed');
    }
  }
}
