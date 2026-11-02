/**
 * verify-phase1.ts — mechanical proof of the offline parts of the Phase 1
 * definition of done. (The on-chain DoD — "launch twice on devnet, second run
 * reuses the config; pool-state shows fees accruing" — requires a funded devnet
 * wallet and an RPC, so it is run manually against devnet.)
 *
 *   pnpm --filter @float/scripts exec tsx src/verify-phase1.ts
 */
import { buildPartnerConfig, impliedMarketCaps, QUOTE_DECIMALS } from '@float/core';

interface Case {
  name: string;
  quoteMint: string;
  quoteDecimals: number;
  quoteUsdPrice: number;
}

const CASES: Case[] = [
  {
    name: 'SOL @ $150',
    quoteMint: 'So11111111111111111111111111111111111111112',
    quoteDecimals: QUOTE_DECIMALS.SOL,
    quoteUsdPrice: 150,
  },
  {
    name: 'USDC @ $1',
    quoteMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    quoteDecimals: QUOTE_DECIMALS.USDC,
    quoteUsdPrice: 1,
  },
];

const TOLERANCE_PCT = 2;

function withinPct(actual: number, target: number): boolean {
  return Math.abs(actual - target) / target <= TOLERANCE_PCT / 100;
}

let failed = false;
for (const c of CASES) {
  const config = buildPartnerConfig({
    quoteMint: c.quoteMint,
    quoteDecimals: c.quoteDecimals,
    quoteUsdPrice: c.quoteUsdPrice,
  });
  const caps = impliedMarketCaps(config, c.quoteDecimals, c.quoteUsdPrice);
  const initUsd = caps.initialUsd.toNumber();
  const migUsd = caps.migrationUsd.toNumber();
  const initOk = withinPct(initUsd, 20_000);
  const migOk = withinPct(migUsd, 150_000);
  if (!initOk || !migOk) failed = true;

  console.log(`${c.name}`);
  console.log(
    `  initial MC:   $${initUsd.toFixed(0)} (target $20,000) ${initOk ? 'OK' : 'FAIL'}`,
  );
  console.log(
    `  migration MC: $${migUsd.toFixed(0)} (target $150,000) ${migOk ? 'OK' : 'FAIL'}`,
  );
}

if (failed) {
  console.error('\nverify-phase1: FAILED');
  process.exit(1);
}
console.log('\nverify-phase1: all offline checks passed.');
