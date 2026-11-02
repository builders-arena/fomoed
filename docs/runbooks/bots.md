# Runbook — bots

`apps/bots` is one process running a BullMQ worker (all jobs, concurrency 1)
plus an admin HTTP API. Every fund movement goes through `sendTx`/`sendVersionedTx`,
which write a `tx_log` row per attempt and honour `DRY_RUN`.

## Start

```bash
docker compose -f infra/docker-compose.yml up -d   # postgres + redis
pnpm --filter @float/db migrate:deploy
pnpm --filter @float/bots start
```

Required env (see `.env.example`): `RPC_URL`, `ADMIN_KEYPAIR`,
`FEE_CLAIMER_KEYPAIR` (local key — claims need a signer), `PAYOUT_KEYPAIR`,
`BUYBACK_KEYPAIR`, `AIRDROP_KEYPAIR`, `TREASURY_ADDRESS`, `DATABASE_URL`,
`REDIS_URL`, `ADMIN_API_TOKEN`, and `FLAGSHIP_MINT` (once the flagship launches).
Keep `DRY_RUN=true` until you have watched a full loop simulate cleanly.

## Workers

| Job | Interval | What it does |
| --- | --- | --- |
| `cycle` | 5 min | Claims partner fees per coin, splits the claim 15/35/35/10 (creator is on-chain), fans the quote out to the payout/buyback/airdrop/treasury wallets, credits the ledger, records `fee_claims`. |
| `payout` | 10 min | Pays holders their pro-rata share of `holders_pool` in the quote token; skips dust (< $0.50, carried forward); batches ~10 transfers/tx. |
| `buyback` | 15 min | Converts `flagship_pool` mints → SOL (Jupiter, ≤1% impact), then buys + **burns** the flagship when SOL ≥ trigger (or after 4h idle). |
| `airdrop` | 15 min | Converts `traders_pool` → USDC and pays **approved** rounds pro-rata by volume. |
| `airdrop-snapshot` | 24 h | Builds a round from per-wallet volume; excludes >100 swaps/hour + denylist; status `pending_review`. |
| `migrator` | 1 min | Migrates completed pools (settled >3 min) to DAMM v2; updates `damm_pool` / `partner_position`. |

## Admin API (bearer `ADMIN_API_TOKEN`)

```bash
curl -XPOST :8788/cycle/<POOL>            -H "authorization: Bearer $TOK"
curl -XPOST :8788/airdrop/rounds/<ID>/approve -H "authorization: Bearer $TOK"
curl -XPOST :8788/pause/<QUOTE_MINT>      -H "authorization: Bearer $TOK"
curl -XPOST :8788/unpause/<QUOTE_MINT>    -H "authorization: Bearer $TOK"
curl        :8788/tx-log?bot=payout&limit=50 -H "authorization: Bearer $TOK"
```

Pausing a quote mint makes `cycle` and `payout` skip every coin on it within one
interval.

## Safety / idempotency

- `DRY_RUN=true` builds + simulates and writes `SIMULATED` tx_log rows; it never
  mutates ledgers (no funds moved).
- `sendTx(idemKey)` skips an action whose key already has a CONFIRMED/SENT row —
  so retries and worker restarts do not double-spend (fan-out, treasury,
  payout/airdrop batches, migration).
- Payout/airdrop debit the ledger and mark the round `sent` only after all
  batches confirm.

## Recover from a half-sent payout round

1. `GET /tx-log?bot=payout` to see which batches CONFIRMED.
2. The `PayoutRound` is still `pending` and `holders_pool` was **not** debited
   (debit happens only when every batch confirms). Re-running `payout` creates a
   new round for the still-owed remainder; the confirmed batches' recipients
   were already paid, so their balances are unchanged and they fall below the
   recompute only if truly paid — verify against `payouts` rows before re-running
   on mainnet. For a clean retry, mark the stuck round `sent` manually once you
   confirm the remaining batches landed, then let the next cycle/payout proceed.
