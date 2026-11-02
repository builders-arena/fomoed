# Security / threat model

Float v1 has **no custom on-chain program**: fee distribution runs in a bot that
custodies claimed quote tokens between claim and distribution. The threats below
are ranked by how much value they put at risk.

## 1. Hot-wallet compromise

The payout / buyback / airdrop wallets are hot keys on the bot host. The
fee_claimer is a **Squads multisig** on mainnet (`FEE_CLAIMER_ADDRESS`, asserted
by `mainnet-preflight`), so the bulk of claimable value never sits on a hot key.

- **Mitigations**: cap hot-wallet balances (`MAINNET_WALLET_CAP_SOL`, checked by
  preflight); cycle claims to the multisig and only fans out per-coin working
  amounts; sweep treasury frequently (treasury is a multisig); separate keys per
  bot so one leak is bounded.
- **Residual**: an attacker who roots the host can drain whatever is in the hot
  wallets until the next sweep. Keep balances small; alert on balance drops.

## 2. RPC poisoning / bad reads

A malicious or buggy RPC could return fake balances or pool state, causing wrong
payouts.

- **Mitigations**: the indexer verifies the Helius webhook `Authorization`
  header; holder balances are authoritative from `resnapshot-holders`
  (on-chain token accounts), not just swap deltas; the hourly invariant checker
  cross-checks claimed == split and payouts ≤ credited; cycle measures the
  **actual** claimed amount from the fee_claimer ATA delta, not a predicted one.
- **Residual**: use a reputable RPC; consider a second RPC to cross-check
  balances before large payouts.

## 3. Issuer pause / frozen accounts (tokenized-stock quotes)

A stock-token issuer can pause transfers or freeze accounts, stranding payouts.

- **Mitigations**: `badge-check` classifies risky Token-2022 extensions before a
  pair ships; the admin API can **pause a quote mint** so cycle/payout skip it;
  payouts that fail on a frozen account are logged in `tx_log` and retried, not
  silently dropped.
- **Residual**: detect `TransferFailed`/frozen and auto-pause the pair (wired via
  the pause endpoint today; auto-trigger is a follow-up).

## 4. Jupiter route manipulation

Buyback/airdrop swaps could be sandwiched or routed through a manipulated pool.

- **Mitigations**: every swap enforces `slippageBps` and rejects when
  `priceImpactPct` exceeds `SWAP_MAX_BPS` (≤1% default) before sending; amounts
  are bounded per run.
- **Residual**: cross-check the Jupiter quote against a second price source
  (feeds module) before large swaps.

## 5. ATA rent griefing

Paying tiny amounts would create rent-paying ATAs for dust, letting an attacker
drain the payout wallet via rent.

- **Mitigations**: the $0.50 payout floor (`PAYOUT_MIN_USD`) — wallets below it
  are carried forward, so no ATA is created for dust;
  `createAssociatedTokenAccountIdempotent` avoids double-rent.

## 6. Ticker squatting

- **Mitigations**: tickers are unique (case-insensitive) at launch. The plan's
  "1 SOL duplicate fee" path is a follow-up; today collisions are rejected.

## Idempotency & accounting integrity

- Every fund movement is keyed by a deterministic `idemKey` and recorded in
  `tx_log`; a confirmed/sent key is never re-sent (retry- and restart-safe).
- Ledger debits and round completion happen only after all batches confirm.
- `DRY_RUN=false` is required to send; `mainnet-preflight` surfaces its state.

## Go-live gate

`scripts/mainnet-preflight.ts` must pass: mainnet cluster, external multisig
fee_claimer with no local key, treasury ≠ admin, capped hot wallets, webhook
secret, admin token, and a configured flagship mint.
