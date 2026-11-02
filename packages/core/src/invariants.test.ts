import { describe, expect, it } from 'vitest';
import { payoutWithinCredit, splitReconciles, withinSlippage } from './invariants.js';

describe('splitReconciles', () => {
  it('passes when parts sum to total', () => {
    expect(
      splitReconciles({ total: 100n, holders: 60n, creator: 0n, flagship: 20n, traders: 15n, treasury: 5n }),
    ).toBe(true);
  });
  it('fails when parts do not sum to total', () => {
    expect(
      splitReconciles({ total: 100n, holders: 60n, creator: 0n, flagship: 20n, traders: 15n, treasury: 4n }),
    ).toBe(false);
  });
});

describe('withinSlippage', () => {
  it('accepts an exact match', () => {
    expect(withinSlippage(1000n, 1000n, 100)).toBe(true);
  });
  it('accepts within the bps tolerance', () => {
    expect(withinSlippage(1000n, 995n, 100)).toBe(true); // 0.5% <= 1%
    expect(withinSlippage(1000n, 1010n, 100)).toBe(true); // 1% == 1%
  });
  it('rejects beyond the tolerance', () => {
    expect(withinSlippage(1000n, 980n, 100)).toBe(false); // 2% > 1%
  });
  it('requires zero actual when expected is zero', () => {
    expect(withinSlippage(0n, 0n, 100)).toBe(true);
    expect(withinSlippage(0n, 1n, 100)).toBe(false);
  });
});

describe('payoutWithinCredit', () => {
  it('passes when paid <= credited', () => {
    expect(payoutWithinCredit(100n, 100n)).toBe(true);
    expect(payoutWithinCredit(100n, 99n)).toBe(true);
  });
  it('fails when overpaid', () => {
    expect(payoutWithinCredit(100n, 101n)).toBe(false);
  });
});
