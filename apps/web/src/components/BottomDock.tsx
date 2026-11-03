'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

function Icon({ name }: { name: string }): ReactNode {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'home':
      return <svg {...common}><path d="M3 11.5 12 4l9 7.5" /><path d="M5 10v9h14v-9" /></svg>;
    case 'plus':
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case 'search':
      return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>;
    case 'chart':
      return <svg {...common}><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></svg>;
    case 'user':
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>;
    default:
      return null;
  }
}

const ITEMS = [
  { href: '/', icon: 'home', label: 'Home', exact: true },
  { href: '/tokens', icon: 'search', label: 'Explore' },
  { href: '/create', icon: 'plus', label: 'Create', primary: true },
  { href: '/analytics', icon: 'chart', label: 'Analytics' },
  { href: '/profile', icon: 'user', label: 'Profile' },
];

export function BottomDock(): JSX.Element {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <nav className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4">
      <div className="flex items-center gap-1 rounded-2xl border border-borderStrong/70 bg-surface/80 p-1.5 shadow-dock backdrop-blur-xl">
        {ITEMS.map((it) => {
          const active = isActive(it.href, it.exact);
          if (it.primary) {
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-label={it.label}
                className="mx-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-black transition-transform hover:scale-105"
              >
                <Icon name={it.icon} />
              </Link>
            );
          }
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-label={it.label}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                active ? 'bg-white/[0.06] text-primary' : 'text-muted hover:bg-white/[0.04] hover:text-ink'
              }`}
            >
              <Icon name={it.icon} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
