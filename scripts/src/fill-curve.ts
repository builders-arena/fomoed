/**
 * fill-curve.ts — buy a DBC pool up to its migration threshold so it graduates.
 *
 *   pnpm --filter @float/scripts exec tsx src/fill-curve.ts \
 *     --pool <pubkey> [--max-swap <quote amount>] [--slippage-bps 100]
 *
 * Loops quote->base buys in capped chunks until the curve completes. Stops on
 * a PoolIsCompleted error or when progress reaches ~100%. Devnet; DRY_RUN
 * simulates each swap.
 */
import { getConnection, loadWallets } from '@float/core';
import { getCurrentPoint, SwapMode } from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';
import {
  getClient,
  parseArgs,
  PublicKey,
  requireArg,
  sendOrSimulate,
} from './_shared.js';

const MAX_ITERATIONS = 200;

async function main(): Promise<void> {
  const args = parseArgs();
  const pool = new PublicKey(requireArg(args, 'pool'));
  const slippageBps = typeof args['slippage-bps'] === 'string' ? Number(args['slippage-bps']) : 100;

  const connection = getConnection();
  const client = getClient();
  const wallets = loadWallets();

  const config = await (async () => {
    const vp = await client.state.getPool(pool);
    if (!vp) throw new Error(`Pool ${pool.toBase58()} not found`);
    const c = await client.state.getPoolConfig(vp.poolState.config);
    if (!c) throw new Error('Config not found');
    return c;
  })();

  const quoteDecimals = (await connection.getTokenSupply(config.quoteMint)).value.decimals;
  const maxSwap =
    typeof args['max-swap'] === 'string' ? toBaseUnits(args['max-swap'], quoteDecimals) : null;

  const threshold = await client.state.getPoolMigrationQuoteThreshold(pool);

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const vp = await client.state.getPool(pool);
    if (!vp) throw new Error('Pool disappeared');
    if (vp.poolState.isMigrated || vp.poolState.migrationProgress >= 1) {
      console.log('Curve already complete / migrated.');
      break;
    }

    const progress = await client.state.getPoolQuoteTokenCurveProgress(pool);
    const remaining = threshold.sub(vp.poolState.quoteReserve);
    console.log(
      `iter ${i}: progress ${(progress * 100).toFixed(2)}%, quoteReserve ${vp.poolState.quoteReserve.toString()}, remaining ~${remaining.toString()}`,
    );
    if (progress >= 0.9999 || remaining.lten(0)) {
      console.log('Reached migration threshold.');
      break;
    }

    // Buy a chunk (capped). Overshoot is fine — the curve stops at completion.
    let amountIn = maxSwap && maxSwap.lt(remaining) ? maxSwap : remaining;
    if (amountIn.lten(0)) amountIn = remaining;

    const currentPoint = await getCurrentPoint(connection, config.activationType);
    let minimumAmountOut = new BN(0);
    try {
      const quote = client.pool.swapQuote2({
        virtualPool: vp,
        config,
        swapBaseForQuote: false,
        hasReferral: false,
        eligibleForFirstSwapWithMinFee: false,
        currentPoint,
        slippageBps,
        swapMode: SwapMode.ExactIn,
        amountIn,
      });
      minimumAmountOut = quote.minimumAmountOut ?? new BN(0);
    } catch (err) {
      if (isCompletedError(err)) {
        console.log('Curve completed (quote).');
        break;
      }
      throw err;
    }

    const tx = await client.pool.swap2({
      owner: wallets.admin.publicKey,
      pool,
      swapBaseForQuote: false,
      referralTokenAccount: null,
      swapMode: SwapMode.ExactIn,
      amountIn,
      minimumAmountOut,
    });

    try {
      const res = await sendOrSimulate(connection, tx, [wallets.admin], {
        feePayer: wallets.admin.publicKey,
        label: `fill-buy#${i}`,
      });
      if (res.simulated) {
        console.log('[DRY_RUN] one buy simulated; not looping further in dry-run.');
        break;
      }
    } catch (err) {
      if (isCompletedError(err)) {
        console.log('Curve completed (swap).');
        break;
      }
      throw err;
    }
  }

  console.log('\nDone.');
}

function isCompletedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /PoolIsCompleted|completed|0x1775|NotEnoughLiquidity|notEnoughLiquidity/i.test(msg);
}

function toBaseUnits(value: string, decimals: number): BN {
  const [whole, frac = ''] = value.split('.');
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const digits = `${whole}${fracPadded}`.replace(/^0+(?=\d)/, '');
  return new BN(digits.length ? digits : '0');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
