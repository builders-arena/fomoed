import { sortMints } from '@float/core';
import { SwapSide } from '@float/db';
import { PublicKey } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import type { SwapEvent } from './parser.js';
import { resolveAmounts } from './swapMapping.js';

const M1 = new PublicKey('So11111111111111111111111111111111111111112');
const M2 = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

function swap(venue: 'DBC' | 'DAMM', tradeDirection: number): SwapEvent {
  return {
    kind: 'swap',
    venue,
    eventIndex: 0,
    pool: 'pool',
    tradeDirection,
    includedInputAmount: 100n,
    outputAmount: 50n,
    tradingFee: 2n,
    protocolFee: 1n,
    referralFee: 0n,
    hasReferral: false,
  };
}

describe('resolveAmounts — DBC', () => {
  const coin = { baseMint: M1.toBase58(), quoteMint: M2.toBase58() };

  it('QuoteToBase (1) is a buy: input=quote, output=base', () => {
    const r = resolveAmounts(swap('DBC', 1), coin);
    expect(r.side).toBe(SwapSide.Buy);
    expect(r.quoteAmount).toBe(100n);
    expect(r.baseAmount).toBe(50n);
  });

  it('BaseToQuote (0) is a sell: input=base, output=quote', () => {
    const r = resolveAmounts(swap('DBC', 0), coin);
    expect(r.side).toBe(SwapSide.Sell);
    expect(r.baseAmount).toBe(100n);
    expect(r.quoteAmount).toBe(50n);
  });
});

describe('resolveAmounts — DAMM (direction depends on mint sort order)', () => {
  // Determine which constant sorts first so we can set base = tokenA or tokenB.
  const [tokenA, tokenB] = sortMints(M1, M2);

  it('base is tokenA: AtoB(0)=sell, BtoA(1)=buy', () => {
    const coin = { baseMint: tokenA.toBase58(), quoteMint: tokenB.toBase58() };
    expect(resolveAmounts(swap('DAMM', 0), coin).side).toBe(SwapSide.Sell);
    expect(resolveAmounts(swap('DAMM', 1), coin).side).toBe(SwapSide.Buy);
  });

  it('base is tokenB: AtoB(0)=buy, BtoA(1)=sell', () => {
    const coin = { baseMint: tokenB.toBase58(), quoteMint: tokenA.toBase58() };
    expect(resolveAmounts(swap('DAMM', 0), coin).side).toBe(SwapSide.Buy);
    expect(resolveAmounts(swap('DAMM', 1), coin).side).toBe(SwapSide.Sell);
  });

  it('a DAMM buy maps output to base and input to quote', () => {
    const coin = { baseMint: tokenB.toBase58(), quoteMint: tokenA.toBase58() };
    const r = resolveAmounts(swap('DAMM', 0), coin); // buy
    expect(r.baseAmount).toBe(50n);
    expect(r.quoteAmount).toBe(100n);
  });
});
