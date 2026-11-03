import { buildPartnerConfig, planLaunch } from '@float/core';
import { PrismaConfigStore, prisma } from '@float/db';
import { DynamicBondingCurveClient, deriveDbcPoolAddress } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import BN from 'bn.js';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RPC_URL } from '@/lib/config';
import { pairFor } from '@/lib/pairs';
import { getQuoteUsdPrice } from '@/lib/price';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  name: z.string().min(1).max(64),
  symbol: z.string().regex(/^[A-Za-z0-9]{1,10}$/, 'ticker must be 1–10 alphanumerics'),
  uri: z.string().url(),
  quoteMint: z.string(),
  creator: z.string(),
  firstBuy: z.string().default('0'),
});

function toBaseUnits(value: string, decimals: number): BN {
  const [whole, frac = ''] = value.split('.');
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const digits = `${whole}${padded}`.replace(/^0+(?=\d)/, '');
  return new BN(digits.length ? digits : '0');
}

function serialize(tx: Transaction): string {
  return tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString('base64');
}

export async function POST(req: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'invalid' }, { status: 400 });
  }
  const body = parsed.data;
  const cluster = process.env.NEXT_PUBLIC_CLUSTER ?? 'devnet';

  // Ticker uniqueness (case-insensitive).
  const existing = await prisma.coin.findFirst({
    where: { ticker: { equals: body.symbol, mode: 'insensitive' } },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Ticker ${body.symbol} is taken`, duplicate: true },
      { status: 409 },
    );
  }

  const pair = pairFor(cluster, body.quoteMint);
  if (!pair) return NextResponse.json({ error: 'unsupported quote mint' }, { status: 400 });

  const feeClaimerAddr = process.env.FEE_CLAIMER_ADDRESS;
  const leftoverAddr = process.env.LEFTOVER_RECEIVER_ADDRESS ?? feeClaimerAddr;

  const connection = new Connection(RPC_URL, 'confirmed');
  const client = DynamicBondingCurveClient.create(connection, 'confirmed');
  const store = new PrismaConfigStore();

  const quoteMint = new PublicKey(body.quoteMint);
  const creator = new PublicKey(body.creator);
  const baseMint = Keypair.generate();
  const plan = await planLaunch(store, quoteMint);
  const configPubkey = plan.mode === 'create' ? plan.config.publicKey : plan.config;

  const firstBuyParam = {
    buyer: creator,
    buyAmount: toBaseUnits(body.firstBuy, pair.decimals),
    minimumAmountOut: new BN(0),
    referralTokenAccount: null,
  };

  const { blockhash } = await connection.getLatestBlockhash();
  const txs: string[] = [];

  if (plan.mode === 'create') {
    if (!feeClaimerAddr || !leftoverAddr) {
      return NextResponse.json(
        { error: 'server missing FEE_CLAIMER_ADDRESS/LEFTOVER_RECEIVER_ADDRESS for config creation' },
        { status: 500 },
      );
    }
    const configParams = buildPartnerConfig({
      quoteMint: body.quoteMint,
      quoteDecimals: pair.decimals,
      quoteUsdPrice: await getQuoteUsdPrice(body.quoteMint, pair.symbol),
    });
    const { createConfigTx, createPoolWithFirstBuyTx } =
      await client.partner.createConfigAndPoolWithFirstBuy({
        ...configParams,
        config: plan.config.publicKey,
        feeClaimer: new PublicKey(feeClaimerAddr),
        leftoverReceiver: new PublicKey(leftoverAddr),
        quoteMint,
        payer: creator,
        preCreatePoolParam: {
          name: body.name,
          symbol: body.symbol,
          uri: body.uri,
          poolCreator: creator,
          baseMint: baseMint.publicKey,
        },
        firstBuyParam,
      });

    createConfigTx.feePayer = creator;
    createConfigTx.recentBlockhash = blockhash;
    createConfigTx.partialSign(plan.config);
    txs.push(serialize(createConfigTx));

    createPoolWithFirstBuyTx.feePayer = creator;
    createPoolWithFirstBuyTx.recentBlockhash = blockhash;
    createPoolWithFirstBuyTx.partialSign(baseMint);
    txs.push(serialize(createPoolWithFirstBuyTx));
  } else {
    const tx = await client.creator.createPoolWithFirstBuy({
      createPoolParam: {
        name: body.name,
        symbol: body.symbol,
        uri: body.uri,
        payer: creator,
        poolCreator: creator,
        config: configPubkey,
        baseMint: baseMint.publicKey,
      },
      firstBuyParam,
    });
    tx.feePayer = creator;
    tx.recentBlockhash = blockhash;
    tx.partialSign(baseMint);
    txs.push(serialize(tx));
  }

  const pool = deriveDbcPoolAddress(quoteMint, baseMint.publicKey, configPubkey);

  return NextResponse.json({
    mode: plan.mode,
    txs,
    coin: {
      pool: pool.toBase58(),
      baseMint: baseMint.publicKey.toBase58(),
      quoteMint: body.quoteMint,
      config: configPubkey.toBase58(),
      creator: body.creator,
      ticker: body.symbol,
      name: body.name,
      uri: body.uri,
    },
  });
}
