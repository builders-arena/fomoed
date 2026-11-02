import { describe, expect, it } from 'vitest';
import { priceImpactBps, type QuoteResponse } from './jupiter.js';

function quote(priceImpactPct: string): QuoteResponse {
  return {
    inputMint: 'a',
    outputMint: 'b',
    inAmount: '1000',
    outAmount: '990',
    otherAmountThreshold: '980',
    priceImpactPct,
  } as QuoteResponse;
}

describe('priceImpactBps', () => {
  it('converts a decimal price-impact fraction to basis points', () => {
    expect(priceImpactBps(quote('0.01'))).toBeCloseTo(100);
    expect(priceImpactBps(quote('0.0012'))).toBeCloseTo(12);
    expect(priceImpactBps(quote('0'))).toBe(0);
  });

  it('takes the absolute value', () => {
    expect(priceImpactBps(quote('-0.005'))).toBeCloseTo(50);
  });
});
