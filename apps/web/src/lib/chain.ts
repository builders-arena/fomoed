import 'server-only';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { Connection } from '@solana/web3.js';
import { RPC_URL } from './config.js';

export interface PoolSnapshot {
  progress: number;
  migrationProgress: number;
  isMigrated: boolean;
  baseReserve: string;
  quoteReserve: string;
}

/** Best-effort on-chain snapshot of a DBC pool. Returns null if RPC fails. */
export async function getPoolSnapshot(pool: string): Promise<PoolSnapshot | null> {
  try {
    const connection = new Connection(RPC_URL, 'confirmed');
    const client = DynamicBondingCurveClient.create(connection, 'confirmed');
    const vp = await client.state.getPool(pool);
    if (!vp) return null;
    const progress = await client.state.getPoolQuoteTokenCurveProgress(pool).catch(() => 0);
    return {
      progress,
      migrationProgress: vp.poolState.migrationProgress,
      isMigrated: Boolean(vp.poolState.isMigrated),
      baseReserve: vp.poolState.baseReserve.toString(),
      quoteReserve: vp.poolState.quoteReserve.toString(),
    };
  } catch {
    return null;
  }
}
