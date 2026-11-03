import { prisma } from '@float/db';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BYTES = 2_000_000; // 2 MB

/** Store an uploaded coin logo + metadata; returns the token metadata URI. */
export async function POST(req: Request): Promise<NextResponse> {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'no file' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'file must be an image' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'image too large (max 2 MB)' }, { status: 413 });
  }

  const data = Buffer.from(await file.arrayBuffer());
  const asset = await prisma.asset.create({
    data: {
      contentType: file.type,
      data,
      name: form.get('name')?.toString() ?? null,
      symbol: form.get('symbol')?.toString() ?? null,
      description: form.get('description')?.toString() ?? null,
    },
  });

  const origin = new URL(req.url).origin;
  return NextResponse.json({
    uri: `${origin}/api/meta/${asset.id}`,
    image: `${origin}/api/image/${asset.id}`,
  });
}
