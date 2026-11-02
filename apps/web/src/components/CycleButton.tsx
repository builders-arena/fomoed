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
      setStatus(res.ok ? 'Cycle queued.' : `Failed (${res.status})`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button className="btn-ghost" disabled={busy} onClick={() => void trigger()}>
        Cycle fees
      </button>
      {status && <span className="text-sm text-muted">{status}</span>}
    </div>
  );
}
