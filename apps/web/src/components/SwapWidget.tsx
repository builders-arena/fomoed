'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  DynamicBondingCurveClient,
  getCurrentPoint,
  SwapMode,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import { PublicKey } from '@solana/web3.js';
import BN from 'bn.js';
import { useState } from 'react';

const BASE_DECIMALS = 6;

function toBaseUnits(value: string, decimals: number): BN {
  const [whole, frac = ''] = value.split('.');
  const padded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const digits = `${whole}${padded}`.replace(/^0+(?=\d)/, '');
  return new BN(digits.length ? digits : '0');
}

export function SwapWidget({
  pool,
  quoteSymbol,
  quoteDecimals,
}: {
  pool: string;
  quoteSymbol: string;
  quoteDecimals: number;
}): JSX.Element {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const unit = side === 'buy' ? quoteSymbol : 'tokens';

  async function swap(): Promise<void> {
    if (!wallet.publicKey || !wallet.sendTransaction) return;
    if (!amount || Number(amount) <= 0) {
      setStatus('Enter an amount.');
      return;
    }
    setBusy(true);
    setStatus('Building transaction…');
    try {
      const client = DynamicBondingCurveClient.create(connection, 'confirmed');
      const poolKey = new PublicKey(pool);
      const vp = await client.state.getPool(poolKey);
      if (!vp) throw new Error('Pool not found');
      const config = await client.state.getPoolConfig(vp.poolState.config);
      if (!config) throw new Error('Config not found');

      const swapBaseForQuote = side === 'sell';
      const inputDecimals = swapBaseForQuote ? BASE_DECIMALS : quoteDecimals;
      const amountIn = toBaseUnits(amount, inputDecimals);
      const currentPoint = await getCurrentPoint(connection, config.activationType);

      const quote = client.pool.swapQuote2({
        virtualPool: vp,
        config,
        swapBaseForQuote,
        hasReferral: false,
        eligibleForFirstSwapWithMinFee: false,
        currentPoint,
        slippageBps: 100,
        swapMode: SwapMode.ExactIn,
        amountIn,
      });

      const tx = await client.pool.swap2({
        owner: wallet.publicKey,
        pool: poolKey,
        swapBaseForQuote,
        referralTokenAccount: null,
        swapMode: SwapMode.ExactIn,
        amountIn,
        minimumAmountOut: quote.minimumAmountOut ?? new BN(0),
      });

      setStatus('Confirm in your wallet…');
      const sig = await wallet.sendTransaction(tx, connection);
      setStatus(`Sent ✓ ${sig.slice(0, 8)}…`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border border-border bg-black/20 p-1">
        {(['buy', 'sell'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`rounded-lg py-2 text-sm font-semibold capitalize transition-colors ${
              side === s
                ? s === 'buy'
                  ? 'bg-primary/15 text-primary'
                  : 'bg-down/15 text-down'
                : 'text-muted hover:text-ink'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="label">Amount ({unit})</label>
      <div className="relative">
        <input
          className="input pr-16 text-lg"
          placeholder="0.0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
        />
        <span className="num absolute right-4 top-1/2 -translate-y-1/2 text-sm text-faint">{unit}</span>
      </div>

      {wallet.publicKey ? (
        <button
          onClick={() => void swap()}
          disabled={busy}
          className={`mt-4 w-full rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50 ${
            side === 'buy' ? 'btn' : ''
          }`}
          style={
            side === 'sell'
              ? { backgroundImage: 'linear-gradient(135deg,#FF6B6B,#e85555)', color: '#fff' }
              : undefined
          }
        >
          {busy ? 'Working…' : side === 'buy' ? `Buy ${quoteSymbol}→token` : 'Sell token'}
        </button>
      ) : (
        <div className="wallet-wrap mt-4 [&_.wallet-adapter-button]:!w-full [&_.wallet-adapter-button]:!justify-center [&_.wallet-adapter-button]:!h-11">
          <WalletMultiButton>Connect to trade</WalletMultiButton>
        </div>
      )}

      {status && <p className="mt-3 break-words text-xs text-muted">{status}</p>}
    </div>
  );
}
