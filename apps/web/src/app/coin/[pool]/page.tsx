import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FEE_SPLIT_BPS, TOTAL_TOKEN_SUPPLY } from '@float/core/constants';
import { getCoin, getCoinSeries } from '@/lib/queries';
import { getPoolSnapshot } from '@/lib/chain';
import { pairFor } from '@/lib/pairs';
import { CLUSTER } from '@/lib/config';
import { compact, compactBase, pct, shortAddr, solscan } from '@/lib/format';
import { Avatar } from '@/components/Avatar';
import { PriceChart } from '@/components/PriceChart';
import { SwapWidget } from '@/components/SwapWidget';
import { CycleButton } from '@/components/CycleButton';

export const dynamic = 'force-dynamic';

export default async function CoinPage({
  params,
}: {
  params: { pool: string };
}): Promise<JSX.Element> {
  const coin = await getCoin(params.pool);
  if (!coin) notFound();
  const pair = pairFor(CLUSTER, coin.quoteMint);
  const dec = pair?.decimals ?? 9;
  const sym = pair?.symbol ?? 'quote';

  const [snapshot, series] = await Promise.all([
    getPoolSnapshot(params.pool),
    getCoinSeries(params.pool, dec),
  ]);

  const graduated = coin.migrationState >= 3;
  const lastPrice = series.length ? series[series.length - 1]!.v : null;
  const fdv = lastPrice !== null ? compact(lastPrice * TOTAL_TOKEN_SUPPLY) : '—';

  return (
    <div className="flex animate-fade-up flex-col gap-5">
      {/* breadcrumb */}
      <div className="flex items-center justify-between text-sm text-muted">
        <Link href="/tokens" className="flex items-center gap-1.5 hover:text-ink">
          <span className="text-lg leading-none">‹</span> Tokens
        </Link>
        <span className="num text-faint">{shortAddr(coin.pool, 6)}</span>
      </div>

      {/* header */}
      <div className="card flex items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-4">
          <Avatar seed={coin.pool} label={coin.ticker} size={52} />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold">${coin.ticker.toUpperCase()}</span>
              <span className="text-muted">{coin.name}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="pill">Anchored to <span className="font-semibold text-ink">{sym}</span></span>
              {graduated ? (
                <span className="rounded-full bg-violet/15 px-2.5 py-1 text-[11px] font-semibold text-violet">Graduated</span>
              ) : (
                <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">Bonding</span>
              )}
            </div>
          </div>
        </div>
        <CycleButton pool={coin.pool} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <div className="flex flex-col gap-5">
          {/* chart */}
          <div className="card p-5">
            <div className="mb-4 flex items-start justify-between">
              <div className="flex gap-1 rounded-lg border border-border bg-black/20 p-1 text-xs">
                {['1H', '4H', '1D', '7D', 'ALL'].map((t) => (
                  <span
                    key={t}
                    className={`rounded px-2.5 py-1 font-medium ${t === 'ALL' ? 'bg-white/[0.07] text-ink' : 'text-faint'}`}
                  >
                    {t}
                  </span>
                ))}
              </div>
              <div className="text-right">
                <div className="num text-2xl font-bold">
                  {fdv} <span className="text-sm font-medium text-faint">{sym} FDV</span>
                </div>
              </div>
            </div>
            <PriceChart points={series} />
          </div>

          {/* graduation / progress */}
          <div className="card p-5">
            {graduated ? (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Graduated to DAMM v2</h3>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-primary">
                    🔒 Liquidity permanently locked
                  </p>
                </div>
                {coin.dammPool && (
                  <a className="link num text-sm" href={solscan(coin.dammPool, CLUSTER)} target="_blank" rel="noreferrer">
                    Pool {shortAddr(coin.dammPool)} ↗
                  </a>
                )}
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Graduation progress</h3>
                  <span className="num text-sm text-muted">
                    {snapshot ? pct(snapshot.progress) : '—'}
                  </span>
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${snapshot ? Math.min(100, snapshot.progress * 100).toFixed(1) : 0}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-muted">
                  {snapshot
                    ? `Quote reserve ${compactBase(BigInt(snapshot.quoteReserve), dec)} ${sym} — graduates into a locked DAMM v2 pool.`
                    : 'Live pool state unavailable.'}
                </p>
              </>
            )}
          </div>

          {/* fees */}
          <div className="card p-5">
            <h3 className="font-semibold">Fees</h3>
            <p className="mt-0.5 text-xs text-muted">
              Creator <span className="num">{shortAddr(coin.creator)}</span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="stat">
                <div className="stat-label">Claimed</div>
                <div className="stat-value">
                  {compactBase(BigInt(coin.totalClaimed), dec)} <span className="text-sm text-faint">{sym}</span>
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">Pending to holders</div>
                <div className="stat-value">
                  {compactBase(BigInt(coin.pendingHolders), dec)} <span className="text-sm text-faint">{sym}</span>
                </div>
              </div>
            </div>
          </div>

          {/* holder rewards */}
          <div className="card p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
              <span className="text-primary">Holder rewards</span>
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span className="text-faint">active</span>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <div className="stat-label">Paid to holders</div>
                <div className="num mt-1 text-3xl font-bold">
                  {compactBase(BigInt(coin.rewardsPaid), dec)} <span className="text-base text-faint">{sym}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="stat-label">Waiting in pot</div>
                <div className="num mt-1 text-lg font-semibold">
                  {compactBase(BigInt(coin.pendingHolders), dec)} {sym}
                </div>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Paid in {sym} every few minutes to everyone holding ${coin.ticker.toUpperCase()}, in
              proportion to how much they hold.
            </p>
          </div>

          {/* fee split + about */}
          <div className="card p-5">
            <h3 className="mb-3 font-semibold">Fee split</h3>
            <div className="grid grid-cols-5 gap-2 text-center">
              {[
                ['Holders', FEE_SPLIT_BPS.HOLDERS],
                ['Creator', FEE_SPLIT_BPS.CREATOR],
                ['Flagship', FEE_SPLIT_BPS.FLAGSHIP],
                ['Traders', FEE_SPLIT_BPS.TRADERS],
                ['Treasury', FEE_SPLIT_BPS.TREASURY],
              ].map(([label, bps]) => (
                <div key={label as string} className="rounded-xl bg-white/[0.02] p-3">
                  <div className="num text-lg font-bold text-primary">{(bps as number) / 100}%</div>
                  <div className="text-[11px] text-faint">{label}</div>
                </div>
              ))}
            </div>
            <div className="divider mt-4 pt-4 text-sm">
              <div className="flex flex-wrap gap-4">
                <a className="link" href={solscan(coin.baseMint, CLUSTER)} target="_blank" rel="noreferrer">
                  Base mint ↗
                </a>
                <a className="link" href={solscan(coin.pool, CLUSTER)} target="_blank" rel="noreferrer">
                  Pool ↗
                </a>
                <span className="text-faint">·</span>
                <span className="text-muted">{coin.swapCount} swaps</span>
              </div>
            </div>
          </div>
        </div>

        {/* swap */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <SwapWidget pool={coin.pool} quoteSymbol={sym} quoteDecimals={dec} />
        </div>
      </div>
    </div>
  );
}
