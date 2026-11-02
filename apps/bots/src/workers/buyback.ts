import { getConnection, WSOL_MINT } from '@float/core';
import { prisma } from '@float/db';
import { createBurnCheckedInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token';
import { PublicKey, Transaction } from '@solana/web3.js';
import { botConfig, isDryRun } from '../config.js';
import { getQuote, getSwapTx, priceImpactBps } from '../jupiter.js';
import { debitFlagship } from '../ledger.js';
import {
  ataBalance,
  buybackWallet,
  log,
  mintDecimals,
  tokenProgramForMint,
} from '../shared.js';
import { sendTx, sendVersionedTx } from '../tx.js';

const SOL_RENT_BUFFER = 10_000_000n; // ~0.01 SOL kept for fees/rent
const IDLE_MS = 4 * 60 * 60_000;

/** Convert flagship-pool balances to SOL, then buy and burn the flagship token. */
export async function runBuyback(): Promise<void> {
  const cfg = botConfig();
  const connection = getConnection();
  const buyback = buybackWallet();

  // --- Step 1: convert each flagship-pool mint to SOL --------------------
  const pools = await prisma.flagshipPool.findMany({ where: { amount: { gt: cfg.BUCKET_MIN } } });
  for (const p of pools) {
    try {
      if (p.mint === WSOL_MINT.toBase58()) continue; // already SOL
      const quote = await getQuote({
        inputMint: p.mint,
        outputMint: WSOL_MINT.toBase58(),
        amount: p.amount,
        slippageBps: cfg.SWAP_MAX_BPS,
      });
      if (priceImpactBps(quote) > cfg.SWAP_MAX_BPS) {
        log.warn({ mint: p.mint, impact: quote.priceImpactPct }, 'buyback: skip, price impact too high');
        continue;
      }
      const vtx = await getSwapTx({ quote, userPublicKey: buyback.publicKey.toBase58() });
      const res = await sendVersionedTx({
        connection,
        vtx,
        signers: [buyback],
        bot: 'buyback',
        action: 'convert-to-sol',
        mint: p.mint,
        idemKey: `buyback-conv:${p.mint}:${p.amount}`,
      });
      if (res.status === 'CONFIRMED') await debitFlagship(p.mint, p.amount);
    } catch (err) {
      log.error({ err, mint: p.mint }, 'buyback: conversion failed');
    }
  }

  // --- Step 2: buy + burn the flagship token when SOL is ready -----------
  if (!cfg.FLAGSHIP_MINT) {
    log.info('buyback: FLAGSHIP_MINT not set; skipping buy+burn');
    return;
  }

  const solBalance = BigInt(await connection.getBalance(buyback.publicKey));
  const last = await prisma.buyback.findFirst({ orderBy: { ts: 'desc' } });
  const idle = last ? Date.now() - last.ts.getTime() > IDLE_MS : true;
  const spendable = solBalance > SOL_RENT_BUFFER ? solBalance - SOL_RENT_BUFFER : 0n;
  if (spendable <= 0n) return;
  if (spendable < cfg.BUYBACK_SOL_TRIGGER && !idle) return;

  try {
    const flagship = new PublicKey(cfg.FLAGSHIP_MINT);
    const quote = await getQuote({
      inputMint: WSOL_MINT.toBase58(),
      outputMint: cfg.FLAGSHIP_MINT,
      amount: spendable,
      slippageBps: cfg.SWAP_MAX_BPS,
    });
    if (priceImpactBps(quote) > cfg.SWAP_MAX_BPS) {
      log.warn({ impact: quote.priceImpactPct }, 'buyback: skip buy, price impact too high');
      return;
    }

    const tokenProgram = await tokenProgramForMint(connection, flagship);
    const before = await ataBalance(connection, flagship, buyback.publicKey, tokenProgram);

    const vtx = await getSwapTx({ quote, userPublicKey: buyback.publicKey.toBase58() });
    const swapRes = await sendVersionedTx({
      connection,
      vtx,
      signers: [buyback],
      bot: 'buyback',
      action: 'buy-flagship',
      mint: cfg.FLAGSHIP_MINT,
    });
    if (swapRes.status !== 'CONFIRMED') {
      log.info({ spendable: spendable.toString() }, 'buyback: buy simulated (dry-run) or skipped');
      return;
    }

    const after = await ataBalance(connection, flagship, buyback.publicKey, tokenProgram);
    const bought = after - before;
    if (bought <= 0n) return;

    const decimals = await mintDecimals(connection, flagship);
    const burnAta = getAssociatedTokenAddressSync(flagship, buyback.publicKey, true, tokenProgram);
    const burnTx = new Transaction().add(
      createBurnCheckedInstruction(burnAta, flagship, buyback.publicKey, bought, decimals, [], tokenProgram),
    );
    const burnRes = await sendTx({
      connection,
      transaction: burnTx,
      signers: [buyback],
      feePayer: buyback.publicKey,
      bot: 'buyback',
      action: 'burn-flagship',
      mint: cfg.FLAGSHIP_MINT,
    });

    if (!isDryRun()) {
      await prisma.buyback.create({
        data: {
          mint: WSOL_MINT.toBase58(),
          solIn: spendable,
          flagshipOut: bought,
          swapTx: swapRes.signature,
          burnTx: burnRes.signature,
        },
      });
    }
    log.info({ solIn: spendable.toString(), bought: bought.toString() }, 'buyback: bought and burned');
  } catch (err) {
    log.error({ err }, 'buyback: buy+burn failed');
  }
}
