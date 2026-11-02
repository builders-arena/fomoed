import { loadEnv } from '@float/core';
import { z } from 'zod';

/**
 * Bot-specific configuration layered on top of the shared core env. Thresholds
 * are in base units / USD and tuned conservatively; override via env.
 */

const botEnvSchema = z.object({
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ADMIN_API_TOKEN: z.string().optional(),
  ADMIN_API_PORT: z.coerce.number().default(8788),

  /** Flagship token the buyback burns. Set once launched (Phase 6). */
  FLAGSHIP_MINT: z.string().optional(),

  /** Minimum accrued quote fee (base units) before cycle claims a coin. */
  CYCLE_MIN_FEE: z.coerce.bigint().default(1_000_000n),
  /** Minimum USD a holder must be owed before we pay (else carry forward). */
  PAYOUT_MIN_USD: z.coerce.number().default(0.5),
  /** Transfers batched per payout tx. */
  PAYOUT_BATCH: z.coerce.number().default(10),
  /** Minimum pool balance (base units) before buyback/airdrop act on a mint. */
  BUCKET_MIN: z.coerce.bigint().default(1_000_000n),
  /** SOL (lamports) accumulated before the flagship buyback fires. */
  BUYBACK_SOL_TRIGGER: z.coerce.bigint().default(5_000_000_000n),
  /** Max slippage / price-impact tolerated on Jupiter swaps (bps). */
  SWAP_MAX_BPS: z.coerce.number().default(100),
  /** Exclude wallets with more than this many swaps in any single hour. */
  AIRDROP_MAX_SWAPS_PER_HOUR: z.coerce.number().default(100),
});

export type BotEnv = z.infer<typeof botEnvSchema>;

let cached: BotEnv | null = null;

export function botConfig(source: NodeJS.ProcessEnv = process.env): BotEnv {
  if (cached) return cached;
  const parsed = botEnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid bot env:\n${parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n')}`);
  }
  cached = parsed.data;
  return cached;
}

/** Repeatable-job intervals (ms). */
export const INTERVALS = {
  cycle: 5 * 60_000,
  payout: 10 * 60_000,
  buyback: 15 * 60_000,
  airdrop: 15 * 60_000,
  migrator: 60_000,
} as const;

/** True in dry-run mode (builds + simulates, never sends). */
export function isDryRun(): boolean {
  return loadEnv().DRY_RUN;
}
