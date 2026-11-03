import Link from 'next/link';
import { listCoins } from '@/lib/queries';
import { allPairs, pairFor } from '@/lib/pairs';
import { CLUSTER } from '@/lib/config';
import { CoinCard } from '@/components/CoinCard';

export const dynamic = 'force-dynamic';

export default async function TokensPage({
  searchParams,
}: {
  searchParams: { quote?: string; tab?: string };
}): Promise<JSX.Element> {
  const quote = searchParams.quote;
  const tab = searchParams.tab ?? 'all';
  const pairs = allPairs(CLUSTER);

  let coins = await listCoins(quote);
  if (tab === 'bonding') coins = coins.filter((c) => c.migrationState < 3);
  if (tab === 'graduated') coins = coins.filter((c) => c.migrationState >= 3);

  const mkHref = (next: Partial<{ quote: string; tab: string }>) => {
    const p = new URLSearchParams();
    const q = next.quote ?? quote;
    const t = next.tab ?? tab;
    if (q) p.set('quote', q);
    if (t && t !== 'all') p.set('tab', t);
    const s = p.toString();
    return s ? `/tokens?${s}` : '/tokens';
  };

  return (
    <div className="flex animate-fade-up flex-col gap-6">
      {/* Hero banner */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface2 to-surface p-8">
        <div className="absolute inset-0 -z-10 bg-brand-soft opacity-60" />
        <div className="relative max-w-lg">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Launch coins on top of real assets.
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Pair your coin with SOL, USDC or a tokenized stock. Deep liquidity from the first trade,
            and holders earn a share of every trade.
          </p>
          <Link href="/create" className="btn mt-5">
            Launch a coin
          </Link>
        </div>
      </section>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-border bg-surface/60 p-1 text-sm">
          {[
            ['all', 'All'],
            ['bonding', 'Bonding'],
            ['graduated', 'Graduated'],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={mkHref({ tab: key })}
              className={`rounded-lg px-3.5 py-1.5 font-medium transition-colors ${
                tab === key ? 'bg-white/[0.06] text-ink' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="mr-1 text-faint">Pair</span>
          <Link
            href={mkHref({ quote: '' })}
            className={`pill ${!quote ? 'border-primary/50 text-primary' : ''}`}
          >
            All
          </Link>
          {pairs.map((p) => (
            <Link
              key={p.mint}
              href={mkHref({ quote: p.mint })}
              className={`pill ${quote === p.mint ? 'border-primary/50 text-primary' : ''}`}
            >
              {p.symbol}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid */}
      {coins.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-muted">No coins here yet.</p>
          <Link href="/create" className="btn">
            Be the first to launch
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coins.map((c) => (
            <CoinCard key={c.pool} coin={c} pair={pairFor(CLUSTER, c.quoteMint)} />
          ))}
        </div>
      )}
    </div>
  );
}
