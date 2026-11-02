# Float-on-Meteora — Build Plan for Claude Code

A phased plan to build a Float-style launchpad (coins paired with tokenized stocks, fees paid back to holders in the paired token) on Meteora's Dynamic Bonding Curve (DBC) → DAMM v2 stack. Written to be executed with Claude Code: each phase has a goal, the files it produces, the exact prompts to give Claude Code, and a definition of done.

Design decisions already made (see the deep-dive doc):

- **No custom on-chain program in v1.** `fee_claimer` is a Squads multisig / bot wallet; the 15/5/35/35/10 split runs in a bot. Creator 5% is trustless via DBC's `creator_trading_fee_percentage`.
- **One fee tier (2%)**, one DBC `PoolConfig` per quote mint, created lazily inside the creator's first launch on that pair (`createConfigAndPoolWithFirstBuy`). Creator pays rent.
- **Fixed supply 1B**, decimals 6, `Immutable` token authority, ~$20k start / ~$150k graduation, migration to DAMM v2 with 100% partner liquidity permanently locked, migrated pool fee `Customizable` 2%, `collect_fee_mode = QuoteToken`.
- **Quote → SOL/USDC conversion** (flagship + traders buckets) done by the bot via Jupiter with a quoted min-out. No swap logic on chain.
- Stock-token quote mints need a Meteora-issued `TokenBadge`; ship SOL/USDC/JUP pairs first.
- Optional later: Meteora Dynamic Fee Sharing vault for SOL/USDC pairs; custom fee-router program + audit if on-chain split becomes a selling point.

---

## 0. Prerequisites (you, not Claude Code)

- [ ] Node 20+, pnpm, Rust toolchain (only for local Solana test validator), Solana CLI, Docker.
- [ ] RPC provider with webhooks: Helius (recommended) — one devnet key, one mainnet key.
- [ ] Postgres (local Docker for dev, managed for prod).
- [ ] Wallets: deployer/admin keypair, `fee_claimer` (Squads multisig on mainnet; plain keypair on devnet), payout bot hot wallet, buyback bot hot wallet, airdrop bot hot wallet, treasury.
- [ ] Devnet SOL for all of the above.
- [ ] A Meteora partner contact (Discord) for token badges on stock-token quote mints.
- [ ] Domain, Vercel (or similar) for the frontend, a VPS or Fly.io for bots.

---

## Repo layout (monorepo)

```
float-meteora/
├── CLAUDE.md                     # project rules for Claude Code
├── package.json  pnpm-workspace.yaml  turbo.json
├── packages/
│   ├── core/                     # shared: config builder, PDAs, constants, types, price feeds
│   ├── db/                       # Prisma schema + migrations + client
│   └── indexer/                  # Helius webhook receiver → Postgres
├── apps/
│   ├── web/                      # Next.js app (from Meteora fun-launch scaffold)
│   └── bots/                     # cycle, payout, buyback, airdrop, migrator (one process, pm2)
├── scripts/                      # one-off CLI: create-config, launch, migrate, claim, badge-check
├── infra/                        # docker-compose, Dockerfiles, fly.toml, env templates
└── docs/                         # ADRs, runbooks, this plan
```

Key dependencies: `@meteora-ag/dynamic-bonding-curve-sdk`, `@meteora-ag/cp-amm-sdk`, `@solana/web3.js`, `@solana/spl-token`, `@jup-ag/api`, `prisma`, `zod`, `bullmq` (job queues), `pino`, `vitest`.

---

## CLAUDE.md (create this first)

```markdown
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
```

---

## Phase 1 — Foundation and first devnet launch (days 1–4)

**Goal:** a script launches a coin on devnet from a lazily created DBC config, makes a first buy, and the pool trades on a terminal.

**Produces:** `packages/core`, `scripts/`, `.env.example`, working devnet launch.

**Claude Code prompts (run in order):**

1. "Scaffold a pnpm + turbo monorepo with packages/core, packages/db, packages/indexer, apps/web, apps/bots, scripts. Add CLAUDE.md from docs/CLAUDE.md. Add vitest, eslint, prettier, tsconfig base with strict mode."
2. "In packages/core add constants.ts (DBC program `dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN`, DAMM v2 `cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG`, WSOL, USDC, JUP mints, fee split bps), env.ts with zod-validated env, connection.ts, and a wallets.ts loader for keypairs from env or files."
3. "Install @meteora-ag/dynamic-bonding-curve-sdk. Read its exported types. Write `packages/core/src/dbc/config.ts` with `buildPartnerConfig({ quoteMint, quoteDecimals, quoteUsdPrice })` that uses `buildCurveWithMarketCap` to target initialMarketCap $20,000 and migrationMarketCap $150,000, fixed total supply 1,000,000,000 with decimals 6, `tokenUpdateAuthority = Immutable`, base fee 2% fixed (no scheduler, dynamic fee off), `collectFeeMode = QuoteToken`, `creatorTradingFeePercentage` = the bps that equals 5% of the total fee (5/80 of non-protocol share → 6.25%; round and document the rounding), `migrationOption = DammV2`, `migrationFeeOption = Customizable` with migrated pool fee 2%, migrated collect fee mode QuoteToken, partner permanent locked liquidity 100%, creator liquidity 0%, lockedVesting none, feeClaimer and leftoverReceiver from env, poolCreationFee 0. Export a pure function and unit-test that the curve's implied start and migration market caps are within 2% of targets for SOL at $150 and USDC at $1."
4. "Write `packages/core/src/dbc/configRegistry.ts`: deterministic config keypair derivation is not possible (DBC configs are keypairs), so maintain a Postgres table `pool_configs(quote_mint pk, config_pubkey, created_at, created_by_tx)`. Add `getOrCreateConfigIx(quoteMint)` that returns either the existing pubkey or the instructions to create one via `client.partner.createConfig2`."
5. "Write `scripts/launch.ts`: args --name --symbol --uri --quote <mint> --creator <pubkey> --first-buy <quote amount>. Uses `createConfigAndPoolWithFirstBuy` when no config exists for the quote mint, else `createPoolWithFirstBuy`. Prints pool, base mint, config, tx. Devnet by default."
6. "Write `scripts/swap.ts` (buy/sell with `swapQuote2` + `swap2`) and `scripts/pool-state.ts` (print reserves, progress %, migration state, accrued partner/creator fees)."

**Definition of done**

- `pnpm launch --quote <WSOL> --first-buy 0.1` succeeds on devnet twice; second run reuses the config.
- `pool-state` shows partner fee accruing after `swap` buys and sells.
- Unit tests for curve targeting pass.

---

## Phase 2 — Graduation path and fee claims (days 5–8)

**Goal:** a pool completes its curve on devnet, migrates to DAMM v2, and the `fee_claimer` can claim fees both pre- and post-graduation.

**Produces:** `scripts/migrate.ts`, `scripts/claim.ts`, `packages/core/src/damm/`.

**Claude Code prompts:**

1. "Write `scripts/fill-curve.ts` that buys until `migration_quote_threshold` is reached (loop with `swapQuote2`, cap per-swap size, stop on `PoolIsCompleted`)."
2. "Write `scripts/migrate.ts` using `client.migration.migrateToDammV2`. After migration, resolve the created DAMM v2 pool and the two position NFTs; assert the partner position is permanently locked and owned by `fee_claimer`. Print addresses."
3. "Install @meteora-ag/cp-amm-sdk. Write `packages/core/src/damm/positions.ts` with `getPartnerPosition(pool)` and `buildClaimPositionFeeTx(pool, position, owner)`."
4. "Write `scripts/claim.ts --pool <pubkey>`: if migration state < CreatedPool call `client.partner.claimPartnerTradingFee`; else call DAMM v2 claimPositionFee on the partner position. Also claim partner surplus and partner migration fee when available. Print amounts claimed per mint."
5. "Write `scripts/badge-check.ts --mint <pubkey>`: read the mint, classify SPL / Token-2022-permissionless / needs-badge (per Meteora token-2022 docs), check for the `['token_badge', mint]` PDA on DBC, and print a one-line verdict."

**Definition of done**

- Full devnet cycle: launch → fill-curve → migrate (manual) → trade on DAMM v2 → claim fees from the locked position.
- `claim.ts` works at every lifecycle stage and is idempotent (second run claims 0).
- `badge-check` run on 10 real mainnet stock-token mints produces a table in `docs/pairs.md` of which need badges. Send that list to Meteora now; it's the long pole.

---

## Phase 3 — Database and indexer (days 8–12)

**Goal:** every swap, launch, migration and claim for *our* configs lands in Postgres within seconds, with per-wallet volume and per-coin holder balances queryable.

**Produces:** `packages/db` (Prisma), `packages/indexer` (Helius webhook server), backfill script.

**Claude Code prompts:**

1. "Design a Prisma schema: pool_configs, coins (pool, base_mint, quote_mint, config, creator, creator_wallet, ticker, name, uri, launched_at, migration_state, damm_pool, partner_position), swaps (sig, slot, ts, pool, wallet, side, base_amount, quote_amount, fee_amount, referral), holders (coin, wallet, balance, updated_slot), fee_claims, payouts, payout_rounds, buybacks, airdrops, airdrop_rounds, cursor. Add indexes for (pool, ts), (wallet, ts)."
2. "Build packages/indexer: a Fastify server receiving Helius enhanced-transaction webhooks for the DBC and DAMM v2 program IDs, filtering to pools in our `coins` table, parsing DBC `EvtSwap3` / `EvtCurveComplete` / migration events and DAMM v2 swap events via the SDK IDLs, upserting rows idempotently by signature. Verify the webhook auth header."
3. "Add a holder-balance tracker: on each swap, apply the base delta to `holders`; add `scripts/resnapshot-holders.ts` that rebuilds balances for a coin from `getTokenLargestAccounts` + `getProgramAccounts` (Token-2022 aware) to correct drift."
4. "Add `scripts/backfill.ts` that walks `getSignaturesForAddress` for a pool from launch to now and replays through the same parser."
5. "Add a `coins:register` job: when `launch.ts` or the web app creates a pool, insert the coin row first so the indexer accepts its events."

**Definition of done**

- Webhook end-to-end on devnet: a swap appears in `swaps` within 5 s.
- Backfill of a 500-swap pool reproduces identical holder balances to a fresh resnapshot.
- Indexer survives restart (cursor table) and duplicate deliveries (unique on signature).

---

## Phase 4 — Bots (days 12–18)

**Goal:** the money moves. One process (`apps/bots`) with five workers on BullMQ schedules, all `DRY_RUN`-capable.

**Produces:** `apps/bots/src/{cycle,payout,buyback,airdrop,migrator}.ts`, shared `tx.ts` (priority fees, retries, confirmation), runbooks.

**Claude Code prompts:**

1. "Create apps/bots with BullMQ + Redis. Shared `sendTx()` with compute budget, priority fee from a percentile of recent fees, blockhash refresh, retry on expiry, and a `tx_log` row per attempt. `DRY_RUN=true` builds and simulates but never sends."
2. "**Cycle worker** (every 5 min, and on-demand via API): for each coin with accrued fee > min threshold, run the claim logic from Phase 2 into the `fee_claimer` wallet, then split the claimed quote amount by bps into ledger rows: holders_pool(coin, mint), flagship_pool(mint), traders_pool(mint), treasury(mint). Transfer treasury share immediately. Record `fee_claims` with the five amounts. Must be idempotent per claim tx."
3. "**Payout worker** (every 10 min per coin): read `holders_pool` balance for the coin, read holder balances at the latest slot, pay pro rata in the paired token from the payout wallet. Rules: skip wallets owed < $0.50 (price from a feeds module: Jupiter price API with Pyth fallback) and carry their amount forward; create ATAs only when paying ≥ $0.50 (Token-2022 aware, use `createAssociatedTokenAccountIdempotent`); exclude the pool vaults, DAMM pool, and known program accounts from holders; batch 8–12 transfers per tx. Write `payouts` rows. A wallet that sold between accrual and payout gets nothing; its share stays in the pool."
4. "**Buyback worker** (every 15 min): sum `flagship_pool` across mints; for each mint with balance > min, get a Jupiter quote mint→SOL, enforce slippage ≤ 1% and min-out, swap, move SOL to the buyback wallet. When SOL ≥ 5 (or any amount after 4 h idle), quote SOL→FLAGSHIP, reject if price impact > 1%, swap, burn the received tokens (`burn` ix), record in `buybacks`."
5. "**Airdrop worker**: `traders_pool` → USDC via Jupiter on the same rules. Separate `airdrop:snapshot` job builds a round: volume per wallet over the window from `swaps`, excludes wallets with >100 swaps in any hour and a configurable denylist, writes `airdrop_rounds` + per-wallet shares with status `pending_review`. `airdrop:send` only runs on rounds marked `approved` by an admin."
6. "**Migrator worker** (every 1 min): find coins where the curve is complete and `migration_state < CreatedPool` for > 3 min; call `migrateToDammV2`; on success update the coin row with `damm_pool` and `partner_position`."
7. "Add a tiny admin HTTP API (auth by bearer token): trigger cycle for a coin, approve an airdrop round, pause a quote mint (sets `paused` so cycle/payout skip it), list tx_log."
8. "Write docs/runbooks/bots.md: how to start, env vars, what each worker does, how to recover from a half-sent payout round."

**Definition of done**

- On devnet with 3 coins (SOL, USDC, and one Token-2022 quote) and ~50 synthetic holders: a full loop runs unattended for 24 h with no duplicate payouts and ledger sums reconcile to claimed fees within rounding.
- Pausing a quote mint stops its payouts and cycle within one interval.
- Every fund movement has a `tx_log` row and a DB record linking it to its source claim.

---

## Phase 5 — Web app (days 14–22, overlaps Phase 4)

**Goal:** Float's five pages: create, tokens, coin page, analytics, profile, plus burns.

**Produces:** `apps/web` (Next.js, from Meteora's fun-launch scaffold), API routes reading Postgres, wallet adapter.

**Claude Code prompts:**

1. "Bootstrap apps/web from Meteora's fun-launch scaffold (meteora-invent). Keep its swap UI and pool chart; strip its own launch flow. Add shadcn/ui and a wallet-adapter provider."
2. "**/create**: form (name, ticker, image upload to R2/S3, description, socials, quote mint picker with search over our `pairs` table, optional first buy). Ticker rules: 1–10 alphanumerics, case-insensitive uniqueness; if taken, show '1 SOL duplicate fee' and add a transfer to treasury in the same tx. Server route builds the launch tx (config-create included when needed), client signs, server registers the coin row on confirmation."
3. "**/tokens**: list with market cap (from pool state × quote USD price), progress to graduation, 24h volume, holder rewards paid, paired token logo, filters by pair and status."
4. "**/coin/[pool]**: chart, swap widget, graduation progress, fee split card, 'Cycle fees' button (calls admin API cycle endpoint permissionlessly rate-limited), holder rewards paid / pending, creator wallet, pair risk notice (pausable issuer, transfer fee if any), links to Solscan."
5. "**/analytics**: platform totals (fees, paid to holders, bought back/burned, airdrop vault balance), trader leaderboard for the current round with estimated share, next airdrop time."
6. "**/profile**: connected wallet's coins, rewards received per token, airdrop history. **/burns**: every buyback with tx and cumulative burned."
7. "**/docs**: a static page mirroring the fee split, risks and contract addresses, generated from constants so it can't drift."
8. "Add `apps/web/src/lib/pairs.ts` and a `pairs` table seeded from docs/pairs.md: mint, symbol, logo, decimals, token program, badge status, transfer fee bps, issuer, risk flags. Only `badge_status = ready` pairs appear in the picker."

**Definition of done**

- A new user can launch on devnet from the UI in under a minute and see their coin trade on the coin page.
- Lighthouse performance ≥ 80 on /tokens with 200 coins.
- All numbers on /analytics reconcile with Postgres aggregates.

---

## Phase 6 — Hardening and mainnet (days 22–30)

**Goal:** safe to take real money.

**Claude Code prompts:**

1. "Write an invariant checker script run hourly: sum(claimed fees) == sum(splits); sum(payouts per coin) ≤ holders_pool credited; buyback SOL in == Jupiter quoted out ± slippage; flag any wallet paid twice for the same round."
2. "Add Sentry + pino-loki logging, Grafana dashboards for: fees claimed/hour, payout latency, failed tx rate, RPC errors, bot wallet balances with alerts below thresholds."
3. "Write a threat model in docs/security.md: hot wallet compromise (limit balances, sweep treasury frequently), RPC poisoning (verify webhook signatures, cross-check balances on chain before payout), issuer pause (detect `TransferFailed`/frozen, auto-pause pair), Jupiter route manipulation (min-out from a second quote source), ATA rent griefing (the $0.50 floor), ticker squatting (duplicate fee)."
4. "Mainnet switch: `CLUSTER=mainnet-beta`, fee_claimer = Squads multisig address, config feeClaimer/leftoverReceiver set to it, treasury multisig, bot wallets funded with capped balances, Helius mainnet webhooks, `DRY_RUN=false` only via explicit flag. Add a `scripts/mainnet-preflight.ts` that asserts all of this."
5. "Launch the flagship token itself through our own /create on a SOL pair; record its mint in constants; the buyback worker targets it."

**Definition of done**

- 48 h on mainnet with 2–3 seed coins on SOL/USDC pairs, invariant checker green, no manual intervention.
- Then enable the first badged stock-token pair.

---

## Phase 7 — Optional upgrades (after launch)

| Upgrade | Why | Effort |
| --- | --- | --- |
| Dynamic Fee Sharing vaults for SOL/USDC pairs | On-chain, audited split; removes bot custody for those pairs | 3–4 days |
| Custom fee-router Anchor program + audit | On-chain split for stock-token pairs; the "verifiable" pitch | 3 weeks + $15–50k |
| DBC fee scheduler (anti-snipe) | High start fee decaying to 2% over first minutes | 1 day (config change) |
| Dynamic fee on DBC/DAMM v2 | More holder yield in volatile periods | 1 day |
| Transfer-fee quote pairs (PreStocks, Tessera) | `create_config2` family with `Compounding` + `compounding_fee_bps = 0` | 3 days |
| Presale / Alpha Vault in front of launch | Fair-launch option for creators | 1 week |
| Referral program | Pass a referral account on swaps from our UI; DBC pays 20% of protocol fee to it | 1 day |

---

## Working with Claude Code effectively on this repo

- Start every session with `/init`-style context: "Read CLAUDE.md and docs/plan.md, then summarize the current phase and what's unfinished before doing anything."
- Keep phases as GitHub issues; give Claude Code one issue at a time and ask it to open a PR with tests.
- When it touches an SDK call, ask it to "show the SDK method signature from node_modules before writing the call" — the Meteora SDK changes often and the docs lag.
- Ask for a `scripts/verify-<phase>.ts` at the end of each phase that proves the definition of done mechanically.
- Devnet first, always. Mainnet only through `mainnet-preflight.ts`.

## Cost recap for this plan

- On-chain, upfront: ~0 (creators pay config and pool rent). Flagship launch ~0.05 SOL.
- Monthly: RPC + webhooks $100–300, Redis/Postgres/VPS $30–80, object storage for images ~$5.
- Meteora: 20% of trading fees, 0.2% of migrated quote, 20% of surplus. No upfront.
- No program deployment, no audit, in v1.
