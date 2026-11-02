import { z } from 'zod';

/**
 * Zod-validated process environment. Import `env` anywhere that needs config;
 * it is parsed once, lazily, on first access.
 *
 * RULE (CLAUDE.md): zod-validate every external input. Env is external input.
 */

const clusterSchema = z.enum(['devnet', 'mainnet-beta']);

const booleanish = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.enum(['true', 'false', '1', '0', '']))
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  CLUSTER: clusterSchema.default('devnet'),
  RPC_URL: z.string().url(),
  RPC_SEND_URL: z.string().url().optional().or(z.literal('')),

  // Wallet sources: a path to a JSON keypair file, or a base58 secret key.
  ADMIN_KEYPAIR: z.string().min(1),
  FEE_CLAIMER_KEYPAIR: z.string().optional(),
  FEE_CLAIMER_ADDRESS: z.string().optional(),
  LEFTOVER_RECEIVER_ADDRESS: z.string().optional(),
  PAYOUT_KEYPAIR: z.string().optional(),
  BUYBACK_KEYPAIR: z.string().optional(),
  AIRDROP_KEYPAIR: z.string().optional(),
  TREASURY_ADDRESS: z.string().optional(),

  // Safety.
  DRY_RUN: booleanish.default('true'),

  // Infra (used from Phase 3 onwards; optional in Phase 1).
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  HELIUS_WEBHOOK_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Parse and cache the environment. Throws a readable error on misconfig. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/** Lazily-validated environment. Accessing a field parses the env on first use. */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop: string) {
    return loadEnv()[prop as keyof Env];
  },
});

/** True when running against mainnet-beta. */
export function isMainnet(e: Env = loadEnv()): boolean {
  return e.CLUSTER === 'mainnet-beta';
}
