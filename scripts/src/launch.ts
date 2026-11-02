/**
 * launch.ts — launch a coin on a given quote mint.
 *
 *   pnpm launch --name "My Coin" --symbol MYC --uri https://.../meta.json \
 *     --quote <quoteMint> [--creator <pubkey>] --first-buy 0.1 \
 *     [--quote-decimals N] [--quote-usd-price N]
 *
 * First launch on a quote mint lazily creates the DBC config
 * (createConfigAndPoolWithFirstBuy); subsequent launches reuse it
 * (createPoolWithFirstBuy). Devnet by default; DRY_RUN simulates.
 */
import {
  buildPartnerConfig,
  getConnection,
  loadWallets,
  planLaunch,
  recordNewConfig,
} from '@float/core';
import { deriveDbcPoolAddress } from '@meteora-ag/dynamic-bonding-curve-sdk';
import BN from 'bn.js';
import {
  confirmMainnet,
  getClient,
  getConfigStore,
  Keypair,
  parseArgs,
  PublicKey,
  requireArg,
  resolveQuoteMeta,
  sendOrSimulate,
} from './_shared.js';

async function main(): Promise<void> {
  const args = parseArgs();
  const name = requireArg(args, 'name');
  const symbol = requireArg(args, 'symbol');
  const uri = requireArg(args, 'uri');
  const quoteMint = new PublicKey(requireArg(args, 'quote'));
  const firstBuyRaw = requireArg(args, 'first-buy');

  const wallets = loadWallets();
  const creator =
    typeof args['creator'] === 'string' ? new PublicKey(args['creator']) : wallets.admin.publicKey;

  const { decimals, usdPrice } = resolveQuoteMeta(quoteMint, args);
  const buyAmount = toBaseUnits(firstBuyRaw, decimals);

  const connection = getConnection();
  const client = getClient();
  const store = getConfigStore();

  const baseMint = Keypair.generate();
  const plan = await planLaunch(store, quoteMint);

  const firstBuyParam = {
    buyer: wallets.admin.publicKey,
    buyAmount,
    // Devnet: no slippage floor. Mainnet first buys must set this from a quote.
    minimumAmountOut: new BN(0),
    referralTokenAccount: null,
  };

  const configPubkey = plan.mode === 'create' ? plan.config.publicKey : plan.config;
  const poolAddress = deriveDbcPoolAddress(quoteMint, baseMint.publicKey, configPubkey);

  console.log(`Launch: ${name} (${symbol})`);
  console.log(`  quote mint:   ${quoteMint.toBase58()}`);
  console.log(`  base mint:    ${baseMint.publicKey.toBase58()}`);
  console.log(`  config:       ${configPubkey.toBase58()} (${plan.mode})`);
  console.log(`  pool:         ${poolAddress.toBase58()}`);
  console.log(`  first buy:    ${firstBuyRaw} (${buyAmount.toString()} base units)`);

  if (plan.mode === 'create') {
    await confirmMainnet(`create config + pool + first buy on ${quoteMint.toBase58()}`);

    const configParams = buildPartnerConfig({
      quoteMint: quoteMint.toBase58(),
      quoteDecimals: decimals,
      quoteUsdPrice: usdPrice,
    });

    const { createConfigTx, createPoolWithFirstBuyTx } =
      await client.partner.createConfigAndPoolWithFirstBuy({
        ...configParams,
        config: plan.config.publicKey,
        feeClaimer: wallets.feeClaimer,
        leftoverReceiver: wallets.leftoverReceiver,
        quoteMint,
        payer: wallets.admin.publicKey,
        preCreatePoolParam: {
          name,
          symbol,
          uri,
          poolCreator: creator,
          baseMint: baseMint.publicKey,
        },
        firstBuyParam,
      });

    const configResult = await sendOrSimulate(
      connection,
      createConfigTx,
      [wallets.admin, plan.config],
      { feePayer: wallets.admin.publicKey, label: 'createConfig' },
    );

    if (configResult.simulated) {
      console.log(
        '[DRY_RUN] skipping pool+first-buy simulation (it depends on the config existing on chain).',
      );
    } else {
      await sendOrSimulate(connection, createPoolWithFirstBuyTx, [wallets.admin, baseMint], {
        feePayer: wallets.admin.publicKey,
        label: 'createPoolWithFirstBuy',
      });
      await recordNewConfig(store, quoteMint, plan.config.publicKey, configResult.signature);
      console.log(`  recorded config ${plan.config.publicKey.toBase58()} for reuse`);
    }
  } else {
    await confirmMainnet(`create pool + first buy on existing config ${configPubkey.toBase58()}`);

    const tx = await client.creator.createPoolWithFirstBuy({
      createPoolParam: {
        name,
        symbol,
        uri,
        payer: wallets.admin.publicKey,
        poolCreator: creator,
        config: configPubkey,
        baseMint: baseMint.publicKey,
      },
      firstBuyParam,
    });

    await sendOrSimulate(connection, tx, [wallets.admin, baseMint], {
      feePayer: wallets.admin.publicKey,
      label: 'createPoolWithFirstBuy',
    });
  }

  console.log('\nDone.');
}

/** Parse a human quote amount (e.g. "0.1") into base units as a BN. */
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
