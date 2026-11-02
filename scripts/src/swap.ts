/**
 * swap.ts — buy or sell against a DBC pool.
 *
 *   pnpm swap --pool <pubkey> --side buy  --amount 0.1  [--slippage-bps 100]
 *   pnpm swap --pool <pubkey> --side sell --amount 1000 [--slippage-bps 100]
 *
 * buy  = quote -> base (swapBaseForQuote = false), --amount in quote tokens.
 * sell = base  -> quote (swapBaseForQuote = true),  --amount in base tokens.
 * Devnet by default; DRY_RUN simulates.
 */
import { BASE_TOKEN_DECIMALS, getConnection, loadWallets } from '@float/core';
import { getCurrentPoint, SwapMode } from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';
import {
  confirmMainnet,
  getClient,
  parseArgs,
  PublicKey,
  requireArg,
  sendOrSimulate,
} from './_shared.js';

async function main(): Promise<void> {
  const args = parseArgs();
  const pool = new PublicKey(requireArg(args, 'pool'));
  const side = requireArg(args, 'side');
  if (side !== 'buy' && side !== 'sell') throw new Error('--side must be "buy" or "sell"');
  const amountRaw = requireArg(args, 'amount');
  const slippageBps = typeof args['slippage-bps'] === 'string' ? Number(args['slippage-bps']) : 100;

  const connection = getConnection();
  const client = getClient();
  const wallets = loadWallets();

  const virtualPool = await client.state.getPool(pool);
  if (!virtualPool) throw new Error(`Pool ${pool.toBase58()} not found`);
  const configKey = virtualPool.poolState.config;
  const config = await client.state.getPoolConfig(configKey);
  if (!config) throw new Error(`Config ${configKey.toBase58()} not found`);

  const swapBaseForQuote = side === 'sell';

  // Decimals of the input token.
  const inputDecimals = swapBaseForQuote
    ? BASE_TOKEN_DECIMALS
    : (await connection.getTokenSupply(config.quoteMint)).value.decimals;
  const amountIn = toBaseUnits(amountRaw, inputDecimals);

  const currentPoint = await getCurrentPoint(connection, config.activationType);

  const quote = client.pool.swapQuote2({
    virtualPool,
    config,
    swapBaseForQuote,
    hasReferral: false,
    eligibleForFirstSwapWithMinFee: false,
    currentPoint,
    slippageBps,
    swapMode: SwapMode.ExactIn,
    amountIn,
  });
  const minimumAmountOut = quote.minimumAmountOut ?? new BN(0);

  console.log(`${side.toUpperCase()} ${amountRaw} on ${pool.toBase58()}`);
  console.log(`  amount in (base units):  ${amountIn.toString()}`);
  console.log(`  expected out:            ${quote.outputAmount.toString()}`);
  console.log(`  minimum out (slippage):  ${minimumAmountOut.toString()} (${slippageBps} bps)`);

  await confirmMainnet(`${side} ${amountRaw} on pool ${pool.toBase58()}`);

  const tx = await client.pool.swap2({
    owner: wallets.admin.publicKey,
    pool,
    swapBaseForQuote,
    referralTokenAccount: null,
    swapMode: SwapMode.ExactIn,
    amountIn,
    minimumAmountOut,
  });

  await sendOrSimulate(connection, tx, [wallets.admin], {
    feePayer: wallets.admin.publicKey,
    label: `swap-${side}`,
  });

  console.log('\nDone.');
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
