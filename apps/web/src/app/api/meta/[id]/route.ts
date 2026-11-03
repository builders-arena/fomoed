import { prisma } from '@float/db';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Token metadata JSON (the on-chain `uri` points here). */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const asset = await prisma.asset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    name: asset.name ?? '',
    symbol: asset.symbol ?? '',
    description: asset.description ?? '',
    image: `${origin}/api/image/${asset.id}`,
  });
}
