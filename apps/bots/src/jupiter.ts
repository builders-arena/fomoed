import { VersionedTransaction } from '@solana/web3.js';
import { z } from 'zod';

/**
 * Minimal Jupiter v6 client: quote + build swap transaction. Used by the
 * buyback and airdrop workers to convert claimed quote tokens to SOL/USDC and
 * to buy the flagship token. Enforces slippage / price-impact at the call site.
 */

const QUOTE_BASE = 'https://quote-api.jup.ag/v6';

const quoteSchema = z
  .object({
    inputMint: z.string(),
    outputMint: z.string(),
    inAmount: z.string(),
    outAmount: z.string(),
    otherAmountThreshold: z.string(),
    priceImpactPct: z.string(),
  })
  .passthrough();

export type QuoteResponse = z.infer<typeof quoteSchema>;

export interface QuoteArgs {
  inputMint: string;
  outputMint: string;
  amount: bigint;
  slippageBps: number;
}

export async function getQuote(args: QuoteArgs): Promise<QuoteResponse> {
  const url =
    `${QUOTE_BASE}/quote?inputMint=${args.inputMint}&outputMint=${args.outputMint}` +
    `&amount=${args.amount.toString()}&slippageBps=${args.slippageBps}&restrictIntermediateTokens=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Jupiter quote failed: ${res.status} ${await res.text()}`);
  return quoteSchema.parse(await res.json());
}

/** Price impact of a quote in basis points. */
export function priceImpactBps(quote: QuoteResponse): number {
  return Math.abs(Number(quote.priceImpactPct)) * 10_000;
}

const swapSchema = z.object({ swapTransaction: z.string() }).passthrough();

export async function getSwapTx(args: {
  quote: QuoteResponse;
  userPublicKey: string;
}): Promise<VersionedTransaction> {
  const res = await fetch(`${QUOTE_BASE}/swap`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: args.quote,
      userPublicKey: args.userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: 'auto',
    }),
  });
  if (!res.ok) throw new Error(`Jupiter swap build failed: ${res.status} ${await res.text()}`);
  const { swapTransaction } = swapSchema.parse(await res.json());
  return VersionedTransaction.deserialize(Buffer.from(swapTransaction, 'base64'));
}
