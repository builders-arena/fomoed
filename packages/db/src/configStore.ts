import type { ConfigRecord, ConfigStore } from '@float/core';
import type { PublicKey } from '@solana/web3.js';
import { prisma } from './client.js';

/**
 * Postgres-backed {@link ConfigStore} — the production replacement for the
 * file-backed store used in Phase 1. Implements the same interface so
 * `planLaunch` / `recordNewConfig` work unchanged.
 */
export class PrismaConfigStore implements ConfigStore {
  async get(quoteMint: PublicKey): Promise<ConfigRecord | null> {
    const row = await prisma.poolConfig.findUnique({
      where: { quoteMint: quoteMint.toBase58() },
    });
    if (!row) return null;
    return {
      quoteMint: row.quoteMint,
      configPubkey: row.configPubkey,
      createdAt: row.createdAt.toISOString(),
      createdByTx: row.createdByTx,
    };
  }

  async put(record: ConfigRecord): Promise<void> {
    await prisma.poolConfig.upsert({
      where: { quoteMint: record.quoteMint },
      create: {
        quoteMint: record.quoteMint,
        configPubkey: record.configPubkey,
        createdAt: new Date(record.createdAt),
        createdByTx: record.createdByTx,
      },
      update: {
        configPubkey: record.configPubkey,
        createdByTx: record.createdByTx,
      },
    });
  }
}
