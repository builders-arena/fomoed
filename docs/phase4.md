# Phase 4 — Bots

Status: **code complete**, offline checks green. The money-moving DoD runs on
devnet with Postgres + Redis.

## What exists

- `apps/bots` — one process: BullMQ worker (cycle, payout, buyback, airdrop,
  airdrop-snapshot, migrator) + admin API. Shared `sendTx`/`sendVersionedTx`
  (compute budget, percentile priority fee, blockhash-refresh retries,
  per-attempt `tx_log`, `DRY_RUN`, `idemKey` dedupe).
- `packages/core` — `splitPartnerClaim` (15/35/35/10 over a creator-excluded
  9500 denominator, exact-sum integer split).
- `packages/db` — `tx_log`, `holders_pool`, `flagship_pool`, `traders_pool`,
  and `pool_configs.paused`.
- `apps/bots/src` — `feeds` (Jupiter price + stable fallback), `jupiter`
  (quote/swap), `ledger`, `shared` (clients, wallets, token helpers).

Full operator guide: [runbooks/bots.md](./runbooks/bots.md).

## Definition of done

- [ ] 24h unattended on devnet with 3 coins (SOL, USDC, a Token-2022 quote) and
      ~50 synthetic holders: no duplicate payouts; ledger sums reconcile to
      claimed fees within rounding.
- [ ] Pausing a quote mint stops its payouts/cycle within one interval.
- [ ] Every fund movement has a `tx_log` row linked to its source claim.
- [x] Offline: fee-split math + Jupiter price-impact unit tests, `verify:phase4`.

## Notes / carryovers

- Claimed amount is measured as the fee_claimer quote-ATA delta; in `DRY_RUN`
  the cycle logs the would-be split from accrued metrics but writes no ledger.
- Buyback/airdrop swaps use Jupiter mainnet endpoints; on devnet the swap steps
  are effectively no-ops (no routes) — exercise them on mainnet in Phase 6.
- Pyth price fallback is a stub (static stables only); wire Hermes in Phase 6.
- `cycle` claims to fee_claimer then fans quote out to the bot wallets, so the
  ledger (accounting) matches where tokens physically sit.
