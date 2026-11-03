'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { CLUSTER } from '@/lib/config';
import { Logo } from './Logo';

export function TopNav(): JSX.Element {
  const network = CLUSTER === 'mainnet-beta' ? 'Solana' : 'Devnet';
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-lg font-extrabold tracking-tight">FLOAT</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/docs"
            className="hidden px-2 text-sm font-medium text-muted transition-colors hover:text-ink sm:block"
          >
            Docs
          </Link>
          <span className="pill">
            <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(52,229,164,0.8)]" />
            {network}
          </span>
          <div className="wallet-wrap">
            <WalletMultiButton />
          </div>
        </div>
      </nav>
    </header>
  );
}
