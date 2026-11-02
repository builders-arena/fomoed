/**
 * Pure invariant helpers used by the hourly checker. Kept free of IO so the
 * comparison logic is unit-tested independently of the database.
 */

export interface ClaimSplitRow {
  total: bigint;
  holders: bigint;
  creator: bigint;
  flagship: bigint;
  traders: bigint;
  treasury: bigint;
}

/** A fee claim's recorded split must sum exactly to the claimed total. */
export function splitReconciles(row: ClaimSplitRow): boolean {
  return row.holders + row.creator + row.flagship + row.traders + row.treasury === row.total;
}

/** |actual - expected| / expected <= bps/10_000. expected 0 requires actual 0. */
export function withinSlippage(expected: bigint, actual: bigint, bps: number): boolean {
  if (expected === 0n) return actual === 0n;
  const diff = actual > expected ? actual - expected : expected - actual;
  // diff/expected <= bps/10000  <=>  diff*10000 <= expected*bps
  return diff * 10_000n <= expected * BigInt(Math.round(bps));
}

/** Holder payouts for a coin may never exceed what was credited to them. */
export function payoutWithinCredit(creditedHolders: bigint, paidOut: bigint): boolean {
  return paidOut <= creditedHolders;
}
