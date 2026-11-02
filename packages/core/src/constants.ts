import { PublicKey } from '@solana/web3.js';

/**
 * Canonical on-chain addresses and economic constants.
 *
 * RULE (CLAUDE.md): never hardcode mint addresses or program IDs outside this
 * file. Everything that touches the chain imports from here.
 */

// --- Program IDs ------------------------------------------------------------

/** Meteora Dynamic Bonding Curve program. */
export const DBC_PROGRAM_ID = new PublicKey('dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN');

/** Meteora DAMM v2 (cp-amm) program — migration target. */
export const DAMM_V2_PROGRAM_ID = new PublicKey('cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG');

// --- Quote mints ------------------------------------------------------------

/** Wrapped SOL (same on all clusters). */
export const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

/** USDC — mainnet-beta. */
export const USDC_MINT_MAINNET = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

/** USDC — devnet (Circle's devnet mint). */
export const USDC_MINT_DEVNET = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

/** JUP — mainnet-beta only. */
export const JUP_MINT = new PublicKey('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN');

/** Decimals for the quote mints we ship first. */
export const QUOTE_DECIMALS = {
  SOL: 9,
  USDC: 6,
  JUP: 6,
} as const;

// --- Fee split --------------------------------------------------------------

/**
 * Float fee split in basis points of the *platform-controlled* fee (the share
 * left after Meteora's protocol cut). Sums to 10_000.
 *
 * CREATOR is paid trustlessly on-chain via the DBC `creatorTradingFeePercentage`
 * (see `dbc/config.ts`), NOT by the bot. The bot distributes the remaining
 * HOLDERS / FLAGSHIP / TRADERS / TREASURY shares.
 */
export const FEE_SPLIT_BPS = {
  HOLDERS: 1500,
  CREATOR: 500,
  FLAGSHIP: 3500,
  TRADERS: 3500,
  TREASURY: 1000,
} as const;

/** Total basis points (sanity-checked at module load). */
export const BPS_DENOMINATOR = 10_000;

{
  const sum =
    FEE_SPLIT_BPS.HOLDERS +
    FEE_SPLIT_BPS.CREATOR +
    FEE_SPLIT_BPS.FLAGSHIP +
    FEE_SPLIT_BPS.TRADERS +
    FEE_SPLIT_BPS.TREASURY;
  if (sum !== BPS_DENOMINATOR) {
    throw new Error(`FEE_SPLIT_BPS must sum to ${BPS_DENOMINATOR}, got ${sum}`);
  }
}

// --- Token economics (DBC config targets) -----------------------------------

/** Fixed total supply for every launched coin. */
export const TOTAL_TOKEN_SUPPLY = 1_000_000_000;

/** Base token decimals for every launched coin. */
export const BASE_TOKEN_DECIMALS = 6;

/** Trading fee charged by the bonding curve and the migrated pool (2%). */
export const TRADING_FEE_BPS = 200;

/** Market-cap targets in quote-USD terms. */
export const INITIAL_MARKET_CAP_USD = 20_000;
export const MIGRATION_MARKET_CAP_USD = 150_000;

/**
 * Meteora's protocol cut of the trading fee (20%). The remaining 80% is the
 * platform-controlled share that `FEE_SPLIT_BPS` divides.
 */
export const PROTOCOL_FEE_FRACTION = 0.2;
