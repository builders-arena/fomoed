import { FEE_SPLIT_BPS } from './constants.js';

/**
 * Split a claimed partner-fee amount (quote base units) into the four
 * bot-distributed buckets.
 *
 * The creator's 5% is paid on-chain via `creatorTradingFeePercentage`, so it is
 * NOT part of what the bot claims — the partner claim already excludes it.
 * We therefore distribute the claim across HOLDERS / FLAGSHIP / TRADERS /
 * TREASURY using their bps normalized to exclude CREATOR (denominator 9500).
 *
 * Integer math with the remainder assigned to HOLDERS, so the four parts sum
 * exactly to the input (no dust lost).
 */

export interface FeeSplit {
  holders: bigint;
  flagship: bigint;
  traders: bigint;
  treasury: bigint;
}

/** Denominator excluding the on-chain creator share. */
export const SPLIT_DENOMINATOR_BPS = BigInt(
  FEE_SPLIT_BPS.HOLDERS + FEE_SPLIT_BPS.FLAGSHIP + FEE_SPLIT_BPS.TRADERS + FEE_SPLIT_BPS.TREASURY,
);

export function splitPartnerClaim(amount: bigint): FeeSplit {
  if (amount < 0n) throw new Error('amount must be non-negative');
  const denom = SPLIT_DENOMINATOR_BPS;
  const flagship = (amount * BigInt(FEE_SPLIT_BPS.FLAGSHIP)) / denom;
  const traders = (amount * BigInt(FEE_SPLIT_BPS.TRADERS)) / denom;
  const treasury = (amount * BigInt(FEE_SPLIT_BPS.TREASURY)) / denom;
  // Holders takes the remainder so the parts sum exactly to `amount`.
  const holders = amount - flagship - traders - treasury;
  return { holders, flagship, traders, treasury };
}
