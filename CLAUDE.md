# Float-on-Meteora

Launchpad on Meteora DBC → DAMM v2. Coins are quoted in a paired token (SOL, USDC, tokenized stocks). Trading fees are split 15% holders / 5% creator / 35% flagship buyback / 35% trader airdrop / 10% treasury.

## Rules

- TypeScript strict everywhere. No `any`. Zod-validate every external input (webhooks, env, RPC responses).
- All amounts are `bigint` in base units. Never use floating point for token math. Format only at the UI edge.
- Every bot action that moves funds must: (1) be idempotent via a DB record keyed on a deterministic id, (2) log the tx signature, (3) respect `DRY_RUN=true`.
- Never hardcode mint addresses or program IDs outside `packages/core/src/constants.ts`.
- Use the Meteora SDKs; do not hand-roll instruction builders. Read `node_modules/@meteora-ag/dynamic-bonding-curve-sdk` types before guessing a method.
- Default cluster is devnet. Mainnet requires `CLUSTER=mainnet-beta` and a confirmation prompt in scripts.
- Tests: vitest. Unit tests for math and splitting; integration tests against a local validator or devnet behind `RUN_CHAIN_TESTS=1`.
- Commit messages: conventional commits. One feature per PR.

## Reference docs

- DBC: https://docs.meteora.ag/core-products/dbc/what-is-dbc.md
- DBC SDK reference: https://docs.meteora.ag/developer-guides/dbc/typescript-sdk/reference.md
- DAMM v2 SDK: https://docs.meteora.ag/developer-guides/damm-v2/typescript-sdk/reference.md
- Token 2022 / badges: https://docs.meteora.ag/core-products/dbc/token-2022-support.md
- Fun Launch scaffold: https://docs.meteora.ag/invent/scaffold/fun-launch.md

## Fee split constants

HOLDERS 1500 bps, CREATOR 500 bps (paid via DBC creator fee, not the bot), FLAGSHIP 3500, TRADERS 3500, TREASURY 1000.

## Repo layout

```
float-meteora/
├── CLAUDE.md
├── package.json  pnpm-workspace.yaml  turbo.json
├── packages/
│   ├── core/       # shared: config builder, PDAs, constants, types, price feeds
│   ├── db/         # Prisma schema + migrations + client
│   └── indexer/    # Helius webhook receiver → Postgres
├── apps/
│   ├── web/        # Next.js app (from Meteora fun-launch scaffold)
│   └── bots/       # cycle, payout, buyback, airdrop, migrator (one process, pm2)
├── scripts/        # one-off CLI: create-config, launch, migrate, claim, badge-check
├── infra/          # docker-compose, Dockerfiles, fly.toml, env templates
└── docs/           # ADRs, runbooks, this plan
```

## Build status

Phase 1 (Foundation) in progress. See `docs/plan.md` for the full phased plan.
