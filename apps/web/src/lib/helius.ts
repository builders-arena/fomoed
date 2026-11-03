import 'server-only';

/**
 * Dynamically subscribe a pool address to our Helius webhook, so the indexer
 * only receives transactions for our own pools (not the whole DBC program).
 * No-op when Helius env is not configured (local/devnet-without-webhook).
 */
const API = 'https://api.helius.xyz/v0/webhooks';

export async function subscribePool(pool: string): Promise<void> {
  const key = process.env.HELIUS_API_KEY;
  const id = process.env.HELIUS_WEBHOOK_ID;
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (!key || !id) return;

  try {
    const res = await fetch(`${API}/${id}?api-key=${key}`);
    if (!res.ok) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wh: any = await res.json();
    const addrs: string[] = Array.isArray(wh.accountAddresses) ? wh.accountAddresses : [];
    if (addrs.includes(pool)) return;
    addrs.push(pool);

    await fetch(`${API}/${id}?api-key=${key}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        webhookURL: wh.webhookURL,
        transactionTypes: wh.transactionTypes ?? ['ANY'],
        accountAddresses: addrs,
        webhookType: wh.webhookType ?? 'raw',
        // GET does not return authHeader, so re-apply it from env.
        ...(secret ? { authHeader: secret } : {}),
      }),
    });
  } catch {
    // best-effort; indexing can be backfilled if a subscription fails
  }
}
