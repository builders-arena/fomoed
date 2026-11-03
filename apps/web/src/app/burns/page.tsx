import { getBurns } from '@/lib/queries';
import { CLUSTER } from '@/lib/config';
import { shortAddr, solscanTx } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function BurnsPage(): Promise<JSX.Element> {
  const { burns, cumulative } = await getBurns();
  return (
    <div className="flex animate-fade-up flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Burns</h1>
          <p className="mt-1 text-sm text-muted">Flagship bought back and burned from trading fees.</p>
        </div>
        <div className="card px-5 py-3 text-right">
          <div className="stat-label">Cumulative burned</div>
          <div className="num mt-1 text-2xl font-bold gradient-text">
            {BigInt(cumulative).toLocaleString('en-US')}
          </div>
        </div>
      </div>

      {burns.length === 0 ? (
        <div className="card py-16 text-center text-muted">No buybacks yet.</div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-faint">
                <th className="px-5 py-3 font-medium">When</th>
                <th className="px-5 py-3 font-medium">SOL in</th>
                <th className="px-5 py-3 font-medium">Burned</th>
                <th className="px-5 py-3 font-medium">Tx</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {burns.map((b) => (
                <tr key={b.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-3 text-muted">{new Date(b.ts).toLocaleString()}</td>
                  <td className="num px-5 py-3">{(Number(b.solIn) / 1e9).toLocaleString('en-US')} SOL</td>
                  <td className="num px-5 py-3">{BigInt(b.flagshipOut).toLocaleString('en-US')}</td>
                  <td className="px-5 py-3">
                    {b.burnTx ? (
                      <a className="link num" href={solscanTx(b.burnTx, CLUSTER)} target="_blank" rel="noreferrer">
                        {shortAddr(b.burnTx)} ↗
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
