/**
 * backfill.ts — replay a pool's full history through the indexer's parser so
 * past swaps land in Postgres (and holder balances rebuild from deltas).
 *
 *   pnpm --filter @float/scripts exec tsx src/backfill.ts --pool <pubkey> [--max 2000]
 *
 * Walks getSignaturesForAddress from newest to oldest, then replays oldest-first
 * through the same handleTransaction used by the live webhook. Idempotent.
 */
import { getConnection } from '@float/core';
import { prisma } from '@float/db';
import { handleTransaction, type IndexedTx } from '@float/indexer';
import type { ConfirmedSignatureInfo } from '@solana/web3.js';
import { parseArgs, PublicKey, requireArg } from './_shared.js';

async function main(): Promise<void> {
  const args = parseArgs();
  const pool = new PublicKey(requireArg(args, 'pool'));
  const max = typeof args['max'] === 'string' ? Number(args['max']) : 5000;

  const connection = getConnection();

  // Collect signatures (newest first), paging until exhausted or max reached.
  const sigs: ConfirmedSignatureInfo[] = [];
  let before: string | undefined;
  while (sigs.length < max) {
    const batch = await connection.getSignaturesForAddress(pool, { before, limit: 1000 });
    if (batch.length === 0) break;
    sigs.push(...batch);
    before = batch[batch.length - 1]?.signature;
    if (batch.length < 1000) break;
  }
  const ordered = sigs.slice(0, max).reverse(); // oldest first
  console.log(`Backfilling ${ordered.length} signatures for ${pool.toBase58()}`);

  let written = 0;
  for (let i = 0; i < ordered.length; i++) {
    const info = ordered[i];
    if (!info || info.err) continue;
    const tx = await connection.getTransaction(info.signature, {
      maxSupportedTransactionVersion: 0,
      commitment: 'confirmed',
    });
    if (!tx?.meta?.logMessages) continue;

    const feePayer = tx.transaction.message.staticAccountKeys[0]?.toBase58() ?? '';
    const indexed: IndexedTx = {
      signature: info.signature,
      slot: tx.slot,
      blockTime: tx.blockTime ?? null,
      logs: tx.meta.logMessages,
      feePayer,
    };
    written += await handleTransaction(indexed);
    if ((i + 1) % 100 === 0) console.log(`  ...${i + 1}/${ordered.length}`);
  }

  console.log(`Backfill done: ${written} new swap rows.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    await prisma.$disconnect();
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
