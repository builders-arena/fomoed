import Link from 'next/link';
import { FEE_SPLIT_BPS, TRADING_FEE_BPS } from '@float/core/constants';
import { Logo } from '@/components/Logo';

const SPLIT = [
  { label: 'Holders', bps: FEE_SPLIT_BPS.HOLDERS },
  { label: 'Flagship', bps: FEE_SPLIT_BPS.FLAGSHIP },
  { label: 'Traders', bps: FEE_SPLIT_BPS.TRADERS },
  { label: 'Treasury', bps: FEE_SPLIT_BPS.TREASURY },
  { label: 'Creator', bps: FEE_SPLIT_BPS.CREATOR },
];

export default function HomePage(): JSX.Element {
  return (
    <div className="flex flex-col items-center">
      <section className="flex animate-fade-up flex-col items-center py-16 text-center sm:py-24">
        <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft shadow-glow">
          <Logo size={40} />
        </div>
        <h1 className="max-w-3xl text-balance text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl">
          Coins that pay <span className="gradient-text">their holders.</span>
        </h1>
        <p className="mt-5 max-w-xl text-balance text-base leading-relaxed text-muted sm:text-lg">
          Launch a coin paired with SOL, USDC or a tokenized stock. Every trade&apos;s{' '}
          {TRADING_FEE_BPS / 100}% fee flows back — to holders, the buyback, traders, and you.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/tokens" className="btn px-6 py-3 text-base">
            Explore tokens
          </Link>
          <Link href="/create" className="btn-ghost px-6 py-3 text-base">
            Launch a coin
          </Link>
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-2.5">
          {SPLIT.map((s) => (
            <div key={s.label} className="pill gap-2 py-1.5">
              <span className="num font-semibold text-primary">{s.bps / 100}%</span>
              <span className="text-faint">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        <Feature
          title="Deep liquidity, day one"
          body="Bonding-curve pricing from the first trade, then graduation into a locked DAMM v2 pool."
        />
        <Feature
          title="Fees paid back"
          body="Holders earn their share of every trade in the paired token, automatically and pro-rata."
        />
        <Feature
          title="Paired with real assets"
          body="Anchor to SOL, USDC, or tokenized stocks — the coin trades against something real."
        />
      </section>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }): JSX.Element {
  return (
    <div className="card-pad">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}
