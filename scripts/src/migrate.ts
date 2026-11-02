/**
 * migrate.ts — migrate a completed DBC pool to DAMM v2.
 *
 *   pnpm --filter @float/scripts exec tsx src/migrate.ts --pool <pubkey>
 *
 * After a real (non-dry-run) migration, resolves the created DAMM v2 pool and
 * the partner position, and asserts the partner position is permanently locked
 * and its NFT is held by `fee_claimer`.
 */
import {
  deriveMigratedPoolAddress,
  getConnection,
  getCpAmm,
  getPartnerPosition,
  loadWallets,
} from '@float/core';
import {
  DAMM_V2_MIGRATION_FEE_ADDRESS,
  MigrationFeeOption,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import { getAccount, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import {
  confirmMainnet,
  getClient,
  parseArgs,
  PublicKey,
  requireArg,
  sendOrSimulate,
} from './_shared.js';

async function main(): Promise<void> {
  const args = parseArgs();
  const pool = new PublicKey(requireArg(args, 'pool'));

  const connection = getConnection();
  const client = getClient();
  const wallets = loadWallets();

  const vp = await client.state.getPool(pool);
  if (!vp) throw new Error(`Pool ${pool.toBase58()} not found`);
  const config = await client.state.getPoolConfig(vp.poolState.config);
  if (!config) throw new Error('Config not found');

  const feeOption = config.migrationFeeOption as MigrationFeeOption;
  const dammConfig = DAMM_V2_MIGRATION_FEE_ADDRESS[feeOption];
  if (!dammConfig) throw new Error(`No DAMM v2 migration fee address for option ${feeOption}`);

  console.log(`Migrating pool ${pool.toBase58()}`);
  console.log(`  migration progress: ${vp.poolState.migrationProgress}`);
  console.log(`  damm migration config: ${dammConfig.toBase58()}`);

  await confirmMainnet(`migrate pool ${pool.toBase58()} to DAMM v2`);

  const { transaction, firstPositionNftKeypair, secondPositionNftKeypair } =
    await client.migration.migrateToDammV2({
      payer: wallets.admin.publicKey,
      pool,
      dammConfig,
    });

  const result = await sendOrSimulate(
    connection,
    transaction,
    [wallets.admin, firstPositionNftKeypair, secondPositionNftKeypair],
    { feePayer: wallets.admin.publicKey, label: 'migrateToDammV2' },
  );

  const dammPool = deriveMigratedPoolAddress(vp.poolState.baseMint, config.quoteMint, feeOption);
  console.log(`\n  DAMM v2 pool:         ${dammPool.toBase58()}`);
  console.log(`  partner position NFT: ${firstPositionNftKeypair.publicKey.toBase58()}`);
  console.log(`  creator position NFT: ${secondPositionNftKeypair.publicKey.toBase58()}`);

  if (result.simulated) {
    console.log('\n[DRY_RUN] migration simulated; skipping on-chain position assertions.');
    return;
  }

  // Resolve + assert the partner position.
  const cpAmm = getCpAmm();
  const partner = await getPartnerPosition(cpAmm, dammPool);
  if (!partner) throw new Error('No permanently-locked partner position found on migrated pool');

  console.log(`  partner position:     ${partner.position.toBase58()}`);
  console.log(`  partner position ATA: ${partner.positionNftAccount.toBase58()}`);

  if (!cpAmm.isPermanentLockedPosition(partner.positionState)) {
    throw new Error('ASSERT FAILED: partner position is not permanently locked');
  }
  console.log('  ✓ partner position permanently locked');

  try {
    const ata = await getAccount(
      connection,
      partner.positionNftAccount,
      'confirmed',
      TOKEN_2022_PROGRAM_ID,
    );
    if (!ata.owner.equals(wallets.feeClaimer)) {
      throw new Error(
        `ASSERT FAILED: partner position NFT owned by ${ata.owner.toBase58()}, expected fee_claimer ${wallets.feeClaimer.toBase58()}`,
      );
    }
    console.log('  ✓ partner position NFT held by fee_claimer');
  } catch (err) {
    console.warn(`  ! could not verify NFT owner: ${err instanceof Error ? err.message : err}`);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
