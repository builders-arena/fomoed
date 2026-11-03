import Link from 'next/link';
import type { CoinListItem } from '@/lib/queries';
import type { Pair } from '@/lib/pairs';
import { formatBaseUnits } from '@/lib/format';
import { Avatar } from './Avatar';

export function CoinCard({ coin, pair }: { coin: CoinListItem; pair?: Pair }): JSX.Element {
  const dec = pair?.decimals ?? 9;
  const sym = pair?.symbol ?? '';
  const graduated = coin.migrationState >= 3;
  const complete = coin.migrationState >= 1;
  // Rough bonding progress by state until live pool reads are wired per-card.
  const progress = graduated ? 1 : complete ? 0.92 : 0.12;

  return (
    <Link
      href={`/coin/${coin.pool}`}
      className="card group relative overflow-hidden p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40"
    >
      {/* watermark of the paired symbol */}
      <span className="pointer-events-none absolute -right-3 top-1/2 -translate-y-1/2 select-none text-[88px] font-extrabold leading-none text-white/[0.02]">
        {sym}
      </span>

      <div className="relative flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar seed={coin.pool} label={coin.ticker} size={40} />
          <div>
            <div className="font-semibold">${coin.ticker.toUpperCase()}</div>
            <div className="max-w-[9rem] truncate text-xs text-muted">{coin.name}</div>
          </div>
        </div>
        {graduated ? (
          <span className="rounded-full bg-violet/15 px-2.5 py-1 text-[11px] font-semibold text-violet">
            Graduated
          </span>
        ) : (
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            Bonding
          </span>
        )}
      </div>

      <div className="relative mt-4">
        <div className="num text-2xl font-bold tracking-tight">
          {formatBaseUnits(BigInt(coin.volume24h), dec)}{' '}
          <span className="text-sm font-medium text-faint">{sym} 24h</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted">
          Anchored to <span className="font-medium text-ink">{sym}</span>
        </div>
      </div>

      {!graduated && (
        <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
          <div
            className="h-full rounded-full bg-brand"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </Link>
  );
}
