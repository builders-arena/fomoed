import { USDC_MINT_DEVNET, USDC_MINT_MAINNET } from '@float/core';
import { z } from 'zod';

/**
 * USD price feed. Primary source is the Jupiter Price API; a small static
 * fallback covers stablecoins when Jupiter is unreachable. A full Pyth Hermes
 * fallback is a documented TODO (Phase 6 hardening).
 */

const priceSchema = z.object({
  data: z.record(z.object({ price: z.union([z.string(), z.number()]) }).nullable()),
});

const STABLE_USD: Record<string, number> = {
  [USDC_MINT_MAINNET.toBase58()]: 1,
  [USDC_MINT_DEVNET.toBase58()]: 1,
};

const cache = new Map<string, { price: number; at: number }>();
const TTL_MS = 30_000;

export async function getUsdPrice(mint: string): Promise<number | null> {
  const hit = cache.get(mint);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.price;

  try {
    const res = await fetch(`https://api.jup.ag/price/v2?ids=${mint}`);
    if (res.ok) {
      const json = priceSchema.parse(await res.json());
      const entry = json.data[mint];
      if (entry) {
        const p = Number(entry.price);
        if (Number.isFinite(p) && p > 0) {
          cache.set(mint, { price: p, at: Date.now() });
          return p;
        }
      }
    }
  } catch {
    // fall through to static fallback
  }

  const stable = STABLE_USD[mint];
  return stable ?? null;
}

/** USD value of a base-unit amount given its decimals, or null if no price. */
export async function usdValue(
  mint: string,
  amount: bigint,
  decimals: number,
): Promise<number | null> {
  const price = await getUsdPrice(mint);
  if (price === null) return null;
  return (Number(amount) / 10 ** decimals) * price;
}
