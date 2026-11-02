# Phase 6 — Hardening and mainnet

Status: **code complete**, offline checks green. Going live is gated on
`mainnet-preflight` passing against real mainnet config.

## What exists

- `packages/core/src/invariants.ts` — pure `splitReconciles`, `withinSlippage`,
  `payoutWithinCredit` (unit-tested).
- `scripts/invariants.ts` — hourly reconciler: split==total, payouts≤credited,
  buyback sanity, no double-pay within a round. Exits non-zero on violations.
- `scripts/mainnet-preflight.ts` — asserts mainnet cluster, external multisig
  fee_claimer (no local key), treasury≠admin, capped hot wallets, webhook
  secret, admin token, flagship mint.
- `apps/bots/src/observability.ts` — opt-in Sentry (`SENTRY_DSN`) + Loki-shipping
  pino logger (`LOKI_URL`); wired into `main` and the worker failure handler.
- `infra/grafana/` — dashboard (Postgres-backed) + alert guide.
- `docs/security.md` — threat model (hot-wallet, RPC, issuer pause, Jupiter
  routing, ATA rent, ticker squatting) with mitigations.
- `getFlagshipMint()` in core (env-driven) + shown on /docs.

## Run

```bash
pnpm --filter @float/scripts invariants          # hourly (cron / scheduled task)
CLUSTER=mainnet-beta pnpm --filter @float/scripts mainnet-preflight
```

## Definition of done

- [ ] 48h on mainnet with 2–3 seed coins on SOL/USDC pairs, invariant checker
      green, no manual intervention.
- [ ] Then enable the first badged stock-token pair.
- [x] Invariant helpers unit-tested; `verify:phase6` passes; preflight + checker
      typecheck and lint.

## Go-live checklist

1. Launch the flagship token via /create on a SOL pair; set `FLAGSHIP_MINT`.
2. Set `FEE_CLAIMER_ADDRESS` / `TREASURY_ADDRESS` to Squads multisigs;
   `LEFTOVER_RECEIVER_ADDRESS` to the multisig.
3. Fund payout/buyback/airdrop wallets with capped balances.
4. Point Helius mainnet webhooks at the indexer; set `HELIUS_WEBHOOK_SECRET`.
5. `CLUSTER=mainnet-beta`, set `SENTRY_DSN` / `LOKI_URL`, schedule `invariants`.
6. Run `mainnet-preflight` — it must pass.
7. Flip `DRY_RUN=false` explicitly.

## Carryovers

- A wallet-balance metrics exporter (for the "bot wallet low/over cap" alerts)
  is a deployment detail, not yet in the repo.
- Payout latency panels need a `sent_at` timestamp on payout rounds (follow-up).
- Auto-pause on `TransferFailed`/frozen accounts is manual today (pause endpoint).
