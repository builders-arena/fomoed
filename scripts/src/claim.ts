/**
 * claim.ts — claim partner fees for a pool at any lifecycle stage.
 *
 *   pnpm --filter @float/scripts exec tsx src/claim.ts --pool <pubkey>
 *
 * - Pre-graduation (migration progress < CreatedPool): DBC partner trading fee.
 * - Post-graduation: DAMM v2 position fee on the locked partner position.
 * Also attempts partner surplus and partner migration-fee withdrawals when
 * available. Idempotent: a second run claims nothing.
 */
import {
  buildClaimPositionFeeTx,
  deriveMigratedPoolAddress,
  getConnection,
  getCpAmm,
  getPartnerPosition,
  loadWallets,
} from '@float/core';
import { MigrationFeeOption, U64_MAX } from '@meteora-ag/dynamic-bonding-curve-sdk';
import type { Keypair, Transaction } from '@solana/web3.js';
import {
  getClient,
  parseArgs,
  PublicKey,
  requireArg,
  sendOrSimulate,
} from './_shared.js';

/** DBC migrationProgress value at which the DAMM v2 pool exists. */
const CREATED_POOL = 3;

async function main(): Promise<void> {
  const args = parseArgs();
  const pool = new PublicKey(requireArg(args, 'pool'));

  const connection = getConnection();
  const client = getClient();
  const wallets = loadWallets();

  if (!wallets.feeClaimerSigner) {
    throw new Error(
      'FEE_CLAIMER_ADDRESS is set (external/multisig) — no local key to sign claims. ' +
        'Run claims from the multisig, or unset FEE_CLAIMER_ADDRESS on devnet.',
    );
  }
  const feeClaimer = wallets.feeClaimerSigner;
  // Dedupe signers when admin == fee claimer.
  const signers: Keypair[] = feeClaimer.publicKey.equals(wallets.admin.publicKey)
    ? [wallets.admin]
    : [wallets.admin, feeClaimer];

  const vp = await client.state.getPool(pool);
  if (!vp) throw new Error(`Pool ${pool.toBase58()} not found`);
  const config = await client.state.getPoolConfig(vp.poolState.config);
  if (!config) throw new Error('Config not found');

  const migrated = vp.poolState.migrationProgress >= CREATED_POOL;
  console.log(`Pool ${pool.toBase58()} — migration progress ${vp.poolState.migrationProgress} (${migrated ? 'migrated' : 'bonding'})`);

  if (!migrated) {
    const m = await client.state.getPoolFeeMetrics(pool);
    console.log(
      `  accrued partner fees: base ${m.current.partnerBaseFee.toString()}, quote ${m.current.partnerQuoteFee.toString()}`,
    );
    await tryClaim('claimPartnerTradingFee', signers, connection, () =>
      client.partner.claimPartnerTradingFee({
        feeClaimer: feeClaimer.publicKey,
        payer: wallets.admin.publicKey,
        pool,
        maxBaseAmount: U64_MAX,
        maxQuoteAmount: U64_MAX,
      }),
    );
  } else {
    const feeOption = config.migrationFeeOption as MigrationFeeOption;
    const dammPool = deriveMigratedPoolAddress(vp.poolState.baseMint, config.quoteMint, feeOption);
    const cpAmm = getCpAmm();
    const partner = await getPartnerPosition(cpAmm, dammPool);
    if (!partner) throw new Error(`No partner position on migrated pool ${dammPool.toBase58()}`);
    console.log(`  DAMM v2 pool: ${dammPool.toBase58()}`);
    console.log(
      `  pending position fees: A ${partner.positionState.feeAPending.toString()}, B ${partner.positionState.feeBPending.toString()}`,
    );
    await tryClaim('claimPositionFee (DAMM v2)', signers, connection, () =>
      buildClaimPositionFeeTx(cpAmm, {
        pool: dammPool,
        position: partner.position,
        positionNftAccount: partner.positionNftAccount,
        owner: feeClaimer.publicKey,
        feePayer: wallets.admin.publicKey,
      }),
    );

    // Surplus and migration fee become available post-graduation.
    await tryClaim('partnerWithdrawSurplus', signers, connection, () =>
      client.partner.partnerWithdrawSurplus({ feeClaimer: feeClaimer.publicKey, pool }),
    );
    await tryClaim('partnerWithdrawMigrationFee', signers, connection, () =>
      client.partner.partnerWithdrawMigrationFee({ pool, sender: feeClaimer.publicKey }),
    );
  }

  console.log('\nDone.');
}

/** Build + send a claim, treating "nothing to claim" as a successful no-op. */
async function tryClaim(
  label: string,
  signers: Keypair[],
  connection: ReturnType<typeof getConnection>,
  build: () => Promise<Transaction>,
): Promise<void> {
  try {
    const tx = await build();
    const feePayer = signers[0]?.publicKey;
    if (!feePayer) throw new Error('no fee payer');
    await sendOrSimulate(connection, tx, signers, { feePayer, label });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/nothing|zero|no fee|AmountIsZero|0x1771|not.*available|NotPermit/i.test(msg)) {
      console.log(`  ${label}: nothing to claim (skipped)`);
      return;
    }
    console.warn(`  ${label}: ${msg}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
