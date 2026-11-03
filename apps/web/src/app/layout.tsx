import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { TopNav } from '@/components/TopNav';
import { BottomDock } from '@/components/BottomDock';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fomoed — coins that pay their holders',
  description: 'Coins paired with tokenized assets. Every trade pays its holders.',
};

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>
          <TopNav />
          <main className="mx-auto w-full max-w-6xl px-4 pb-32 pt-6 sm:px-6">{children}</main>
          <BottomDock />
        </Providers>
      </body>
    </html>
  );
}
