import { recordNewConfig } from '@float/core';
import { PrismaConfigStore, registerCoin } from '@float/db';
import { PublicKey } from '@solana/web3.js';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({
  coin: z.object({
    pool: z.string(),
    baseMint: z.string(),
    quoteMint: z.string(),
    config: z.string(),
    creator: z.string(),
    creatorWallet: z.string().optional(),
    ticker: z.string(),
    name: z.string(),
    uri: z.string(),
  }),
  /** Set when a new config was created, so we persist it for reuse. */
  configTx: z.string().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'invalid' }, { status: 400 });
  }
  const { coin, configTx } = parsed.data;

  await registerCoin(coin);
  if (configTx) {
    await recordNewConfig(
      new PrismaConfigStore(),
      new PublicKey(coin.quoteMint),
      new PublicKey(coin.config),
      configTx,
    );
  }
  return NextResponse.json({ ok: true, pool: coin.pool });
}
