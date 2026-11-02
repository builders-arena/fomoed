import { loadEnv } from '@float/core';
import { prisma } from '@float/db';
import Fastify, { type FastifyInstance } from 'fastify';
import { handleTransaction, type IndexedTx } from './handler.js';

/**
 * Fastify server that receives Helius webhook deliveries and indexes them.
 *
 * Accepts both "raw" and "enhanced" Helius payloads (an array of tx objects);
 * fields are pulled defensively since the two shapes differ. Each delivery is
 * processed idempotently, so Helius retries are safe.
 */

const CURSOR_ID = 'indexer';

/* eslint-disable @typescript-eslint/no-explicit-any */
function adaptHeliusItem(item: any): IndexedTx | null {
  const signature: string | undefined =
    item?.signature ?? item?.transaction?.signatures?.[0] ?? item?.transaction?.signature;
  if (!signature) return null;

  const logs: string[] =
    item?.meta?.logMessages ??
    item?.transaction?.meta?.logMessages ??
    item?.logs ??
    [];

  const firstKey = item?.transaction?.message?.accountKeys?.[0];
  const feePayer: string =
    item?.feePayer ??
    (typeof firstKey === 'string' ? firstKey : firstKey?.pubkey) ??
    item?.accountData?.[0]?.account ??
    '';

  return {
    signature,
    slot: Number(item?.slot ?? 0),
    blockTime: item?.timestamp ?? item?.blockTime ?? null,
    logs: Array.isArray(logs) ? logs : [],
    feePayer,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function buildServer(): FastifyInstance {
  const env = loadEnv();
  const app = Fastify({ logger: true });

  app.get('/health', async () => ({ ok: true }));

  app.post('/webhook', async (request, reply) => {
    // Auth: a configured secret must match the Authorization header.
    const secret = env.HELIUS_WEBHOOK_SECRET;
    if (secret && secret.length > 0) {
      if (request.headers.authorization !== secret) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
    } else {
      request.log.warn('HELIUS_WEBHOOK_SECRET not set — webhook is unauthenticated');
    }

    const body = request.body;
    const items: unknown[] = Array.isArray(body) ? body : [body];

    let written = 0;
    let maxSlot = 0;
    let lastSig: string | null = null;

    for (const raw of items) {
      const tx = adaptHeliusItem(raw);
      if (!tx || tx.logs.length === 0) continue;
      try {
        written += await handleTransaction(tx);
        if (tx.slot > maxSlot) {
          maxSlot = tx.slot;
          lastSig = tx.signature;
        }
      } catch (err) {
        request.log.error({ err, sig: tx.signature }, 'failed to index tx');
      }
    }

    if (maxSlot > 0) {
      // Never let a late/out-of-order batch move the cursor backwards.
      const created = await prisma.cursor.upsert({
        where: { id: CURSOR_ID },
        create: { id: CURSOR_ID, lastSlot: BigInt(maxSlot), lastSig },
        update: {},
      });
      if (created.lastSlot < BigInt(maxSlot)) {
        await prisma.cursor.update({
          where: { id: CURSOR_ID },
          data: { lastSlot: BigInt(maxSlot), lastSig },
        });
      }
    }

    return reply.send({ received: items.length, written });
  });

  return app;
}
