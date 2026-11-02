import { sortMints } from '@float/core';
import { SwapSide } from '@float/db';
import { PublicKey } from '@solana/web3.js';
import type { SwapEvent } from './parser.js';

export interface CoinMints {
  baseMint: string;
  quoteMint: string;
}

export interface ResolvedAmounts {
  side: SwapSide;
  baseAmount: bigint;
  quoteAmount: bigint;
}

/**
 * Resolve base/quote amounts and buy/sell side for a swap, given the coin's
 * mints and the venue's trade-direction convention.
 *
 * DBC TradeDirection:  0 = BaseToQuote (sell), 1 = QuoteToBase (buy).
 * DAMM TradeDirection: 0 = AtoB, 1 = BtoA, where (A,B) is the sorted mint pair.
 */
export function resolveAmounts(ev: SwapEvent, coin: CoinMints): ResolvedAmounts {
  if (ev.venue === 'DBC') {
    const buy = ev.tradeDirection === 1;
    return buy
      ? { side: SwapSide.Buy, baseAmount: ev.outputAmount, quoteAmount: ev.includedInputAmount }
      : { side: SwapSide.Sell, baseAmount: ev.includedInputAmount, quoteAmount: ev.outputAmount };
  }

  const [tokenA] = sortMints(new PublicKey(coin.baseMint), new PublicKey(coin.quoteMint));
  const baseIsA = tokenA.toBase58() === coin.baseMint;
  const aToB = ev.tradeDirection === 0;
  // Base is the input token when (baseIsA && AtoB) or (!baseIsA && BtoA).
  const baseIsInput = baseIsA === aToB;
  return baseIsInput
    ? { side: SwapSide.Sell, baseAmount: ev.includedInputAmount, quoteAmount: ev.outputAmount }
    : { side: SwapSide.Buy, baseAmount: ev.outputAmount, quoteAmount: ev.includedInputAmount };
}
