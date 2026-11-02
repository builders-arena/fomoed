import { getConnection, loadKeypair } from '@float/core';
import { DynamicBondingCurveClient } from '@meteora-ag/dynamic-bonding-curve-sdk';
import {
  getAccount,
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { Keypair, PublicKey, type Connection } from '@solana/web3.js';
import pino from 'pino';

export const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });

/** Load a bot hot-wallet keypair from its env var (throws if unset). */
function requireKeypair(envVar: string): Keypair {
  const v = process.env[envVar];
  if (!v) throw new Error(`${envVar} is not set`);
  return loadKeypair(v);
}

export const payoutWallet = (): Keypair => requireKeypair('PAYOUT_KEYPAIR');
export const buybackWallet = (): Keypair => requireKeypair('BUYBACK_KEYPAIR');
export const airdropWallet = (): Keypair => requireKeypair('AIRDROP_KEYPAIR');

let dbc: DynamicBondingCurveClient | null = null;
export function dbcClient(): DynamicBondingCurveClient {
  if (!dbc) dbc = DynamicBondingCurveClient.create(getConnection(), 'confirmed');
  return dbc;
}

/** SPL vs Token-2022 program that owns a mint. */
export async function tokenProgramForMint(
  connection: Connection,
  mint: PublicKey,
): Promise<PublicKey> {
  const info = await connection.getAccountInfo(mint);
  if (!info) throw new Error(`Mint ${mint.toBase58()} not found`);
  return info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
}

/** ATA balance (base units), 0 if the account does not exist. */
export async function ataBalance(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  tokenProgram: PublicKey,
): Promise<bigint> {
  const ata = getAssociatedTokenAddressSync(mint, owner, true, tokenProgram);
  try {
    const acc = await getAccount(connection, ata, 'confirmed', tokenProgram);
    return acc.amount;
  } catch {
    return 0n;
  }
}

const decimalsCache = new Map<string, number>();
export async function mintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
  const key = mint.toBase58();
  const hit = decimalsCache.get(key);
  if (hit !== undefined) return hit;
  const d = (await connection.getTokenSupply(mint)).value.decimals;
  decimalsCache.set(key, d);
  return d;
}
