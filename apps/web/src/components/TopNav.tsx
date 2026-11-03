'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { Logo } from './Logo';

export function TopNav(): JSX.Element {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-lg font-extrabold tracking-tight">Fomoed</span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/docs"
            className="hidden px-2 text-sm font-medium text-muted transition-colors hover:text-ink sm:block"
          >
            Docs
          </Link>
          <a
            href="https://x.com/fomoedx"
            target="_blank"
            rel="noreferrer"
            aria-label="Fomoed on X"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:border-borderStrong hover:text-ink"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <div className="wallet-wrap">
            <WalletMultiButton />
          </div>
        </div>
      </nav>
    </header>
  );
}
