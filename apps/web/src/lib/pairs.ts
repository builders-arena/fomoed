import {
  JUP_MINT,
  QUOTE_DECIMALS,
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
  WSOL_MINT,
} from '@float/core/constants';

/**
 * Quote-mint registry for the launch picker. Only `ready` pairs are shown.
 * Seeded from docs/pairs.md; stock-token pairs are added once badged.
 */
export interface Pair {
  mint: string;
  symbol: string;
  decimals: number;
  badgeStatus: 'ready' | 'pending' | 'needs-badge';
  logo?: string;
  riskNote?: string;
}

export function allPairs(cluster: string): Pair[] {
  const usdc = cluster === 'mainnet-beta' ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;
  const pairs: Pair[] = [
    { mint: WSOL_MINT.toBase58(), symbol: 'SOL', decimals: QUOTE_DECIMALS.SOL, badgeStatus: 'ready' },
    { mint: usdc.toBase58(), symbol: 'USDC', decimals: QUOTE_DECIMALS.USDC, badgeStatus: 'ready' },
  ];
  if (cluster === 'mainnet-beta') {
    pairs.push({
      mint: JUP_MINT.toBase58(),
      symbol: 'JUP',
      decimals: QUOTE_DECIMALS.JUP,
      badgeStatus: 'ready',
    });
  }
  return pairs;
}

export function readyPairs(cluster: string): Pair[] {
  return allPairs(cluster).filter((p) => p.badgeStatus === 'ready');
}

export function pairFor(cluster: string, mint: string): Pair | undefined {
  return allPairs(cluster).find((p) => p.mint === mint);
}
