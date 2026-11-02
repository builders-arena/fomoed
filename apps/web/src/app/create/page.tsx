'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { readyPairs } from '@/lib/pairs';
import { CLUSTER } from '@/lib/config';

function decodeTx(b64: string): Transaction {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return Transaction.from(bytes);
}

export default function CreatePage(): JSX.Element {
  const { connection } = useConnection();
  const wallet = useWallet();
  const router = useRouter();
  const pairs = readyPairs(CLUSTER);

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [uri, setUri] = useState('');
  const [quoteMint, setQuoteMint] = useState(pairs[0]?.mint ?? '');
  const [firstBuy, setFirstBuy] = useState('0');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!wallet.publicKey || !wallet.sendTransaction) {
      setStatus('Connect a wallet first.');
      return;
    }
    setBusy(true);
    setStatus('Preparing launch…');
    try {
      const res = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          symbol,
          uri,
          quoteMint,
          creator: wallet.publicKey.toBase58(),
          firstBuy,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'launch failed');

      let configTx: string | undefined;
      for (let i = 0; i < data.txs.length; i++) {
        const tx = decodeTx(data.txs[i]);
        setStatus(`Confirm transaction ${i + 1}/${data.txs.length}…`);
        const sig = await wallet.sendTransaction(tx, connection);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
        if (i === 0 && data.mode === 'create') configTx = sig;
      }

      setStatus('Registering coin…');
      await fetch('/api/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          coin: { ...data.coin, creatorWallet: wallet.publicKey.toBase58() },
          configTx,
        }),
      });

      router.push(`/coin/${data.coin.pool}`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-bold">Launch a coin</h1>
      <form onSubmit={submit} className="card flex flex-col gap-4">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Ticker (1–10 alphanumerics)</label>
          <input
            className="input"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            pattern="[A-Za-z0-9]{1,10}"
            required
          />
        </div>
        <div>
          <label className="label">Metadata URI (JSON with image + socials)</label>
          <input
            className="input"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="https://…/metadata.json"
            required
          />
        </div>
        <div>
          <label className="label">Pair</label>
          <select className="input" value={quoteMint} onChange={(e) => setQuoteMint(e.target.value)}>
            {pairs.map((p) => (
              <option key={p.mint} value={p.mint}>
                {p.symbol}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">First buy (optional)</label>
          <input
            className="input"
            value={firstBuy}
            onChange={(e) => setFirstBuy(e.target.value)}
            inputMode="decimal"
          />
        </div>
        <button className="btn" disabled={busy} type="submit">
          {busy ? 'Launching…' : 'Launch'}
        </button>
        {status && <p className="text-sm text-muted">{status}</p>}
      </form>
    </div>
  );
}
