import { handleWebhookPayload } from '@float/indexer';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Serverless indexer: Helius posts enhanced/raw transactions here, we parse the
 * DBC + DAMM v2 events and upsert swaps/holders. Idempotent, so Helius retries
 * are safe. Auth via the HELIUS_WEBHOOK_SECRET Authorization header.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (secret && req.headers.get('authorization') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const result = await handleWebhookPayload(body);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'bad request' },
      { status: 400 },
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, service: 'float-indexer-webhook' });
}
