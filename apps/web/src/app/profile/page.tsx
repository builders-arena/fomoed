'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { shortAddr } from '@/lib/format';

interface ProfileData {
  created: Array<{ pool: string; ticker: string; name: string }>;
  rewards: Array<{ coin: string; mint: string; amount: string; tx: string | null }>;
  airdrops: Array<{ mint: string; amount: string; tx: string | null }>;
}

export default function ProfilePage(): JSX.Element {
  const { publicKey } = useWallet();
  const [data, setData] = useState<ProfileData | null>(null);

  useEffect(() => {
    if (!publicKey) {
      setData(null);
      return;
    }
    fetch(`/api/profile?wallet=${publicKey.toBase58()}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [publicKey]);

  if (!publicKey) return <p className="text-muted">Connect a wallet to see your profile.</p>;
  if (!data) return <p className="text-muted">Loading…</p>;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Profile · {shortAddr(publicKey.toBase58())}</h1>

      <Section title="Coins you launched">
        {data.created.length === 0 ? (
          <Empty>No launches yet.</Empty>
        ) : (
          data.created.map((c) => (
            <Link key={c.pool} href={`/coin/${c.pool}`} className="flex justify-between py-1 hover:text-accent">
              <span>{c.ticker}</span>
              <span className="text-muted">{c.name}</span>
            </Link>
          ))
        )}
      </Section>

      <Section title="Holder rewards received">
        {data.rewards.length === 0 ? (
          <Empty>No rewards yet.</Empty>
        ) : (
          data.rewards.map((r, i) => (
            <div key={i} className="flex justify-between py-1 text-sm">
              <span>{shortAddr(r.coin)}</span>
              <span className="text-muted">{BigInt(r.amount).toLocaleString('en-US')}</span>
            </div>
          ))
        )}
      </Section>

      <Section title="Airdrops received">
        {data.airdrops.length === 0 ? (
          <Empty>No airdrops yet.</Empty>
        ) : (
          data.airdrops.map((a, i) => (
            <div key={i} className="flex justify-between py-1 text-sm">
              <span>{shortAddr(a.mint)}</span>
              <span className="text-muted">{BigInt(a.amount).toLocaleString('en-US')}</span>
            </div>
          ))
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="card">
      <h2 className="mb-2 font-semibold">{title}</h2>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="text-sm text-muted">{children}</p>;
}
