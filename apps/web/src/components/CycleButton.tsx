'use client';

import { useState } from 'react';

/** Permissionlessly request a fee cycle for a coin (rate-limited server-side). */
export function CycleButton({ pool }: { pool: string }): JSX.Element {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function trigger(): Promise<void> {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/cycle/${pool}`, { method: 'POST' });
      setStatus(res.ok ? 'Cycle queued' : `Failed (${res.status})`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => void trigger()}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
        style={{ backgroundImage: 'linear-gradient(135deg, #F5BD00 0%, #F54B00 100%)' }}
      >
        <span>🔥</span> Cycle fees
      </button>
      {status && <span className="text-xs text-muted">{status}</span>}
    </div>
  );
}
