# Phase 2 — Graduation path and fee claims

Status: **code complete**, offline checks green. The on-chain cycle runs
manually against devnet (needs a funded wallet + RPC).

## What exists

- `packages/core/src/damm` — `getCpAmm` (cp-amm v2 client), `sortMints`,
  `deriveMigratedPoolAddress`, `getPartnerPosition` (finds the permanently-locked
  partner position), and `buildClaimPositionFeeTx`.
- `scripts`:
  - `fill-curve` — loops capped quote→base buys until the curve completes.
  - `migrate` — `migrateToDammV2`, then resolves the DAMM v2 pool + partner
    position and asserts it is permanently locked and held by `fee_claimer`.
  - `claim` — stage-aware: DBC partner trading fee before graduation; DAMM v2
    position fee (plus partner surplus + migration fee) after. Idempotent.
  - `badge-check` — classifies a mint as `spl` / `token-2022-permissionless` /
    `needs-badge` and reports whether the DBC `token_badge` PDA exists.

## Run (devnet; DRY_RUN=true simulates)

```bash
pnpm --filter @float/scripts verify:phase2
```

```bash
pnpm --filter @float/scripts fill-curve --pool <POOL> --max-swap 1
```

```bash
pnpm --filter @float/scripts migrate --pool <POOL>
```

```bash
pnpm --filter @float/scripts claim --pool <POOL>
```

```bash
pnpm --filter @float/scripts badge-check --mint <MINT> --markdown
```

## On-chain definition of done (manual, devnet)

- [ ] Full cycle: launch → fill-curve → migrate → trade on DAMM v2 → claim from
      the locked partner position.
- [ ] `claim` works at every stage and a second run claims 0.
- [ ] `badge-check` run on 10 mainnet stock-token mints populates
      [pairs.md](./pairs.md); send the needs-badge list to Meteora.
- [x] Offline checks (`verify:phase2`) + unit tests pass.

## Notes / carryovers

- `claim` needs a local `fee_claimer` key. On mainnet `FEE_CLAIMER_ADDRESS` is a
  Squads multisig, so `claim` builds the tx but the multisig must sign it
  (Phase 6 wires that path).
- Exact claimed amounts come from balance deltas; `claim` currently prints
  *pending/accrued* amounts. The Phase 3 indexer records realized amounts.
- `migrateToDammV2` is assumed to bundle any DAMM v2 migration-metadata step; if
  devnet requires a separate metadata tx, add it before the migrate call.
- The `badge-check` permissionless-extension allowlist is conservative — confirm
  against Meteora's token-2022 doc before relying on it for mainnet pairs.
