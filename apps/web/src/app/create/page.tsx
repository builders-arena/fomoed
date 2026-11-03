'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Transaction } from '@solana/web3.js';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { readyPairs } from '@/lib/pairs';
import { CLUSTER } from '@/lib/config';
import { Avatar } from '@/components/Avatar';

function decodeTx(b64: string): Transaction {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return Transaction.from(bytes);
}

const STEPS = ['Uploading', 'Preparing', 'Signing', 'Registering', 'Done'];

export default function CreatePage(): JSX.Element {
  const { connection } = useConnection();
  const wallet = useWallet();
  const router = useRouter();
  const pairs = useMemo(() => readyPairs(CLUSTER), []);
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [quoteMint, setQuoteMint] = useState(pairs[0]?.mint ?? '');
  const [firstBuy, setFirstBuy] = useState('');
  const [step, setStep] = useState(-1);
  const [error, setError] = useState<string | null>(null);

  const quoteSym = pairs.find((p) => p.mint === quoteMint)?.symbol ?? '';
  const busy = step >= 0 && step < STEPS.length - 1;
  const tickerValid = /^[A-Za-z0-9]{1,10}$/.test(symbol);
  const canSubmit = name.trim() && tickerValid && file && quoteMint && !busy;

  function onPick(f: File | null): void {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('Please choose an image file.');
    if (f.size > 2_000_000) return setError('Image must be under 2 MB.');
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!wallet.publicKey || !wallet.sendTransaction || !file) return;
    try {
      // 1. upload image → metadata URI
      setStep(0);
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', name);
      fd.append('symbol', symbol);
      fd.append('description', description);
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const upData = await up.json();
      if (!up.ok) throw new Error(upData.error ?? 'image upload failed');

      // 2. build launch tx(s)
      setStep(1);
      const res = await fetch('/api/launch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name,
          symbol,
          uri: upData.uri,
          quoteMint,
          creator: wallet.publicKey.toBase58(),
          firstBuy: firstBuy || '0',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'launch failed');

      // 3. sign + send
      setStep(2);
      let configTx: string | undefined;
      for (let i = 0; i < data.txs.length; i++) {
        const tx = decodeTx(data.txs[i]);
        const sig = await wallet.sendTransaction(tx, connection);
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
        if (i === 0 && data.mode === 'create') configTx = sig;
      }

      // 4. register
      setStep(3);
      await fetch('/api/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          coin: { ...data.coin, creatorWallet: wallet.publicKey.toBase58() },
          configTx,
        }),
      });

      setStep(4);
      router.push(`/coin/${data.coin.pool}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep(-1);
    }
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight">Launch a coin</h1>
        <p className="mt-1 text-sm text-muted">
          A fair bonding curve from the first trade. You pay only the pool rent.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <form onSubmit={submit} className="card flex flex-col gap-5 p-6">
          {/* image + name/ticker */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-borderStrong bg-black/20 text-center text-[11px] text-faint transition-colors hover:border-primary/60"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="logo" className="h-full w-full object-cover" />
              ) : (
                <span className="px-2">Upload image</span>
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
            <div className="flex flex-1 flex-col gap-4">
              <Field label="Name">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Capycoin" maxLength={48} />
              </Field>
              <Field label="Ticker" hint={symbol && !tickerValid ? '1–10 letters/numbers' : undefined}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">$</span>
                  <input
                    className="input pl-7 uppercase"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                    placeholder="CAPY"
                    maxLength={10}
                  />
                </div>
              </Field>
            </div>
          </div>

          <Field label="Description (optional)">
            <textarea
              className="input min-h-[72px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this coin about?"
              maxLength={500}
            />
          </Field>

          <Field label="Pair">
            <div className="flex flex-wrap gap-2">
              {pairs.map((p) => (
                <button
                  type="button"
                  key={p.mint}
                  onClick={() => setQuoteMint(p.mint)}
                  className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                    quoteMint === p.mint
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted hover:border-borderStrong hover:text-ink'
                  }`}
                >
                  {p.symbol}
                </button>
              ))}
            </div>
          </Field>

          <Field label={`First buy (optional, in ${quoteSym})`}>
            <input className="input" value={firstBuy} onChange={(e) => setFirstBuy(e.target.value)} placeholder="0.0" inputMode="decimal" />
          </Field>

          {error && <p className="rounded-xl border border-down/30 bg-down/5 px-4 py-3 text-sm text-down">{error}</p>}

          {!wallet.publicKey ? (
            <div className="wallet-wrap [&_.wallet-adapter-button]:!h-12 [&_.wallet-adapter-button]:!w-full [&_.wallet-adapter-button]:!justify-center">
              <WalletMultiButton>Connect wallet to launch</WalletMultiButton>
            </div>
          ) : (
            <button type="submit" disabled={!canSubmit} className="btn h-12 w-full text-base">
              {busy ? STEPS[step] + '…' : 'Launch coin'}
            </button>
          )}

          {step >= 0 && (
            <div className="flex items-center justify-between gap-2 pt-1">
              {STEPS.map((s, i) => (
                <div key={s} className="flex flex-1 items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i <= step ? 'bg-primary text-black' : 'bg-white/[0.06] text-faint'}`}>
                    {i + 1}
                  </span>
                  {i < STEPS.length - 1 && <span className={`h-px flex-1 ${i < step ? 'bg-primary' : 'bg-border'}`} />}
                </div>
              ))}
            </div>
          )}
        </form>

        {/* live preview */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <div className="stat-label mb-4">Preview</div>
            <div className="flex items-center gap-3">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="logo" className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <Avatar seed={symbol || name || 'x'} label={symbol || '?'} size={48} />
              )}
              <div>
                <div className="font-bold">${(symbol || 'TICKER').toUpperCase()}</div>
                <div className="max-w-[12rem] truncate text-sm text-muted">{name || 'Coin name'}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="pill">Anchored to <span className="font-semibold text-ink">{quoteSym}</span></span>
              <span className="pill">1B supply</span>
              <span className="pill">2% fee</span>
            </div>
            <div className="divider mt-5 pt-5 text-sm text-muted">
              <p className="leading-relaxed">
                Trading opens immediately on a bonding curve. At ~$150k it graduates into a locked
                DAMM v2 pool, and holders earn {quoteSym} from every trade.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="label mb-0">{label}</label>
        {hint && <span className="text-xs text-down">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
