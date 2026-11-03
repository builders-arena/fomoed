'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { shortAddr } from '@/lib/format';
import { Avatar } from '@/components/Avatar';

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

  if (!publicKey) {
    return (
      <div className="card flex flex-col items-center gap-4 py-20 text-center">
        <p className="text-muted">Connect a wallet to see your profile.</p>
        <div className="wallet-wrap">
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  const rewardsTotal = data?.rewards.length ?? 0;

  return (
    <div className="flex animate-fade-up flex-col gap-6">
      <div className="flex items-center gap-4">
        <Avatar seed={publicKey.toBase58()} label={publicKey.toBase58()} size={48} />
        <div>
          <h1 className="text-xl font-bold">Profile</h1>
          <p className="num text-sm text-muted">{shortAddr(publicKey.toBase58(), 6)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Coins launched" value={String(data?.created.length ?? 0)} />
        <Tile label="Rewards received" value={String(rewardsTotal)} />
        <Tile label="Airdrops received" value={String(data?.airdrops.length ?? 0)} />
        <Tile label="Dev fees" value="—" />
      </div>

      <Section title="Coins you launched" subtitle="Coins you launched or that pay you creator fees.">
        {!data ? (
          <Empty>Loading…</Empty>
        ) : data.created.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-muted">No coins yet. Launch one to start earning fees.</p>
            <Link href="/create" className="btn">
              Launch a coin
            </Link>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {data.created.map((c) => (
              <Link
                key={c.pool}
                href={`/coin/${c.pool}`}
                className="flex items-center gap-3 py-3 transition-colors hover:text-primary"
              >
                <Avatar seed={c.pool} label={c.ticker} size={32} />
                <span className="font-semibold">${c.ticker.toUpperCase()}</span>
                <span className="text-sm text-muted">{c.name}</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      <Section title="Rewards & airdrops" subtitle="Holder rewards and trader airdrops paid to you.">
        {!data || (data.rewards.length === 0 && data.airdrops.length === 0) ? (
          <Empty>Nothing yet. Hold a Float coin or trade to earn.</Empty>
        ) : (
          <div className="flex flex-col divide-y divide-border text-sm">
            {data.rewards.map((r, i) => (
              <Row key={`r${i}`} left={`Reward · ${shortAddr(r.coin)}`} right={BigInt(r.amount).toLocaleString('en-US')} />
            ))}
            {data.airdrops.map((a, i) => (
              <Row key={`a${i}`} left={`Airdrop · ${shortAddr(a.mint)}`} right={BigInt(a.amount).toLocaleString('en-US')} />
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }): JSX.Element {
  return (
    <section>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-faint">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="card mt-3 p-5">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }): JSX.Element {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}

function Row({ left, right }: { left: string; right: string }): JSX.Element {
  return (
    <div className="flex justify-between py-2.5">
      <span>{left}</span>
      <span className="num text-muted">{right}</span>
    </div>
  );
}
