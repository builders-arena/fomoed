import { describe, expect, it } from 'vitest';
import { FEE_SPLIT_BPS } from './constants.js';
import { splitPartnerClaim, SPLIT_DENOMINATOR_BPS } from './fees.js';

describe('splitPartnerClaim', () => {
  it('excludes the on-chain creator share from the denominator', () => {
    expect(SPLIT_DENOMINATOR_BPS).toBe(9500n);
    expect(Number(SPLIT_DENOMINATOR_BPS)).toBe(10_000 - FEE_SPLIT_BPS.CREATOR);
  });

  it('parts sum exactly to the input (no dust lost)', () => {
    for (const amt of [0n, 1n, 7n, 1_000_000n, 123_456_789n, 9_999_999_999n]) {
      const s = splitPartnerClaim(amt);
      expect(s.holders + s.flagship + s.traders + s.treasury).toBe(amt);
      expect(s.holders >= 0n && s.flagship >= 0n && s.traders >= 0n && s.treasury >= 0n).toBe(true);
    }
  });

  it('splits in the expected proportions for a large amount', () => {
    const amt = 9_500_000n; // divisible by 9500
    const s = splitPartnerClaim(amt);
    expect(s.flagship).toBe((amt * 3500n) / 9500n);
    expect(s.traders).toBe((amt * 3500n) / 9500n);
    expect(s.treasury).toBe((amt * 1000n) / 9500n);
    expect(s.holders).toBe(amt - s.flagship - s.traders - s.treasury);
  });

  it('rejects negative input', () => {
    expect(() => splitPartnerClaim(-1n)).toThrow();
  });
});
