import {
  deriveMigratedPoolAddress,
  getConnection,
  getCpAmm,
  getPartnerPosition,
  loadWallets,
} from '@float/core';
import { prisma } from '@float/db';
import {
  DAMM_V2_MIGRATION_FEE_ADDRESS,
  MigrationFeeOption,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import { PublicKey } from '@solana/web3.js';
import { dbcClient, log } from '../shared.js';
import { sendTx } from '../tx.js';

const POST_BONDING = 1;
const CREATED_POOL = 3;
const MIN_AGE_MS = 3 * 60_000;

/** Migrate completed-but-unmigrated pools to DAMM v2, after a short settle delay. */
export async function runMigrator(): Promise<void> {
  const wallets = loadWallets();
  const connection = getConnection();
  const dbc = dbcClient();

  const candidates = await prisma.coin.findMany({ where: { migrationState: { lt: CREATED_POOL } } });
  for (const coin of candidates) {
    try {
      const vp = await dbc.state.getPool(coin.pool).catch(() => null);
      if (!vp) continue;
      const progress = vp.poolState.migrationProgress;
      if (progress < POST_BONDING || progress >= CREATED_POOL) continue;

      const finishTs = Number(vp.poolState.finishCurveTimestamp.toString()) * 1000;
      if (finishTs > 0 && Date.now() - finishTs < MIN_AGE_MS) continue;

      const config = await dbc.state.getPoolConfig(vp.poolState.config);
      if (!config) continue;
      const feeOption = config.migrationFeeOption as MigrationFeeOption;
      const dammConfig = DAMM_V2_MIGRATION_FEE_ADDRESS[feeOption];
      if (!dammConfig) continue;

      const { transaction, firstPositionNftKeypair, secondPositionNftKeypair } =
        await dbc.migration.migrateToDammV2({
          payer: wallets.admin.publicKey,
          pool: new PublicKey(coin.pool),
          dammConfig,
        });

      const res = await sendTx({
        connection,
        transaction,
        signers: [wallets.admin, firstPositionNftKeypair, secondPositionNftKeypair],
        feePayer: wallets.admin.publicKey,
        bot: 'migrator',
        action: 'migrate',
        pool: coin.pool,
        idemKey: `migrate:${coin.pool}`,
      });

      if (res.status !== 'CONFIRMED') {
        log.info({ pool: coin.pool }, 'migrator: migration simulated (dry-run) or skipped');
        continue;
      }

      const dammPool = deriveMigratedPoolAddress(
        new PublicKey(coin.baseMint),
        new PublicKey(coin.quoteMint),
        feeOption,
      );
      const partner = await getPartnerPosition(getCpAmm(), dammPool);
      await prisma.coin.update({
        where: { pool: coin.pool },
        data: {
          migrationState: CREATED_POOL,
          dammPool: dammPool.toBase58(),
          partnerPosition: partner?.position.toBase58(),
        },
      });
      log.info({ pool: coin.pool, dammPool: dammPool.toBase58() }, 'migrator: migrated');
    } catch (err) {
      log.error({ err, pool: coin.pool }, 'migrator: coin failed');
    }
  }
}
