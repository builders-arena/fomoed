import { getAnalytics } from '@/lib/queries';
import { shortAddr } from '@/lib/format';

export const dynamic = 'force-dynamic';

function big(s: string): string {
  return BigInt(s).toLocaleString('en-US');
}

export default async function AnalyticsPage(): Promise<JSX.Element> {
  const a = await getAnalytics();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Analytics</h1>
      <p className="text-sm text-muted">
        Platform totals in quote base units (mixed mints). Numbers reconcile with Postgres
        aggregates.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Fees claimed" value={big(a.totalFees)} />
        <Tile label="Paid to holders" value={big(a.paidToHolders)} />
        <Tile label="Flagship burned" value={big(a.burned)} />
        <Tile label="Airdrop vault" value={big(a.airdropVault)} />
      </div>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Trader leaderboard (current round)</h2>
          {a.nextAirdrop && (
            <span className="text-sm text-muted">
              Next airdrop ~{new Date(a.nextAirdrop).toLocaleString()}
            </span>
          )}
        </div>
        {a.leaderboard.length === 0 ? (
          <p className="text-sm text-muted">No round yet.</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {a.leaderboard.map((r, i) => (
              <li key={r.wallet} className="flex justify-between border-b border-border py-1">
                <span>
                  {i + 1}. {shortAddr(r.wallet)}
                </span>
                <span className="text-muted">{BigInt(r.volume).toLocaleString('en-US')} vol</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="card">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}
