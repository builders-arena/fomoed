'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';

const LINKS = [
  { href: '/tokens', label: 'Tokens' },
  { href: '/create', label: 'Create' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/burns', label: 'Burns' },
  { href: '/profile', label: 'Profile' },
  { href: '/docs', label: 'Docs' },
];

export function Nav(): JSX.Element {
  return (
    <header className="border-b border-border">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-accent">
          Float
        </Link>
        <div className="flex flex-1 flex-wrap items-center gap-4 text-sm text-muted">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">
              {l.label}
            </Link>
          ))}
        </div>
        <WalletMultiButton
          style={{ backgroundColor: '#4ade80', color: '#000', height: 38, borderRadius: 8 }}
        />
      </nav>
    </header>
  );
}
