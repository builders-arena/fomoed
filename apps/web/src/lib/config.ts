/** Cluster + RPC resolved from NEXT_PUBLIC_* env (inlined into the client). */
export const CLUSTER = process.env.NEXT_PUBLIC_CLUSTER ?? 'devnet';
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? process.env.RPC_URL ?? 'https://api.devnet.solana.com';
export const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? 'http://localhost:8788';
