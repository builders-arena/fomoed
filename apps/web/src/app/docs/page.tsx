import {
  BASE_TOKEN_DECIMALS,
  DAMM_V2_PROGRAM_ID,
  DBC_PROGRAM_ID,
  FEE_SPLIT_BPS,
  getFlagshipMint,
  INITIAL_MARKET_CAP_USD,
  MIGRATION_MARKET_CAP_USD,
  TOTAL_TOKEN_SUPPLY,
  TRADING_FEE_BPS,
} from '@float/core/constants';
import { shortAddr } from '@/lib/format';

const SPLIT = [
  { label: 'Holders', bps: FEE_SPLIT_BPS.HOLDERS, color: '#F54B00' },
  { label: 'Flagship', bps: FEE_SPLIT_BPS.FLAGSHIP, color: '#6E45FF' },
  { label: 'Traders', bps: FEE_SPLIT_BPS.TRADERS, color: '#9E83FF' },
  { label: 'Treasury', bps: FEE_SPLIT_BPS.TREASURY, color: '#F5BD00' },
  { label: 'Creator', bps: FEE_SPLIT_BPS.CREATOR, color: '#24C98D' },
];

const STEPS = [
  { n: '01', title: 'Launch on a curve', body: 'Create a coin in seconds. Trading opens on a fair bonding curve, paired with a real asset.' },
  { n: '02', title: 'Trade', body: 'Buy and sell with live pricing. Every trade pays a 2% fee that flows back to the ecosystem.' },
  { n: '03', title: 'Graduate', body: 'At ~$150k the curve completes and liquidity migrates into a permanently-locked DAMM v2 pool.' },
  { n: '04', title: 'Earn', body: 'Holders are paid their share of fees in the paired token, automatically and pro-rata.' },
];

export default function DocsPage(): JSX.Element {
  return (
    <div className="flex animate-fade-up flex-col gap-10">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">How Float works</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Coins paired with real assets, with deep liquidity from the first trade — and fees that
          flow back to the people holding and trading them.
        </p>
      </header>

      {/* Fee split */}
      <section>
        <SectionTitle>Fee split</SectionTitle>
        <div className="card p-6">
          <p className="text-sm text-muted">
            Every trade pays a <span className="font-semibold text-ink">{TRADING_FEE_BPS / 100}%</span>{' '}
            fee. After Meteora&apos;s protocol cut, the platform share is split five ways:
          </p>
          <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full">
            {SPLIT.map((s) => (
              <div key={s.label} style={{ width: `${s.bps / 100}%`, background: s.color }} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {SPLIT.map((s) => (
              <div key={s.label} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                <span className="text-sm">
                  <span className="num font-semibold">{s.bps / 100}%</span>{' '}
                  <span className="text-muted">{s.label}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-faint">
            The creator&apos;s share is paid trustlessly on-chain; the rest is distributed by the
            protocol.
          </p>
        </div>
      </section>

      {/* Lifecycle */}
      <section>
        <SectionTitle>From idea to liquid market</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-5">
              <div className="gradient-text text-2xl font-extrabold">{s.n}</div>
              <h3 className="mt-2 font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Token economics */}
      <section>
        <SectionTitle>Token economics</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Spec label="Supply" value={TOTAL_TOKEN_SUPPLY.toLocaleString('en-US')} />
          <Spec label="Decimals" value={String(BASE_TOKEN_DECIMALS)} />
          <Spec label="Token authority" value="Immutable" />
          <Spec label="Start market cap" value={`$${INITIAL_MARKET_CAP_USD.toLocaleString('en-US')}`} />
          <Spec label="Graduation" value={`$${MIGRATION_MARKET_CAP_USD.toLocaleString('en-US')}`} />
          <Spec label="On graduation" value="Locked DAMM v2" />
        </div>
      </section>

      {/* Risks */}
      <section>
        <SectionTitle>Risks</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <Risk title="Volatile prices" body="Bonding-curve coins can lose value quickly. Only trade what you can afford to lose." />
          <Risk title="Issuer controls" body="Tokenized-stock pairs may be pausable or carry a transfer fee set by their issuer." />
          <Risk title="Off-chain distribution" body="Fee distribution runs in a bot in v1 — not yet an on-chain program." />
        </div>
      </section>

      {/* Addresses */}
      <section>
        <SectionTitle>Contract addresses</SectionTitle>
        <div className="card divide-y divide-border p-2">
          <Addr label="DBC program" value={DBC_PROGRAM_ID.toBase58()} />
          <Addr label="DAMM v2 program" value={DAMM_V2_PROGRAM_ID.toBase58()} />
          {getFlagshipMint() && <Addr label="Flagship mint" value={getFlagshipMint()!.toBase58()} />}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): JSX.Element {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-faint">{children}</h2>;
}

function Spec({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function Risk({ title, body }: { title: string; body: string }): JSX.Element {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-warn">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function Addr({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="num text-xs text-ink" title={value}>
        {shortAddr(value, 8)}
      </span>
    </div>
  );
}
