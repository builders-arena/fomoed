import { describe, expect, it } from 'vitest';
import { QUOTE_DECIMALS } from '../constants.js';
import {
  buildPartnerConfig,
  CREATOR_TRADING_FEE_PERCENTAGE,
  CREATOR_TRADING_FEE_PERCENTAGE_EXACT,
  impliedMarketCaps,
} from './config.js';

/** Assert |actual - target| / target <= tolerance. */
function withinPct(actual: number, target: number, tolerancePct: number): boolean {
  return Math.abs(actual - target) / target <= tolerancePct / 100;
}

describe('buildPartnerConfig market-cap targeting', () => {
  const cases = [
    { name: 'SOL at $150', quoteDecimals: QUOTE_DECIMALS.SOL, quoteUsdPrice: 150 },
    { name: 'USDC at $1', quoteDecimals: QUOTE_DECIMALS.USDC, quoteUsdPrice: 1 },
  ];

  for (const c of cases) {
    it(`hits $20k / $150k within 2% for ${c.name}`, () => {
      const config = buildPartnerConfig({
        quoteMint: 'So11111111111111111111111111111111111111112',
        quoteDecimals: c.quoteDecimals,
        quoteUsdPrice: c.quoteUsdPrice,
      });

      const caps = impliedMarketCaps(config, c.quoteDecimals, c.quoteUsdPrice);

      expect(
        withinPct(caps.initialUsd.toNumber(), 20_000, 2),
        `initial ${caps.initialUsd.toString()} not within 2% of 20000`,
      ).toBe(true);
      expect(
        withinPct(caps.migrationUsd.toNumber(), 150_000, 2),
        `migration ${caps.migrationUsd.toString()} not within 2% of 150000`,
      ).toBe(true);
    });
  }

  it('rejects a non-positive quote price', () => {
    expect(() =>
      buildPartnerConfig({ quoteMint: 'x', quoteDecimals: 9, quoteUsdPrice: 0 }),
    ).toThrow();
  });
});

describe('creator trading fee rounding', () => {
  it('computes 6.25% exact and rounds to 6%', () => {
    expect(CREATOR_TRADING_FEE_PERCENTAGE_EXACT).toBeCloseTo(6.25, 10);
    expect(CREATOR_TRADING_FEE_PERCENTAGE).toBe(6);
  });
});
