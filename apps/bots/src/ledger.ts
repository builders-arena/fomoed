import { prisma } from '@float/db';

/**
 * Ledger helpers for the four fee buckets. Credits (by cycle) and debits (by
 * payout/buyback/airdrop) use atomic increments so concurrent workers stay
 * consistent.
 */

export async function creditHolders(coin: string, mint: string, amount: bigint): Promise<void> {
  if (amount === 0n) return;
  await prisma.holdersPool.upsert({
    where: { coin_mint: { coin, mint } },
    create: { coin, mint, amount },
    update: { amount: { increment: amount } },
  });
}

export async function debitHolders(coin: string, mint: string, amount: bigint): Promise<void> {
  if (amount === 0n) return;
  await prisma.holdersPool.update({
    where: { coin_mint: { coin, mint } },
    data: { amount: { decrement: amount } },
  });
}

export async function creditFlagship(mint: string, amount: bigint): Promise<void> {
  if (amount === 0n) return;
  await prisma.flagshipPool.upsert({
    where: { mint },
    create: { mint, amount },
    update: { amount: { increment: amount } },
  });
}

export async function debitFlagship(mint: string, amount: bigint): Promise<void> {
  if (amount === 0n) return;
  await prisma.flagshipPool.update({ where: { mint }, data: { amount: { decrement: amount } } });
}

export async function creditTraders(mint: string, amount: bigint): Promise<void> {
  if (amount === 0n) return;
  await prisma.tradersPool.upsert({
    where: { mint },
    create: { mint, amount },
    update: { amount: { increment: amount } },
  });
}

export async function debitTraders(mint: string, amount: bigint): Promise<void> {
  if (amount === 0n) return;
  await prisma.tradersPool.update({ where: { mint }, data: { amount: { decrement: amount } } });
}

/** Whether a coin's quote mint is paused (cycle/payout skip it). */
export async function isQuotePaused(quoteMint: string): Promise<boolean> {
  const cfg = await prisma.poolConfig.findUnique({ where: { quoteMint } });
  return cfg?.paused ?? false;
}
