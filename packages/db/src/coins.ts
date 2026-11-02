import { prisma } from './client.js';

/**
 * Register (or update) a coin row. Called right after a launch confirms — the
 * indexer only accepts events for pools that already exist here, so this must
 * run before the first swap is indexed.
 */
export interface RegisterCoinInput {
  pool: string;
  baseMint: string;
  quoteMint: string;
  config: string;
  creator: string;
  ticker: string;
  name: string;
  uri: string;
  creatorWallet?: string;
  dammPool?: string;
  partnerPosition?: string;
  migrationState?: number;
}

export async function registerCoin(input: RegisterCoinInput): Promise<void> {
  await prisma.coin.upsert({
    where: { pool: input.pool },
    create: {
      pool: input.pool,
      baseMint: input.baseMint,
      quoteMint: input.quoteMint,
      config: input.config,
      creator: input.creator,
      creatorWallet: input.creatorWallet,
      ticker: input.ticker,
      name: input.name,
      uri: input.uri,
      dammPool: input.dammPool,
      partnerPosition: input.partnerPosition,
      migrationState: input.migrationState ?? 0,
    },
    update: {
      baseMint: input.baseMint,
      quoteMint: input.quoteMint,
      config: input.config,
      creator: input.creator,
      ticker: input.ticker,
      name: input.name,
      uri: input.uri,
      ...(input.creatorWallet !== undefined ? { creatorWallet: input.creatorWallet } : {}),
      ...(input.dammPool !== undefined ? { dammPool: input.dammPool } : {}),
      ...(input.partnerPosition !== undefined ? { partnerPosition: input.partnerPosition } : {}),
      ...(input.migrationState !== undefined ? { migrationState: input.migrationState } : {}),
    },
  });
}
