import Link from 'next/link';
import { listCoins } from '@/lib/queries';
import { allPairs, pairFor } from '@/lib/pairs';
import { CLUSTER } from '@/lib/config';
import { formatBaseUnits } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATE_LABEL: Record<number, string> = {
  0: 'Bonding',
  1: 'Curve complete',
  2: 'Vesting',
  3: 'Migrated',
};

export default async function TokensPage({
  searchParams,
}: {
  searchParams: { quote?: string };
}): Promise<JSX.Element> {
  const quote = searchParams.quote;
  const coins = await listCoins(quote);
  const pairs = allPairs(CLUSTER);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tokens</h1>
        <div className="flex gap-2 text-sm">
          <Link href="/tokens" className={!quote ? 'text-accent' : 'text-muted hover:text-white'}>
            All
          </Link>
          {pairs.map((p) => (
            <Link
              key={p.mint}
              href={`/tokens?quote=${p.mint}`}
              className={quote === p.mint ? 'text-accent' : 'text-muted hover:text-white'}
            >
              {p.symbol}
            </Link>
          ))}
        </div>
      </div>

      {coins.length === 0 ? (
        <p className="text-muted">No coins yet. Be the first to launch one.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {coins.map((c) => {
            const pair = pairFor(CLUSTER, c.quoteMint);
            const dec = pair?.decimals ?? 9;
            return (
              <Link key={c.pool} href={`/coin/${c.pool}`} className="card hover:border-accent">
                <div className="flex items-center justify-between">
                  <span className="font-bold">{c.ticker}</span>
                  <span className="text-xs text-muted">{STATE_LABEL[c.migrationState] ?? '—'}</span>
                </div>
                <div className="truncate text-sm text-muted">{c.name}</div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-muted">24h vol</dt>
                    <dd>
                      {formatBaseUnits(BigInt(c.volume24h), dec)} {pair?.symbol ?? ''}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Rewards paid</dt>
                    <dd>
                      {formatBaseUnits(BigInt(c.rewardsPaid), dec)} {pair?.symbol ?? ''}
                    </dd>
                  </div>
                </dl>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
