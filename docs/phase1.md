# Phase 1 — Foundation and first devnet launch

Status: **code complete**, offline checks green. On-chain DoD runs manually
against devnet (needs a funded wallet + RPC).

## What exists

- `packages/core` — `constants`, zod-validated `env`, `connection`, `wallets`,
  and the DBC layer: `buildPartnerConfig` (curve targeting + fee/migration
  config) and a pluggable `ConfigStore` (file-backed for Phase 1, Postgres in
  Phase 3) with `planLaunch` / `recordNewConfig`.
- `scripts` — `launch`, `swap`, `pool-state`, `verify-phase1`.

## Key decisions encoded

- Fixed supply 1,000,000,000, base decimals 6, token authority **Immutable**.
- Base fee fixed **2%**, dynamic fee off, collect-fee-mode **QuoteToken**.
- Migration to **DAMM v2**, migrated pool fee 2%, 100% partner liquidity
  permanently locked, no creator LP, no locked vesting.
- Creator fee: `creatorTradingFeePercentage = 6` (an integer field). The exact
  target is 6.25% of the non-protocol share (= 5% of the total fee); 6 gives
  4.8% of the total fee and the 0.2pp shortfall is folded into the HOLDERS share
  by the bot (see `dbc/config.ts` for the full note).
- Initial MC $20k, migration MC $150k — verified within 2% for SOL@$150 and
  USDC@$1 (`pnpm --filter @float/scripts verify:phase1` and the core unit test).

## Run

```bash
cp .env.example .env            # fill RPC_URL (devnet) + ADMIN_KEYPAIR
pnpm install
pnpm --filter @float/core test
pnpm --filter @float/scripts verify:phase1
```

Devnet launch (DRY_RUN=true simulates; set DRY_RUN=false to send):

```bash
pnpm launch --name "My Coin" --symbol MYC --uri https://example.com/meta.json --quote So11111111111111111111111111111111111111112 --first-buy 0.1
```

```bash
pnpm pool-state --pool <POOL_PUBKEY>
```

```bash
pnpm swap --pool <POOL_PUBKEY> --side buy --amount 0.05 --slippage-bps 100
```

## On-chain definition of done (manual, devnet)

- [ ] `launch --quote <WSOL> --first-buy 0.1` succeeds twice; the second run
      reports `(reuse)` for the config.
- [ ] `pool-state` shows partner fee accruing after buy/sell swaps.
- [x] Unit tests for curve targeting pass.

## Notes / Phase-2 carryovers

- First-buy `minimumAmountOut` is 0 (devnet). Mainnet first buys must set a
  slippage floor from a pre-pool quote.
- `DRY_RUN` of the *create* path only simulates the config tx (the pool tx
  depends on the config existing on chain).
- Quote USD prices fall back to constants (SOL 150, USDC/JUP 1). A live price
  feed replaces these in Phase 4.
