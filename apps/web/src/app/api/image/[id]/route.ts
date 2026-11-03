import { prisma } from '@float/db';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  const asset = await prisma.asset.findUnique({ where: { id: params.id } });
  if (!asset) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return new Response(new Uint8Array(asset.data), {
    headers: {
      'content-type': asset.contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
