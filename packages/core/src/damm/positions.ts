import {
  CpAmm,
  derivePositionNftAccount,
  getTokenProgram,
  type PoolState,
  type PositionState,
} from '@meteora-ag/cp-amm-sdk';
import {
  DAMM_V2_MIGRATION_FEE_ADDRESS,
  deriveDammV2PoolAddress,
  MigrationFeeOption,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import { PublicKey, type Transaction } from '@solana/web3.js';

/**
 * DAMM v2 position helpers for migrated Float pools.
 *
 * After a DBC pool migrates, 100% of liquidity is permanently locked in a
 * single partner position owned by `fee_claimer`. These helpers locate that
 * position and build its fee-claim transaction.
 */

export interface DammPosition {
  position: PublicKey;
  positionNftAccount: PublicKey;
  positionState: PositionState;
}

/**
 * Sort two mints into canonical (tokenA, tokenB) order — tokenA has the
 * smaller public-key bytes, matching how DAMM v2 keys a pool.
 */
export function sortMints(a: PublicKey, b: PublicKey): [PublicKey, PublicKey] {
  return Buffer.compare(a.toBuffer(), b.toBuffer()) <= 0 ? [a, b] : [b, a];
}

/**
 * Derive the migrated DAMM v2 pool address for a base/quote pair. The migration
 * "config" is the fixed fee-option address (we always migrate with
 * `Customizable`).
 */
export function deriveMigratedPoolAddress(
  baseMint: PublicKey,
  quoteMint: PublicKey,
  migrationFeeOption: MigrationFeeOption = MigrationFeeOption.Customizable,
): PublicKey {
  const dammConfig = DAMM_V2_MIGRATION_FEE_ADDRESS[migrationFeeOption];
  if (!dammConfig) {
    throw new Error(`No DAMM v2 migration fee address for option ${migrationFeeOption}`);
  }
  const [tokenA, tokenB] = sortMints(baseMint, quoteMint);
  return deriveDammV2PoolAddress(dammConfig, tokenA, tokenB);
}

/**
 * Find the permanently-locked partner position on a migrated pool. Partner
 * liquidity is 100% permanent-locked and creator liquidity is 0, so there is
 * exactly one such position.
 */
export async function getPartnerPosition(
  cpAmm: CpAmm,
  pool: PublicKey,
): Promise<DammPosition | null> {
  const positions = await cpAmm.getAllPositionsByPool(pool);
  for (const p of positions) {
    if (cpAmm.isPermanentLockedPosition(p.account)) {
      return {
        position: p.publicKey,
        positionNftAccount: derivePositionNftAccount(p.account.nftMint),
        positionState: p.account,
      };
    }
  }
  return null;
}

export interface ClaimPositionFeeArgs {
  pool: PublicKey;
  position: PublicKey;
  positionNftAccount: PublicKey;
  /** Position NFT owner (fee_claimer) — signs the claim. */
  owner: PublicKey;
  /** Defaults to `owner`. */
  receiver?: PublicKey;
  feePayer?: PublicKey;
  /** Avoids a refetch when the caller already has the pool state. */
  poolState?: PoolState;
}

/** Build a transaction that claims the position's accrued fees. */
export async function buildClaimPositionFeeTx(
  cpAmm: CpAmm,
  args: ClaimPositionFeeArgs,
): Promise<Transaction> {
  const pool = args.poolState ?? (await cpAmm.fetchPoolState(args.pool));
  return cpAmm.claimPositionFee({
    owner: args.owner,
    position: args.position,
    pool: args.pool,
    positionNftAccount: args.positionNftAccount,
    tokenAMint: pool.tokenAMint,
    tokenBMint: pool.tokenBMint,
    tokenAVault: pool.tokenAVault,
    tokenBVault: pool.tokenBVault,
    tokenAProgram: getTokenProgram(pool.tokenAFlag),
    tokenBProgram: getTokenProgram(pool.tokenBFlag),
    receiver: args.receiver,
    feePayer: args.feePayer,
  });
}
