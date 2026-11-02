import {
  ActivationType,
  BaseFeeMode,
  buildCurveWithMarketCap,
  CollectFeeMode,
  DammV2DynamicFeeMode,
  getPriceFromSqrtPrice,
  MAX_SQRT_PRICE,
  MigratedCollectFeeMode,
  MigrationFeeOption,
  MigrationOption,
  TokenAuthorityOption,
  TokenDecimal,
  TokenType,
  type BuildCurveWithMarketCapParams,
  type ConfigParameters,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import Decimal from 'decimal.js';
import {
  BASE_TOKEN_DECIMALS,
  INITIAL_MARKET_CAP_USD,
  MIGRATION_MARKET_CAP_USD,
  PROTOCOL_FEE_FRACTION,
  TOTAL_TOKEN_SUPPLY,
  TRADING_FEE_BPS,
} from '../constants.js';

/**
 * Builds the DBC partner config (`ConfigParameters`) for a Float launch on a
 * given quote mint.
 *
 * Design decisions (locked in the build plan):
 *   - Fixed supply 1,000,000,000, base decimals 6, token authority Immutable.
 *   - Target initial market cap $20,000, migration market cap $150,000.
 *   - Base fee fixed 2% (fee scheduler with equal start/end, no decay), dynamic
 *     fee OFF, collect fee mode QuoteToken.
 *   - Migration to DAMM v2, migrated pool fee 2%, migrated collect mode
 *     QuoteToken, 100% partner liquidity permanently locked, no creator LP,
 *     no locked vesting.
 *   - Creator 5% of the platform-controlled fee is paid trustlessly via the
 *     DBC `creatorTradingFeePercentage` (see rounding note below).
 */

export interface BuildPartnerConfigArgs {
  /** Quote mint (SOL / USDC / JUP / badged stock token). */
  quoteMint: string;
  /** Quote mint decimals (SOL 9, USDC/JUP 6). */
  quoteDecimals: number;
  /** Current USD price of one whole quote token, used to denominate caps. */
  quoteUsdPrice: number;
  /** SPL vs Token-2022. SOL/USDC/JUP are SPL; stock tokens are Token-2022. */
  tokenType?: TokenType;
}

/**
 * Creator's share expressed as a percentage of the *platform-controlled* fee
 * (the share left after Meteora's 20% protocol cut).
 *
 * DBC's `creatorTradingFeePercentage` is a percentage of the non-protocol
 * (partner + creator) trading fee — i.e. of the 80% that remains after the
 * protocol cut. To give the creator 5% of the total fee:
 *
 *   creatorPct_of_nonProtocol = 5% / (1 - 20%) = 5 / 80 = 6.25%
 *
 * On-chain the field is a u8 integer percent (0..100), so 6.25 cannot be
 * represented exactly. We round to the nearest integer (6). The resulting
 * creator share is 6% x 80% = 4.8% of the total fee — 0.2 percentage points
 * under the 5% target. That shortfall stays in the partner pool and is
 * redistributed by the bot (folded into the HOLDERS share), so holders are
 * never shorted and the creator is never overpaid.
 */
export const CREATOR_TRADING_FEE_PERCENTAGE_EXACT =
  5 / (1 - PROTOCOL_FEE_FRACTION) / 1; // = 6.25
export const CREATOR_TRADING_FEE_PERCENTAGE = Math.round(CREATOR_TRADING_FEE_PERCENTAGE_EXACT); // 6

/** Zero locked-vesting (none). */
const NO_LOCKED_VESTING = {
  totalLockedVestingAmount: 0,
  numberOfVestingPeriod: 0,
  cliffUnlockAmount: 0,
  totalVestingDuration: 0,
  cliffDurationFromMigrationTime: 0,
} as const;

export function buildPartnerConfig(args: BuildPartnerConfigArgs): ConfigParameters {
  const { quoteDecimals, quoteUsdPrice, tokenType = TokenType.SPLToken } = args;

  if (quoteUsdPrice <= 0) {
    throw new Error(`quoteUsdPrice must be > 0, got ${quoteUsdPrice}`);
  }

  // Market caps are denominated in the QUOTE token. Convert the USD targets.
  const initialMarketCap = INITIAL_MARKET_CAP_USD / quoteUsdPrice;
  const migrationMarketCap = MIGRATION_MARKET_CAP_USD / quoteUsdPrice;

  const params: BuildCurveWithMarketCapParams = {
    initialMarketCap,
    migrationMarketCap,
    token: {
      tokenType,
      tokenBaseDecimal: TokenDecimal.SIX,
      tokenQuoteDecimal: quoteDecimals,
      tokenAuthorityOption: TokenAuthorityOption.Immutable,
      totalTokenSupply: TOTAL_TOKEN_SUPPLY,
      leftover: 0,
    },
    fee: {
      // Fixed 2%: a linear scheduler with equal starting/ending fee and no decay.
      baseFeeParams: {
        baseFeeMode: BaseFeeMode.FeeSchedulerLinear,
        feeSchedulerParam: {
          startingFeeBps: TRADING_FEE_BPS,
          endingFeeBps: TRADING_FEE_BPS,
          numberOfPeriod: 0,
          totalDuration: 0,
        },
      },
      dynamicFeeEnabled: false,
      collectFeeMode: CollectFeeMode.QuoteToken,
      creatorTradingFeePercentage: CREATOR_TRADING_FEE_PERCENTAGE,
      poolCreationFee: 0,
      enableFirstSwapWithMinFee: false,
    },
    migration: {
      migrationOption: MigrationOption.MET_DAMM_V2,
      migrationFeeOption: MigrationFeeOption.Customizable,
      // No extra migration fee beyond the protocol cut.
      migrationFee: {
        feePercentage: 0,
        creatorFeePercentage: 0,
      },
      migratedPoolFee: {
        collectFeeMode: MigratedCollectFeeMode.QuoteToken,
        dynamicFee: DammV2DynamicFeeMode.Disabled,
        poolFeeBps: TRADING_FEE_BPS,
      },
    },
    liquidityDistribution: {
      // 100% partner liquidity, permanently locked. No creator LP.
      partnerPermanentLockedLiquidityPercentage: 100,
      partnerLiquidityPercentage: 0,
      creatorPermanentLockedLiquidityPercentage: 0,
      creatorLiquidityPercentage: 0,
    },
    lockedVesting: { ...NO_LOCKED_VESTING },
    activationType: ActivationType.Timestamp,
  };

  return buildCurveWithMarketCap(params);
}

/**
 * Compute the market caps (in quote tokens, and in USD) implied by a built
 * config, by reading the start price and the migration (final curve) price.
 * Used by tests and `pool-state` to prove the curve hit its targets.
 */
export function impliedMarketCaps(
  config: ConfigParameters,
  quoteDecimals: number,
  quoteUsdPrice: number,
): {
  initialQuote: Decimal;
  migrationQuote: Decimal;
  initialUsd: Decimal;
  migrationUsd: Decimal;
} {
  const supply = new Decimal(TOTAL_TOKEN_SUPPLY);

  const startPrice = getPriceFromSqrtPrice(
    config.sqrtStartPrice,
    BASE_TOKEN_DECIMALS as TokenDecimal,
    quoteDecimals,
  );

  // Migration price = the price at which the bonding segment ends. The curve
  // array ends with a tail segment that runs to MAX_SQRT_PRICE (a sentinel, not
  // a real migration price), so exclude any point at/above MAX_SQRT_PRICE and
  // take the highest remaining sqrt price.
  const maxSqrtPrice = MAX_SQRT_PRICE;
  let migrationSqrtPrice = config.sqrtStartPrice;
  for (const point of config.curve) {
    if (point.sqrtPrice.gte(maxSqrtPrice)) continue;
    if (point.sqrtPrice.gt(migrationSqrtPrice)) {
      migrationSqrtPrice = point.sqrtPrice;
    }
  }
  const migrationPrice = getPriceFromSqrtPrice(
    migrationSqrtPrice,
    BASE_TOKEN_DECIMALS as TokenDecimal,
    quoteDecimals,
  );

  const initialQuote = new Decimal(startPrice.toString()).mul(supply);
  const migrationQuote = new Decimal(migrationPrice.toString()).mul(supply);
  const price = new Decimal(quoteUsdPrice);

  return {
    initialQuote,
    migrationQuote,
    initialUsd: initialQuote.mul(price),
    migrationUsd: migrationQuote.mul(price),
  };
}
