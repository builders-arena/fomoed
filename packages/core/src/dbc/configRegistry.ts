import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Keypair, PublicKey } from '@solana/web3.js';
import { z } from 'zod';

/**
 * Config registry.
 *
 * DBC `PoolConfig`s are plain keypairs — there is no deterministic PDA to
 * derive, so we must *remember* which config pubkey we created for each quote
 * mint. The plan calls for a Postgres table:
 *
 *   pool_configs(quote_mint pk, config_pubkey, created_at, created_by_tx)
 *
 * That table is implemented in Phase 3 (`@float/db`). To keep Phase 1
 * self-contained (and to satisfy the "second launch reuses the config" DoD on
 * devnet without standing up Postgres), the store is an interface with a
 * file-backed default here. Phase 3 provides a `PrismaConfigStore` with the
 * same interface.
 */

export const configRecordSchema = z.object({
  quoteMint: z.string(),
  configPubkey: z.string(),
  createdAt: z.string(),
  createdByTx: z.string(),
});

export type ConfigRecord = z.infer<typeof configRecordSchema>;

export interface ConfigStore {
  get(quoteMint: PublicKey): Promise<ConfigRecord | null>;
  put(record: ConfigRecord): Promise<void>;
}

// --- File-backed store (Phase 1 / devnet) -----------------------------------

const fileSchema = z.object({ configs: z.array(configRecordSchema) });

export class FileConfigStore implements ConfigStore {
  constructor(private readonly path: string) {}

  private readAll(): ConfigRecord[] {
    if (!existsSync(this.path)) return [];
    const parsed = fileSchema.safeParse(JSON.parse(readFileSync(this.path, 'utf8')));
    if (!parsed.success) {
      throw new Error(`Corrupt config store at ${this.path}: ${parsed.error.message}`);
    }
    return parsed.data.configs;
  }

  async get(quoteMint: PublicKey): Promise<ConfigRecord | null> {
    const key = quoteMint.toBase58();
    return this.readAll().find((r) => r.quoteMint === key) ?? null;
  }

  async put(record: ConfigRecord): Promise<void> {
    configRecordSchema.parse(record);
    const all = this.readAll().filter((r) => r.quoteMint !== record.quoteMint);
    all.push(record);
    mkdirSync(dirname(this.path), { recursive: true });
    writeFileSync(this.path, JSON.stringify({ configs: all }, null, 2));
  }
}

// --- Launch planning --------------------------------------------------------

/** What `launch.ts` must do for a given quote mint. */
export type LaunchPlan =
  | { mode: 'reuse'; config: PublicKey }
  | { mode: 'create'; config: Keypair };

/**
 * Decide whether to reuse an existing config or create a new one.
 *
 * In `create` mode a fresh config Keypair is generated; the caller passes its
 * public key to `createConfigAndPoolWithFirstBuy`, signs with it, and on
 * confirmation calls {@link recordNewConfig} to persist it so the *next*
 * launch on this quote mint reuses it (via `createPoolWithFirstBuy`).
 */
export async function planLaunch(store: ConfigStore, quoteMint: PublicKey): Promise<LaunchPlan> {
  const existing = await store.get(quoteMint);
  if (existing) {
    return { mode: 'reuse', config: new PublicKey(existing.configPubkey) };
  }
  return { mode: 'create', config: Keypair.generate() };
}

/** Persist a newly created config after its creation tx confirms. */
export async function recordNewConfig(
  store: ConfigStore,
  quoteMint: PublicKey,
  config: PublicKey,
  createdByTx: string,
): Promise<void> {
  await store.put({
    quoteMint: quoteMint.toBase58(),
    configPubkey: config.toBase58(),
    createdAt: new Date().toISOString(),
    createdByTx,
  });
}
