import 'server-only';

/**
 * Live USD price of a quote mint, from the Jupiter price API. Falls back to a
 * static value only if the API is unreachable, so the launch curve's market-cap
 * targets ($20k start / $150k graduation) stay accurate as the quote moves.
 */
const FALLBACK: Record<string, number> = { SOL: 150, USDC: 1, JUP: 1 };

export async function getQuoteUsdPrice(mint: string, symbol: string): Promise<number> {
  try {
    const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${mint}`, { cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as Record<string, { usdPrice?: number } | undefined>;
      const price = json[mint]?.usdPrice;
      if (typeof price === 'number' && Number.isFinite(price) && price > 0) return price;
    }
  } catch {
    // fall through to the static fallback
  }
  return FALLBACK[symbol] ?? 1;
}
