/**
 * register-coin.ts — insert a coin row so the indexer accepts its events.
 * Run right after a launch confirms (launch.ts / the web app call registerCoin).
 *
 *   pnpm --filter @float/scripts exec tsx src/register-coin.ts \
 *     --pool <p> --base-mint <b> --quote-mint <q> --config <c> --creator <cr> \
 *     --ticker MYC --name "My Coin" --uri https://.../meta.json [--creator-wallet <w>]
 */
import { registerCoin, prisma } from '@float/db';
import { parseArgs, requireArg } from './_shared.js';

async function main(): Promise<void> {
  const args = parseArgs();
  await registerCoin({
    pool: requireArg(args, 'pool'),
    baseMint: requireArg(args, 'base-mint'),
    quoteMint: requireArg(args, 'quote-mint'),
    config: requireArg(args, 'config'),
    creator: requireArg(args, 'creator'),
    ticker: requireArg(args, 'ticker'),
    name: requireArg(args, 'name'),
    uri: requireArg(args, 'uri'),
    creatorWallet: typeof args['creator-wallet'] === 'string' ? args['creator-wallet'] : undefined,
    dammPool: typeof args['damm-pool'] === 'string' ? args['damm-pool'] : undefined,
  });
  console.log(`Registered coin ${requireArg(args, 'pool')}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    await prisma.$disconnect();
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
