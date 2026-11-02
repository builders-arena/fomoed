# Deploying the web app to Vercel

Vercel hosts the **frontend + API routes** (`apps/web`) only. The indexer and
bots are long-running processes and must run elsewhere (Fly.io / a VPS) against
the same database.

## Project settings (Vercel dashboard)

- **Root Directory**: `apps/web`
  (pnpm detects the workspace root automatically and installs the whole monorepo;
  `transpilePackages` compiles `@float/core` + `@float/db`.)
- **Framework preset**: Next.js (set by `apps/web/vercel.json`).
- **Build Command / Install Command**: leave as default. The `build` script runs
  `prisma generate` (serverless binary target `rhel-openssl-3.0.x`, set in
  `schema.prisma`) before `next build`.

## Database

Use a **hosted Postgres with connection pooling** (Neon, Supabase, or Vercel
Postgres) — serverless functions open many short-lived connections.

- `DATABASE_URL` → the **pooled** connection string (PgBouncer / Neon pooler).
- Run migrations once against the direct (unpooled) URL:
  `DATABASE_URL=<direct> pnpm --filter @float/db migrate:deploy`.

## Environment variables (Vercel → Settings → Environment Variables)

| Var | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CLUSTER` | all | `devnet` or `mainnet-beta` |
| `NEXT_PUBLIC_RPC_URL` | all | RPC the browser uses (wallet + swaps) |
| `RPC_URL` | server | RPC for API routes (launch tx build, pool reads) |
| `DATABASE_URL` | server | pooled Postgres URL |
| `FEE_CLAIMER_ADDRESS` | server | needed for config-create launches |
| `LEFTOVER_RECEIVER_ADDRESS` | server | needed for config-create launches |
| `NEXT_PUBLIC_ADMIN_API_URL` | all | public URL of the bots admin API (Cycle button) |
| `ADMIN_API_TOKEN` | server | bearer for the cycle proxy |

## What works / what's empty

- **Works now**: home, /docs, /create (devnet launch: server builds the tx, the
  wallet signs + sends), wallet connect.
- **Empty until the indexer + bots run** (pointed at the same DB, with a Helius
  webhook on the indexer): /tokens, /analytics, /burns, /profile data.
- The **Cycle fees** button needs a reachable `NEXT_PUBLIC_ADMIN_API_URL`; it
  fails gracefully (502) otherwise.

## Note

After changing `apps/web/package.json` (the `prisma` devDep), commit the updated
`pnpm-lock.yaml` — Vercel installs with a frozen lockfile by default.
