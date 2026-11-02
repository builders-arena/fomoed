# Grafana / observability

## Dashboards

`float-dashboard.json` imports against a **Postgres** datasource (pick it in the
`$ds` variable on import). Panels: fees claimed/hour, failed tx/hour, confirmed
tx/hour by bot, payouts sent/hour — all from `tx_log` / `fee_claims` / `payouts`.

## Logs

Set `LOKI_URL` on the bots process to ship logs to Loki; the pino logger adds a
`pino-loki` transport with labels `{app=float-bots, cluster}`. RPC-error and
job-failure panels are built from these logs in Loki (query
`{app="float-bots"} |= "error"`).

## Errors

Set `SENTRY_DSN` to capture job failures and unhandled errors
(`observability.ts`).

## Alerts to configure

| Alert | Source | Condition |
| --- | --- | --- |
| Failed tx rate | Postgres `tx_log` | `FAILED` per 15m above a threshold |
| No fees claimed | Postgres `fee_claims` | 0 rows in the last 2h during active trading |
| Bot wallet low | balance exporter* | payout/buyback/airdrop SOL below the fee floor |
| Bot wallet over cap | balance exporter* | any hot wallet above `MAINNET_WALLET_CAP_SOL` |
| RPC errors | Loki | error rate spike in bot logs |

\* Wallet balances are not in Postgres; run a small balance exporter (or a
scheduled task that writes balances to a metrics endpoint) and alert on it. This
exporter is a deployment detail, not part of the repo yet.
