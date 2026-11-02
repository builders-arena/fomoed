import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FEE_SPLIT_BPS } from '@float/core/constants';
import { getCoin } from '@/lib/queries';
import { getPoolSnapshot } from '@/lib/chain';
import { pairFor } from '@/lib/pairs';
import { CLUSTER } from '@/lib/config';
import { formatBaseUnits, pct, shortAddr, solscan } from '@/lib/format';
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
  const snapshot = await getPoolSnapshot(params.pool);
  const pair = pairFor(CLUSTER, coin.quoteMint);
  const dec = pair?.decimals ?? 9;
  const sym = pair?.symbol ?? 'quote';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {coin.ticker} <span className="text-muted">· {coin.name}</span>
          </h1>
          <p className="text-sm text-muted">
            Paired with {sym} · creator {shortAddr(coin.creator)}
          </p>
        </div>
        <CycleButton pool={coin.pool} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <section className="card">
            <h3 className="mb-3 font-semibold">Graduation progress</h3>
            {snapshot ? (
              <>
                <div className="h-3 w-full overflow-hidden rounded-full bg-bg">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${Math.min(100, snapshot.progress * 100).toFixed(1)}%` }}
                  />
                </div>
                <p className="mt-2 text-sm text-muted">
                  {pct(snapshot.progress)} to graduation ·{' '}
                  {snapshot.isMigrated ? 'migrated to DAMM v2' : 'bonding'} · quote reserve{' '}
                  {formatBaseUnits(BigInt(snapshot.quoteReserve), dec)} {sym}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted">Live pool state unavailable (RPC not configured).</p>
            )}
          </section>

          <section className="card">
            <h3 className="mb-3 font-semibold">Fee split</h3>
            <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
              <Split label="Holders" bps={FEE_SPLIT_BPS.HOLDERS} />
              <Split label="Creator" bps={FEE_SPLIT_BPS.CREATOR} />
              <Split label="Flagship" bps={FEE_SPLIT_BPS.FLAGSHIP} />
              <Split label="Traders" bps={FEE_SPLIT_BPS.TRADERS} />
              <Split label="Treasury" bps={FEE_SPLIT_BPS.TREASURY} />
            </ul>
          </section>

          <section className="card grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
            <Stat label="24h volume" value={`${formatBaseUnits(BigInt(coin.volume24h), dec)} ${sym}`} />
            <Stat label="Rewards paid" value={`${formatBaseUnits(BigInt(coin.rewardsPaid), dec)} ${sym}`} />
            <Stat label="Pending to holders" value={`${formatBaseUnits(BigInt(coin.pendingHolders), dec)} ${sym}`} />
            <Stat label="Fees claimed (total)" value={`${formatBaseUnits(BigInt(coin.totalClaimed), dec)} ${sym}`} />
            <Stat label="Swaps" value={String(coin.swapCount)} />
          </section>

          {pair?.riskNote && (
            <section className="card border-yellow-600/40">
              <h3 className="mb-1 font-semibold text-yellow-400">Pair risk notice</h3>
              <p className="text-sm text-muted">{pair.riskNote}</p>
            </section>
          )}

          <div className="flex flex-wrap gap-3 text-sm">
            <a className="text-accent hover:underline" href={solscan(coin.baseMint, CLUSTER)} target="_blank" rel="noreferrer">
              Base mint ↗
            </a>
            <a className="text-accent hover:underline" href={solscan(coin.pool, CLUSTER)} target="_blank" rel="noreferrer">
              Pool ↗
            </a>
            {coin.dammPool && (
              <a className="text-accent hover:underline" href={solscan(coin.dammPool, CLUSTER)} target="_blank" rel="noreferrer">
                DAMM v2 pool ↗
              </a>
            )}
            <Link href="/tokens" className="text-muted hover:text-white">
              ← All tokens
            </Link>
          </div>
        </div>

        <SwapWidget pool={coin.pool} quoteSymbol={sym} quoteDecimals={dec} />
      </div>
    </div>
  );
}

function Split({ label, bps }: { label: string; bps: number }): JSX.Element {
  return (
    <li className="rounded-lg bg-bg p-3 text-center">
      <div className="text-lg font-bold text-accent">{bps / 100}%</div>
      <div className="text-xs text-muted">{label}</div>
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <div className="text-muted">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
