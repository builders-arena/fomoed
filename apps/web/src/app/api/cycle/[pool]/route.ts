import { NextResponse } from 'next/server';
import { ADMIN_API_URL } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Proxy a permissionless cycle request to the bots admin API (token stays server-side). */
export async function POST(
  _req: Request,
  { params }: { params: { pool: string } },
): Promise<NextResponse> {
  const token = process.env.ADMIN_API_TOKEN;
  try {
    const res = await fetch(`${ADMIN_API_URL}/cycle/${params.pool}`, {
      method: 'POST',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return NextResponse.json({ error: `admin ${res.status}` }, { status: 502 });
    return NextResponse.json(await res.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unreachable' },
      { status: 502 },
    );
  }
}
