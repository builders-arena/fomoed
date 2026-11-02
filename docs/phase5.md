# Phase 5 — Web app

Status: **code complete**, `next build` green. A clean Next.js 14 (App Router)
app wired to our own `@float/db` + core — same page set as Meteora's fun-launch
scaffold, without the external dependency.

## What exists (`apps/web`)

- Wallet adapter (Phantom/Solflare) + Tailwind, dark theme.
- **/tokens** — coin grid with 24h volume + rewards paid, filter by pair.
- **/coin/[pool]** — graduation progress (live RPC), fee-split card, stats,
  Solscan links, risk notice, a client **SwapWidget** (buy/sell via the DBC SDK)
  and a permissionless **Cycle fees** button.
- **/create** — form (name, ticker, metadata URI, pair picker, first buy);
  `POST /api/launch` builds the launch tx(s) server-side (creator pays rent,
  lazy config create), the wallet signs + sends, then `POST /api/register`
  inserts the coin (and persists a new config).
- **/analytics** — platform totals + trader leaderboard + next airdrop.
- **/profile** — connected wallet's launches, holder rewards, airdrops.
- **/burns** — every buyback + cumulative burned.
- **/docs** — fee split, economics, risks, contract addresses, generated from
  core constants so it can't drift.
- API routes: `launch`, `register`, `cycle/[pool]` (proxies the bots admin API),
  `profile`.

## Run

```bash
pnpm --filter @float/web dev   # http://localhost:3000
```

Env: `NEXT_PUBLIC_CLUSTER`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_ADMIN_API_URL`;
server-side `DATABASE_URL`, `RPC_URL`, `FEE_CLAIMER_ADDRESS`,
`LEFTOVER_RECEIVER_ADDRESS`, `ADMIN_API_TOKEN`.

## Definition of done

- [ ] Launch on devnet from the UI in under a minute; see it trade on the coin
      page.
- [ ] Lighthouse ≥ 80 on /tokens with 200 coins.
- [ ] /analytics numbers reconcile with Postgres aggregates.
- [x] `next build` compiles all routes; typecheck + lint pass.

## Notes / carryovers

- Metadata is a URI field; image upload to R2/S3 is a TODO (the form takes the
  final metadata JSON URL).
- Ticker uniqueness is enforced (409 on collision); the "1 SOL duplicate fee"
  path from the plan is not yet wired — collisions are simply rejected.
- `next.config.mjs` sets `resolve.extensionAlias` so webpack resolves the
  ESM-style `.js` specifiers in our TS workspace packages; `@float/core/constants`
  is imported in client code to avoid pulling node-only modules into the browser
  bundle.
- Analytics totals sum across mints of differing decimals (labeled as such);
  a USD normalization pass is a Phase 6 polish.
