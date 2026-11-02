import { readFileSync } from 'node:fs';
import { Keypair, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import { loadEnv, type Env } from './env.js';

/**
 * Keypair / address loading.
 *
 * A wallet source is either:
 *   - a path to a JSON file holding a 64-byte secret key array (solana-keygen
 *     format), or
 *   - a base58-encoded secret key string.
 *
 * On mainnet, fee_claimer / treasury / leftover-receiver are typically Squads
 * multisig *addresses* (no secret key available to this process). Those are
 * loaded as `PublicKey` via the `*_ADDRESS` env vars.
 */

/** Load a Keypair from a file path or a base58 secret-key string. */
export function loadKeypair(source: string): Keypair {
  const trimmed = source.trim();

  // Heuristic: a filesystem path (starts with . or / or ~, or ends in .json).
  const looksLikePath =
    trimmed.startsWith('.') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('~') ||
    trimmed.endsWith('.json');

  if (looksLikePath) {
    const raw = readFileSync(trimmed.replace(/^~/, process.env.HOME ?? '~'), 'utf8');
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr) || arr.some((n) => typeof n !== 'number')) {
      throw new Error(`Keypair file ${trimmed} is not a numeric secret-key array`);
    }
    return Keypair.fromSecretKey(Uint8Array.from(arr as number[]));
  }

  // Otherwise treat as base58 secret key.
  return Keypair.fromSecretKey(bs58.decode(trimmed));
}

/** Resolve a public key from an explicit address, else from a keypair source. */
function resolveAddress(address: string | undefined, keypairSource: string | undefined): PublicKey {
  if (address && address.length > 0) return new PublicKey(address);
  if (keypairSource && keypairSource.length > 0) return loadKeypair(keypairSource).publicKey;
  throw new Error('No address or keypair source provided');
}

export interface Wallets {
  /** Deployer/admin — pays rent, signs scripts. Always a live keypair. */
  admin: Keypair;
  /** Fee claimer address (may be a multisig with no local key). */
  feeClaimer: PublicKey;
  /** Leftover-receiver address (defaults to fee claimer if unset). */
  leftoverReceiver: PublicKey;
  /** Treasury address (defaults to fee claimer if unset). */
  treasury: PublicKey;
}

/** Load the wallet set needed for launches and config creation. */
export function loadWallets(e: Env = loadEnv()): Wallets {
  const admin = loadKeypair(e.ADMIN_KEYPAIR);
  const feeClaimer = resolveAddress(e.FEE_CLAIMER_ADDRESS, e.FEE_CLAIMER_KEYPAIR ?? e.ADMIN_KEYPAIR);
  const leftoverReceiver = e.LEFTOVER_RECEIVER_ADDRESS
    ? new PublicKey(e.LEFTOVER_RECEIVER_ADDRESS)
    : feeClaimer;
  const treasury = e.TREASURY_ADDRESS ? new PublicKey(e.TREASURY_ADDRESS) : feeClaimer;
  return { admin, feeClaimer, leftoverReceiver, treasury };
}
