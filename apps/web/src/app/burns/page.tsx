import { getBurns } from '@/lib/queries';
import { CLUSTER } from '@/lib/config';
import { shortAddr, solscanTx } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function BurnsPage(): Promise<JSX.Element> {
  const { burns, cumulative } = await getBurns();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Burns</h1>
        <div className="text-right">
          <div className="text-sm text-muted">Cumulative flagship burned</div>
          <div className="text-xl font-bold text-accent">
            {BigInt(cumulative).toLocaleString('en-US')}
          </div>
        </div>
      </div>

      {burns.length === 0 ? (
        <p className="text-muted">No buybacks yet.</p>
      ) : (
        <div className="card">
          <table className="w-full text-sm">
            <thead className="text-left text-muted">
              <tr>
                <th className="py-2">When</th>
                <th>SOL in</th>
                <th>Flagship burned</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {burns.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="py-2">{new Date(b.ts).toLocaleString()}</td>
                  <td>{(Number(b.solIn) / 1e9).toLocaleString('en-US')} SOL</td>
                  <td>{BigInt(b.flagshipOut).toLocaleString('en-US')}</td>
                  <td>
                    {b.burnTx ? (
                      <a className="text-accent hover:underline" href={solscanTx(b.burnTx, CLUSTER)} target="_blank" rel="noreferrer">
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
