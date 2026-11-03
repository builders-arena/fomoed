import { getAnalytics } from '@/lib/queries';
import { shortAddr } from '@/lib/format';
import { Avatar } from '@/components/Avatar';

export const dynamic = 'force-dynamic';

function big(s: string): string {
  return BigInt(s).toLocaleString('en-US');
}

export default async function AnalyticsPage(): Promise<JSX.Element> {
  const a = await getAnalytics();
  return (
    <div className="flex animate-fade-up flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted">
          Platform totals in quote base units. Numbers reconcile with the ledger.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Fees claimed" value={big(a.totalFees)} accent="primary" />
        <Tile label="Paid to holders" value={big(a.paidToHolders)} accent="violet" />
        <Tile label="Flagship burned" value={big(a.burned)} accent="warn" />
        <Tile label="Airdrop vault" value={big(a.airdropVault)} accent="primary" />
      </div>

      <section className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Trader leaderboard</h2>
          {a.nextAirdrop && (
            <span className="pill">Next airdrop ~{new Date(a.nextAirdrop).toLocaleDateString()}</span>
          )}
        </div>
        {a.leaderboard.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">No round yet.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-border">
            {a.leaderboard.map((r, i) => (
              <li key={r.wallet} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="num w-6 text-sm text-faint">{i + 1}</span>
                  <Avatar seed={r.wallet} label={r.wallet} size={28} />
                  <span className="num text-sm">{shortAddr(r.wallet)}</span>
                </div>
                <span className="num text-sm text-muted">{BigInt(r.volume).toLocaleString('en-US')} vol</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: 'primary' | 'violet' | 'warn';
}): JSX.Element {
  const dot = accent === 'primary' ? 'bg-primary' : accent === 'violet' ? 'bg-violet' : 'bg-warn';
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <span className="stat-label">{label}</span>
      </div>
      <div className="num mt-2 text-2xl font-bold">{value}</div>
    </div>
  );
}
