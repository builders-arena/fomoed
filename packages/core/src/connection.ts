import { Connection, type Commitment } from '@solana/web3.js';
import { loadEnv } from './env.js';

/**
 * Solana RPC connection factory. One read connection; an optional separate
 * send endpoint (some providers split reads and sends).
 */

let readConnection: Connection | null = null;

export function getConnection(commitment: Commitment = 'confirmed'): Connection {
  if (readConnection) return readConnection;
  const e = loadEnv();
  readConnection = new Connection(e.RPC_URL, { commitment });
  return readConnection;
}

export function getSendConnection(commitment: Commitment = 'confirmed'): Connection {
  const e = loadEnv();
  const url = e.RPC_SEND_URL && e.RPC_SEND_URL.length > 0 ? e.RPC_SEND_URL : e.RPC_URL;
  return new Connection(url, { commitment });
}
