import { createInterface } from 'node:readline/promises';
import {
  getConnection,
  isMainnet,
  loadEnv,
  QUOTE_DECIMALS,
  USDC_MINT_DEVNET,
  USDC_MINT_MAINNET,
  WSOL_MINT,
  JUP_MINT,
  FileConfigStore,
  type ConfigStore,
} from '@float/core';
import {
  DynamicBondingCurveClient,
  type DynamicBondingCurveClient as DbcClient,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import {
  Keypair,
  PublicKey,
  Transaction,
  type Connection,
  type Signer,
} from '@solana/web3.js';

/** Minimal `--flag value` / `--flag` parser. Returns a string map + booleans. */
export function parseArgs(argv: string[] = process.argv.slice(2)): Record<string, string | true> {
  const out: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a?.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = true;
    }
  }
  return out;
}

export function requireArg(args: Record<string, string | true>, name: string): string {
  const v = args[name];
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Missing required --${name}`);
  }
  return v;
}

/** DBC client bound to the configured RPC. */
export function getClient(): DbcClient {
  return DynamicBondingCurveClient.create(getConnection(), 'confirmed');
}

/** File-backed config store, namespaced by cluster. */
export function getConfigStore(): ConfigStore {
  const e = loadEnv();
  return new FileConfigStore(`./.float/configs.${e.CLUSTER}.json`);
}

/** Known quote mints we ship first → decimals + a fallback USD price. */
const KNOWN_QUOTE: Record<string, { decimals: number; fallbackUsd: number }> = {
  [WSOL_MINT.toBase58()]: { decimals: QUOTE_DECIMALS.SOL, fallbackUsd: 150 },
  [USDC_MINT_MAINNET.toBase58()]: { decimals: QUOTE_DECIMALS.USDC, fallbackUsd: 1 },
  [USDC_MINT_DEVNET.toBase58()]: { decimals: QUOTE_DECIMALS.USDC, fallbackUsd: 1 },
  [JUP_MINT.toBase58()]: { decimals: QUOTE_DECIMALS.JUP, fallbackUsd: 1 },
};

/**
 * Resolve quote-mint decimals and USD price. Prefers explicit args, falls back
 * to known-mint defaults. A live price feed replaces the fallbacks in Phase 4.
 */
export function resolveQuoteMeta(
  quoteMint: PublicKey,
  args: Record<string, string | true>,
): { decimals: number; usdPrice: number } {
  const known = KNOWN_QUOTE[quoteMint.toBase58()];
  const decimals =
    typeof args['quote-decimals'] === 'string'
      ? Number(args['quote-decimals'])
      : known?.decimals;
  const usdPrice =
    typeof args['quote-usd-price'] === 'string'
      ? Number(args['quote-usd-price'])
      : known?.fallbackUsd;
  if (decimals === undefined || !Number.isFinite(decimals)) {
    throw new Error('Unknown quote mint: pass --quote-decimals');
  }
  if (usdPrice === undefined || !Number.isFinite(usdPrice) || usdPrice <= 0) {
    throw new Error('Unknown quote mint: pass --quote-usd-price');
  }
  return { decimals, usdPrice };
}

/** Block mainnet actions behind an explicit typed confirmation. */
export async function confirmMainnet(action: string): Promise<void> {
  if (!isMainnet()) return;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(
    `\n⚠️  CLUSTER=mainnet-beta. About to: ${action}\n   Type "mainnet" to proceed: `,
  );
  rl.close();
  if (answer.trim() !== 'mainnet') {
    throw new Error('Aborted: mainnet confirmation not given');
  }
}

export interface SendResult {
  signature: string;
  simulated: boolean;
}

/**
 * Sign and either simulate (DRY_RUN) or send+confirm a legacy transaction.
 * Sets fee payer and a fresh blockhash. Prints logs on simulation.
 */
export async function sendOrSimulate(
  connection: Connection,
  tx: Transaction,
  signers: Signer[],
  opts: { feePayer: PublicKey; label: string },
): Promise<SendResult> {
  const dryRun = loadEnv().DRY_RUN;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.feePayer = opts.feePayer;
  tx.recentBlockhash = blockhash;
  tx.sign(...signers);

  if (dryRun) {
    const sim = await connection.simulateTransaction(tx);
    if (sim.value.err) {
      console.error(`[DRY_RUN] ${opts.label} simulation FAILED:`, sim.value.err);
      for (const line of sim.value.logs ?? []) console.error('   ', line);
      throw new Error(`${opts.label} simulation failed`);
    }
    console.log(`[DRY_RUN] ${opts.label} simulation OK (${sim.value.unitsConsumed ?? '?'} CU)`);
    return { signature: 'SIMULATED', simulated: true };
  }

  const raw = tx.serialize();
  const signature = await connection.sendRawTransaction(raw, { skipPreflight: false });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');
  console.log(`${opts.label} sent: ${signature}`);
  return { signature, simulated: false };
}

export { Keypair, PublicKey };
