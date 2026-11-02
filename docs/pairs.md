# Quote-mint pairs — badge status

Which quote mints can be used as DBC quote mints as-is, and which need a Meteora
`TokenBadge` first. Generated/updated with:

```bash
pnpm --filter @float/scripts exec tsx src/badge-check.ts --mint <MINT> --markdown
```

Ship order: SOL / USDC / JUP first (no badge), then badged stock-token pairs.
**Send the needs-badge list to Meteora early — badges are the long pole.**

## Ready now (no badge required)

| Mint | Token program | Extensions | Verdict | Badge exists |
| --- | --- | --- | --- | --- |
| `So11111111111111111111111111111111111111112` | SPL | — | spl | n/a |
| `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` | SPL | — | spl | n/a |
| `JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN` | SPL | — | spl | n/a |

## Stock-token quote mints (run badge-check against mainnet, then fill in)

> Populate by running `badge-check --mint <MINT> --markdown` against a **mainnet**
> RPC for each candidate stock-token mint (xStocks / PreStocks / Tessera / etc.),
> then paste the rows here. Anything with `verdict = needs-badge` and
> `badge exists = no` must be requested from Meteora before it can launch.

| Mint | Token program | Extensions | Verdict | Badge exists |
| --- | --- | --- | --- | --- |
| _(pending mainnet badge-check run)_ | | | | |
