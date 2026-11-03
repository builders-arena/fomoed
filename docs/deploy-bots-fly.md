# Deploy the bots to Fly.io (24/7)

The fee-distribution bots run as a single worker process. This moves them off
your Mac onto Fly.io so they run around the clock.

## One-time prerequisites

```bash
brew install flyctl          # or: curl -L https://fly.io/install.sh | sh
fly auth login               # opens a browser
```

Fund the four bot wallets with a little mainnet SOL (fees/rent only — the
distributed amounts come from claimed trading fees):

| Wallet | Address |
| --- | --- |
| admin / fee-claimer | `3SFRSFiE99EMxrgrPKzf8AF4CNL1cXNbJHfhWvjoCUkr` |
| payout | `3HqWpLZCs4zPC3R8qy1dw9gfxruLCnFdtoSwhvpnfqwB` |
| buyback | `2yRKbgwk1e4k48CVK5qNq1SfpcPufLMVQ5E8i4e1fATA` |
| airdrop | `CknuwvcUBNqBDnVqW7GCPxvA3SRkkAcs8fg3v9Lm1tgm` |

## Deploy

```bash
bash infra/fly/deploy.sh
```

It creates the app (`fomoed-bots`; set `FLY_APP=<name>` if that's taken), reads
config from the gitignored `apps/bots/.env`, converts the keypairs in `.wallets/`
to base58, sets them as **Fly secrets** (never committed), and deploys. No
public ports are opened — the admin API is private to Fly's network.

## After it's up

- **Stop the Mac copy** so you don't run two bots: ask Claude to stop the
  background bot, or kill the `pnpm --filter @float/bots standalone` process.
- Logs: `fly logs --app fomoed-bots`
- Status: `fly status --app fomoed-bots`
- Redeploy after changes: `bash infra/fly/deploy.sh` again.

## Notes

- Secrets live only in Fly (and your local `.env` / `.wallets`, both gitignored).
- The hot keys sit on Fly; the hardened design uses a Squads multisig fee-claimer
  — this is the simple single-key setup.
- Still unaudited; keep it to your own testing until you're confident.
