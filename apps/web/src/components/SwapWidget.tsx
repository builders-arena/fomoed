'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { DynamicBondingCurveClient, SwapMode } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { getCurrentPoint } from '@meteora-ag/dynamic-bonding-curve-sdk';
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
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function swap(side: 'buy' | 'sell'): Promise<void> {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      setStatus('Connect a wallet first.');
      return;
    }
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
      setStatus(`Sent: ${sig.slice(0, 8)}…`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card flex flex-col gap-3">
      <h3 className="font-semibold">Swap</h3>
      <input
        className="input"
        placeholder={`Amount (${quoteSymbol} to buy / tokens to sell)`}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        inputMode="decimal"
      />
      <div className="flex gap-2">
        <button className="btn flex-1" disabled={busy} onClick={() => void swap('buy')}>
          Buy
        </button>
        <button className="btn-ghost flex-1" disabled={busy} onClick={() => void swap('sell')}>
          Sell
        </button>
      </div>
      {status && <p className="text-sm text-muted">{status}</p>}
    </div>
  );
}
