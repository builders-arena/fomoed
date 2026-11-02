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

export default function DocsPage(): JSX.Element {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-bold">How Float works</h1>

      <section className="card">
        <h2 className="mb-2 font-semibold">Fee split</h2>
        <p className="text-sm text-muted">
          Every trade pays a {TRADING_FEE_BPS / 100}% fee. After Meteora&apos;s protocol cut, the
          platform-controlled share is split:
        </p>
        <ul className="mt-2 text-sm">
          <li>Holders — {FEE_SPLIT_BPS.HOLDERS / 100}%</li>
          <li>Creator — {FEE_SPLIT_BPS.CREATOR / 100}% (paid trustlessly on-chain)</li>
          <li>Flagship buyback &amp; burn — {FEE_SPLIT_BPS.FLAGSHIP / 100}%</li>
          <li>Trader airdrop — {FEE_SPLIT_BPS.TRADERS / 100}%</li>
          <li>Treasury — {FEE_SPLIT_BPS.TREASURY / 100}%</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Token economics</h2>
        <ul className="text-sm">
          <li>Fixed supply: {TOTAL_TOKEN_SUPPLY.toLocaleString('en-US')}</li>
          <li>Decimals: {BASE_TOKEN_DECIMALS}</li>
          <li>Token authority: Immutable</li>
          <li>Start market cap: ${INITIAL_MARKET_CAP_USD.toLocaleString('en-US')}</li>
          <li>Graduation market cap: ${MIGRATION_MARKET_CAP_USD.toLocaleString('en-US')}</li>
          <li>On graduation: migrate to DAMM v2, 100% partner liquidity permanently locked</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Risks</h2>
        <ul className="list-disc pl-5 text-sm text-muted">
          <li>Tokenized-stock quote mints may be pausable or carry a transfer fee by their issuer.</li>
          <li>Fee distribution runs in a bot in v1 (not yet an on-chain program).</li>
          <li>Prices are volatile; bonding-curve coins can lose value quickly.</li>
        </ul>
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">Contract addresses</h2>
        <ul className="break-all font-mono text-xs text-muted">
          <li>DBC program: {DBC_PROGRAM_ID.toBase58()}</li>
          <li>DAMM v2 program: {DAMM_V2_PROGRAM_ID.toBase58()}</li>
          {getFlagshipMint() && <li>Flagship mint: {getFlagshipMint()?.toBase58()}</li>}
        </ul>
      </section>
    </div>
  );
}
