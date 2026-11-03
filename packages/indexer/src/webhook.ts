import { prisma } from '@float/db';
import { handleTransaction, type IndexedTx } from './handler.js';

/**
 * Shared Helius-webhook processing, used by both the Fastify server and the
 * serverless API route. Accepts both "raw" and "enhanced" Helius payloads.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
export function adaptHeliusItem(item: any): IndexedTx | null {
  const signature: string | undefined =
    item?.signature ?? item?.transaction?.signatures?.[0] ?? item?.transaction?.signature;
  if (!signature) return null;

  const logs: string[] =
    item?.meta?.logMessages ?? item?.transaction?.meta?.logMessages ?? item?.logs ?? [];

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

const CURSOR_ID = 'indexer';

/** Process a webhook body (array of tx objects). Returns counts + advances the cursor. */
export async function handleWebhookPayload(
  body: unknown,
): Promise<{ received: number; written: number }> {
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
    } catch {
      // swallow per-tx failures; the delivery is retried by Helius
    }
  }

  if (maxSlot > 0) {
    const cur = await prisma.cursor.upsert({
      where: { id: CURSOR_ID },
      create: { id: CURSOR_ID, lastSlot: BigInt(maxSlot), lastSig },
      update: {},
    });
    if (cur.lastSlot < BigInt(maxSlot)) {
      await prisma.cursor.update({
        where: { id: CURSOR_ID },
        data: { lastSlot: BigInt(maxSlot), lastSig },
      });
    }
  }

  return { received: items.length, written };
}
