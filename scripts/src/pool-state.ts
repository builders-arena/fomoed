/**
 * pool-state.ts — print reserves, curve progress, migration state and accrued
 * partner/creator fees for a DBC pool.
 *
 *   pnpm pool-state --pool <pubkey>
 */
import { getConnection } from '@float/core';
import { getClient, parseArgs, PublicKey, requireArg } from './_shared.js';

/** DBC migrationProgress enum (on the VirtualPool account). */
const MIGRATION_PROGRESS: Record<number, string> = {
  0: 'PreBondingCurve',
  1: 'PostBondingCurve',
  2: 'LockedVesting',
  3: 'CreatedPool',
};

async function main(): Promise<void> {
  const args = parseArgs();
  const pool = new PublicKey(requireArg(args, 'pool'));

  const connection = getConnection();
  const client = getClient();

  const vp = await client.state.getPool(pool);
  if (!vp) throw new Error(`Pool ${pool.toBase58()} not found`);
  const ps = vp.poolState;
  const config = await client.state.getPoolConfig(ps.config);

  const [threshold, quoteProgress, feeMetrics] = await Promise.all([
    client.state.getPoolMigrationQuoteThreshold(pool),
    client.state.getPoolQuoteTokenCurveProgress(pool),
    client.state.getPoolFeeMetrics(pool),
  ]);

  const quoteDecimals = config
    ? (await connection.getTokenSupply(config.quoteMint)).value.decimals
    : 0;

  console.log(`Pool ${pool.toBase58()}`);
  console.log(`  base mint:            ${ps.baseMint.toBase58()}`);
  console.log(`  config:               ${ps.config.toBase58()}`);
  console.log(`  creator:              ${ps.creator.toBase58()}`);
  if (config) console.log(`  quote mint:           ${config.quoteMint.toBase58()}`);
  console.log('');
  console.log(`  base reserve:         ${ps.baseReserve.toString()}`);
  console.log(`  quote reserve:        ${ps.quoteReserve.toString()}`);
  console.log(`  migration threshold:  ${threshold.toString()} (quote base units)`);
  console.log(`  curve progress:       ${(quoteProgress * 100).toFixed(2)}% to graduation`);
  console.log(`  migration progress:   ${MIGRATION_PROGRESS[ps.migrationProgress] ?? ps.migrationProgress}`);
  console.log(`  is migrated:          ${ps.isMigrated ? 'yes' : 'no'}`);
  console.log('');
  console.log('  Accrued fees (current, unclaimed):');
  console.log(`    partner base:       ${feeMetrics.current.partnerBaseFee.toString()}`);
  console.log(`    partner quote:      ${feeMetrics.current.partnerQuoteFee.toString()}`);
  console.log(`    creator base:       ${feeMetrics.current.creatorBaseFee.toString()}`);
  console.log(`    creator quote:      ${feeMetrics.current.creatorQuoteFee.toString()}`);
  console.log('  Total trading fees (lifetime):');
  console.log(`    base:               ${feeMetrics.total.totalTradingBaseFee.toString()}`);
  console.log(`    quote:              ${feeMetrics.total.totalTradingQuoteFee.toString()}`);
  if (quoteDecimals) {
    const q = feeMetrics.total.totalTradingQuoteFee.toNumber() / 10 ** quoteDecimals;
    console.log(`    quote (human):      ${q}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
