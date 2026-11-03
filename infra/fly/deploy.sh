#!/usr/bin/env bash
# Deploy the Fomoed fee-distribution bots to Fly.io.
#
# Prereqs (run once):
#   1. Install flyctl:   brew install flyctl   (or: curl -L https://fly.io/install.sh | sh)
#   2. Log in:           fly auth login
#   3. Fund the four bot wallets with a little mainnet SOL.
#
# Then from the repo root:  bash infra/fly/deploy.sh
#
# Secrets are read from the gitignored apps/bots/.env and .wallets/ — nothing
# secret is printed or committed. Keypairs are converted to base58 for Fly.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
APP="${FLY_APP:-fomoed-bots}"
FLY="$(command -v flyctl || command -v fly || echo "$HOME/.fly/bin/flyctl")"

if [ ! -f apps/bots/.env ]; then
  echo "error: apps/bots/.env not found (needs CLUSTER, RPC_URL, DATABASE_URL, etc.)" >&2
  exit 1
fi

# Load non-keypair config from the bot env file.
set -a
# shellcheck disable=SC1091
source apps/bots/.env
set +a

# Convert a keypair JSON file to base58; abort loudly on any failure so a bad
# value can never be set as a secret.
b58() {
  local out
  out="$(node "$ROOT/packages/core/b58.mjs" "$1")" || { echo "b58 failed for $1" >&2; exit 1; }
  case "$out" in
    [1-9A-HJ-NP-Za-km-z]*) : ;;
    *) echo "b58 produced an invalid value for $1" >&2; exit 1 ;;
  esac
  printf '%s' "$out"
}

echo "→ creating app $APP (ok if it already exists)"
"$FLY" apps create "$APP" 2>/dev/null || true

echo "→ converting keypairs"
ADMIN_B58="$(b58 "$ROOT/.wallets/admin.json")"
PAYOUT_B58="$(b58 "$ROOT/.wallets/payout.json")"
BUYBACK_B58="$(b58 "$ROOT/.wallets/buyback.json")"
AIRDROP_B58="$(b58 "$ROOT/.wallets/airdrop.json")"

echo "→ setting secrets"
"$FLY" secrets set --app "$APP" --stage \
  CLUSTER="${CLUSTER:-mainnet-beta}" \
  RPC_URL="$RPC_URL" \
  DATABASE_URL="$DATABASE_URL" \
  TREASURY_ADDRESS="${TREASURY_ADDRESS:-}" \
  DRY_RUN="${DRY_RUN:-false}" \
  ADMIN_API_TOKEN="${ADMIN_API_TOKEN:-}" \
  FLAGSHIP_MINT="${FLAGSHIP_MINT:-}" \
  ADMIN_KEYPAIR="$ADMIN_B58" \
  PAYOUT_KEYPAIR="$PAYOUT_B58" \
  BUYBACK_KEYPAIR="$BUYBACK_B58" \
  AIRDROP_KEYPAIR="$AIRDROP_B58"

echo "→ deploying"
"$FLY" deploy --app "$APP" --ha=false

echo "✓ done. Logs:  $FLY logs --app $APP"
