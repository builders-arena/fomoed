/** Formatting helpers for the UI edge (base-unit bigints -> human strings). */

export function formatBaseUnits(amount: bigint, decimals: number, maxFrac = 4): string {
  const neg = amount < 0n;
  const a = neg ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  const whole = a / base;
  const frac = a % base;
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, maxFrac).replace(/0+$/, '');
  const wholeStr = whole.toLocaleString('en-US');
  const out = fracStr.length ? `${wholeStr}.${fracStr}` : wholeStr;
  return neg ? `-${out}` : out;
}

export function shortAddr(a: string, n = 4): string {
  return a.length <= 2 * n + 1 ? a : `${a.slice(0, n)}…${a.slice(-n)}`;
}

export function usd(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function solscan(address: string, cluster = 'devnet'): string {
  const suffix = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `https://solscan.io/account/${address}${suffix}`;
}

export function solscanTx(sig: string, cluster = 'devnet'): string {
  const suffix = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `https://solscan.io/tx/${sig}${suffix}`;
}
