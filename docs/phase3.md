# Phase 3 — Database and indexer

Status: **code complete**, offline checks green. End-to-end runs against
Postgres + a Helius webhook + devnet.

## What exists

- `packages/db` — Prisma schema (pool_configs, coins, swaps, holders,
  fee_claims, payout_rounds, payouts, buybacks, airdrop_rounds, airdrops,
  cursor) with `(pool, ts)` / `(wallet, ts)` indexes. Exports the `prisma`
  singleton, `PrismaConfigStore` (implements core's `ConfigStore`), and
  `registerCoin`.
- `packages/indexer` — a pure Anchor-coder event `parser` (DBC + DAMM v2
  `EvtSwap2` / `EvtCurveComplete` / `EvtInitializePool`), a `handler` that
  resolves the coin, writes swaps idempotently on `(sig, eventIndex)`, and
  applies holder deltas in the same transaction, and a Fastify `server`
  (`POST /webhook`, bearer-auth) with an out-of-order-safe cursor.
- `scripts` — `register-coin`, `resnapshot-holders` (Token-2022 aware),
  `backfill` (replays history through the same handler).

## Run

```bash
docker compose -f infra/docker-compose.yml up -d
```

```bash
pnpm --filter @float/db migrate:dev --name init
```

```bash
pnpm --filter @float/indexer start   # serves POST /webhook on :8787
```

Point a Helius webhook (DBC + DAMM v2 program IDs) at `/webhook` with the
`Authorization` header set to `HELIUS_WEBHOOK_SECRET`. Register a coin, then
swaps flow in:

```bash
pnpm --filter @float/scripts register-coin --pool <P> --base-mint <B> --quote-mint <Q> --config <C> --creator <CR> --ticker MYC --name "My Coin" --uri <URI>
```

```bash
pnpm --filter @float/scripts backfill --pool <P>
pnpm --filter @float/scripts resnapshot-holders --pool <P>
```

## Definition of done

- [ ] Webhook end-to-end on devnet: a swap appears in `swaps` within ~5s.
- [ ] Backfill of a 500-swap pool reproduces the same holder balances as a fresh
      resnapshot.
- [ ] Survives restart (cursor row) and duplicate deliveries (unique on
      `(sig, eventIndex)`; holder deltas apply only on first insert).
- [x] Offline checks (`verify:phase3`) + unit tests (swap mapping) pass; both
      IDLs load into Anchor's event coder.

## Notes / carryovers

- Prisma postinstall build scripts are blocked by pnpm; `prisma generate` runs
  explicitly (`pnpm --filter @float/db generate`, also part of `build`).
  Approve with `pnpm approve-builds` if you want it automatic.
- `swaps.wallet` is the transaction fee payer (the trader in our own UI flow).
  Backfill/resnapshot agree because the fee payer owns the token account; a
  third party trading our pool via another route would differ — resnapshot is
  the source of truth for balances.
- `fee_claims` / `payouts` / `buybacks` / `airdrops` tables exist but are
  written by the Phase 4 bots.
- The migrator (Phase 4) advances `migrationState` to CreatedPool (3); the
  indexer only advances it to PostBondingCurve (1) on `EvtCurveComplete`.
