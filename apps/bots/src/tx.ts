import { isDryRun } from './config.js';
import { prisma, TxStatus } from '@float/db';
import {
  ComputeBudgetProgram,
  Transaction,
  VersionedTransaction,
  type Connection,
  type PublicKey,
  type Signer,
} from '@solana/web3.js';

/**
 * Shared transaction sender for all bots.
 *
 * - prepends a compute-unit limit + a priority fee (percentile of recent fees)
 * - refreshes the blockhash and retries on expiry
 * - writes a `tx_log` row per attempt
 * - DRY_RUN builds + simulates but never sends
 * - optional `idemKey` makes a fund movement idempotent: if a prior CONFIRMED
 *   or SENT attempt exists for the key, it is skipped
 */

export interface SendArgs {
  connection: Connection;
  transaction: Transaction;
  signers: Signer[];
  feePayer: PublicKey;
  bot: string;
  action: string;
  pool?: string;
  mint?: string;
  idemKey?: string;
  computeUnitLimit?: number;
  maxAttempts?: number;
}

export interface SendResult {
  signature: string | null;
  status: 'SIMULATED' | 'CONFIRMED' | 'SKIPPED';
}

const DEFAULT_CU_LIMIT = 400_000;
const DEFAULT_PRIORITY_MICROLAMPORTS = 10_000;

/** 75th-percentile recent prioritization fee (microLamports/CU). */
async function priorityFee(connection: Connection): Promise<number> {
  try {
    const fees = await connection.getRecentPrioritizationFees();
    const values = fees.map((f) => f.prioritizationFee).filter((v) => v > 0).sort((a, b) => a - b);
    if (values.length === 0) return DEFAULT_PRIORITY_MICROLAMPORTS;
    const idx = Math.floor(values.length * 0.75);
    return values[Math.min(idx, values.length - 1)] ?? DEFAULT_PRIORITY_MICROLAMPORTS;
  } catch {
    return DEFAULT_PRIORITY_MICROLAMPORTS;
  }
}

async function logAttempt(args: {
  bot: string;
  action: string;
  status: TxStatus;
  attempt: number;
  signature?: string | null;
  pool?: string;
  mint?: string;
  dryRun: boolean;
  idemKey?: string;
  error?: string;
}): Promise<void> {
  await prisma.txLog.create({
    data: {
      bot: args.bot,
      action: args.action,
      status: args.status,
      attempt: args.attempt,
      signature: args.signature ?? null,
      pool: args.pool,
      mint: args.mint,
      dryRun: args.dryRun,
      idemKey: args.idemKey,
      error: args.error,
    },
  });
}

export async function sendTx(args: SendArgs): Promise<SendResult> {
  const dryRun = isDryRun();
  const maxAttempts = args.maxAttempts ?? 3;

  // Idempotency: skip if this action already landed.
  if (args.idemKey && !dryRun) {
    const prior = await prisma.txLog.findFirst({
      where: { idemKey: args.idemKey, status: { in: [TxStatus.CONFIRMED, TxStatus.SENT] } },
    });
    if (prior) return { signature: prior.signature, status: 'SKIPPED' };
  }

  const priceMicroLamports = await priorityFee(args.connection);
  const base = args.transaction.instructions;
  const build = (): Transaction => {
    const tx = new Transaction();
    tx.add(
      ComputeBudgetProgram.setComputeUnitLimit({ units: args.computeUnitLimit ?? DEFAULT_CU_LIMIT }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priceMicroLamports }),
      ...base,
    );
    tx.feePayer = args.feePayer;
    return tx;
  };

  if (dryRun) {
    const tx = build();
    const { blockhash } = await args.connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.sign(...args.signers);
    const sim = await args.connection.simulateTransaction(tx);
    if (sim.value.err) {
      await logAttempt({ ...meta(args), status: TxStatus.FAILED, attempt: 1, dryRun: true, error: JSON.stringify(sim.value.err) });
      throw new Error(`[DRY_RUN] ${args.action} simulation failed: ${JSON.stringify(sim.value.err)}`);
    }
    await logAttempt({ ...meta(args), status: TxStatus.SIMULATED, attempt: 1, dryRun: true });
    return { signature: null, status: 'SIMULATED' };
  }

  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const tx = build();
      const { blockhash, lastValidBlockHeight } = await args.connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.sign(...args.signers);
      const signature = await args.connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
      });
      await logAttempt({ ...meta(args), status: TxStatus.SENT, attempt, signature, dryRun: false });
      await args.connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        'confirmed',
      );
      await logAttempt({ ...meta(args), status: TxStatus.CONFIRMED, attempt, signature, dryRun: false });
      return { signature, status: 'CONFIRMED' };
    } catch (err) {
      lastErr = err;
      await logAttempt({
        ...meta(args),
        status: TxStatus.FAILED,
        attempt,
        dryRun: false,
        error: err instanceof Error ? err.message : String(err),
      });
      // Retry with a fresh blockhash on expiry; otherwise rethrow.
      const msg = err instanceof Error ? err.message : String(err);
      if (!/expired|blockhash|block height exceeded/i.test(msg)) break;
    }
  }
  throw new Error(`${args.action} failed after ${maxAttempts} attempts: ${lastErr instanceof Error ? lastErr.message : lastErr}`);
}

function meta(args: SendArgs): { bot: string; action: string; pool?: string; mint?: string; idemKey?: string } {
  return { bot: args.bot, action: args.action, pool: args.pool, mint: args.mint, idemKey: args.idemKey };
}

/**
 * Send a pre-built VersionedTransaction (e.g. from Jupiter, which already
 * carries its own compute budget and blockhash). DRY_RUN simulates only.
 */
export async function sendVersionedTx(args: {
  connection: Connection;
  vtx: VersionedTransaction;
  signers: Signer[];
  bot: string;
  action: string;
  mint?: string;
  idemKey?: string;
}): Promise<SendResult> {
  const dryRun = isDryRun();

  if (args.idemKey && !dryRun) {
    const prior = await prisma.txLog.findFirst({
      where: { idemKey: args.idemKey, status: { in: [TxStatus.CONFIRMED, TxStatus.SENT] } },
    });
    if (prior) return { signature: prior.signature, status: 'SKIPPED' };
  }

  const common = { bot: args.bot, action: args.action, mint: args.mint, idemKey: args.idemKey };

  if (dryRun) {
    const sim = await args.connection.simulateTransaction(args.vtx, { sigVerify: false });
    if (sim.value.err) {
      await logAttempt({ ...common, status: TxStatus.FAILED, attempt: 1, dryRun: true, error: JSON.stringify(sim.value.err) });
      throw new Error(`[DRY_RUN] ${args.action} simulation failed: ${JSON.stringify(sim.value.err)}`);
    }
    await logAttempt({ ...common, status: TxStatus.SIMULATED, attempt: 1, dryRun: true });
    return { signature: null, status: 'SIMULATED' };
  }

  args.vtx.sign(args.signers);
  const signature = await args.connection.sendRawTransaction(args.vtx.serialize(), {
    skipPreflight: false,
  });
  await logAttempt({ ...common, status: TxStatus.SENT, attempt: 1, signature, dryRun: false });
  const { blockhash, lastValidBlockHeight } = await args.connection.getLatestBlockhash();
  await args.connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  await logAttempt({ ...common, status: TxStatus.CONFIRMED, attempt: 1, signature, dryRun: false });
  return { signature, status: 'CONFIRMED' };
}
