/**
 * resnapshot-holders.ts — rebuild a coin's holder balances from on-chain token
 * accounts, correcting any drift from the swap-delta tracker.
 *
 *   pnpm --filter @float/scripts exec tsx src/resnapshot-holders.ts --pool <pubkey>
 *
 * Token-2022 aware. Excludes the pool/DAMM vaults so program-owned liquidity is
 * not counted as a holder.
 */
import { getConnection } from '@float/core';
import { prisma } from '@float/db';
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import type { ParsedAccountData } from '@solana/web3.js';
import { getClient, parseArgs, PublicKey, requireArg } from './_shared.js';

async function main(): Promise<void> {
  const args = parseArgs();
  const pool = new PublicKey(requireArg(args, 'pool'));

  const coin = await prisma.coin.findUnique({ where: { pool: pool.toBase58() } });
  if (!coin) throw new Error(`Coin ${pool.toBase58()} not registered`);
  const baseMint = new PublicKey(coin.baseMint);

  const connection = getConnection();

  // Token program for the base mint.
  const mintInfo = await connection.getAccountInfo(baseMint);
  if (!mintInfo) throw new Error('Base mint not found on chain');
  const tokenProgram = mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;

  // Addresses to exclude: pool base vault + (if migrated) DAMM pool vaults.
  const excluded = new Set<string>();
  const vp = await getClient().state.getPool(pool);
  if (vp) excluded.add(vp.poolState.baseVault.toBase58());

  const slot = BigInt(await connection.getSlot());

  // All token accounts for this mint (mint is at offset 0 for both programs).
  const accounts = await connection.getParsedProgramAccounts(tokenProgram, {
    filters: [{ memcmp: { offset: 0, bytes: baseMint.toBase58() } }],
  });

  const balances = new Map<string, bigint>();
  for (const { pubkey, account } of accounts) {
    if (excluded.has(pubkey.toBase58())) continue;
    const data = account.data as ParsedAccountData;
    const info = (data.parsed as { info?: { owner?: string; tokenAmount?: { amount?: string } } })
      .info;
    const owner = info?.owner;
    const amount = info?.tokenAmount?.amount;
    if (!owner || amount === undefined) continue;
    const amt = BigInt(amount);
    if (amt === 0n) continue;
    balances.set(owner, (balances.get(owner) ?? 0n) + amt);
  }

  // Replace the coin's holder rows atomically.
  await prisma.$transaction([
    prisma.holder.deleteMany({ where: { coin: coin.pool } }),
    prisma.holder.createMany({
      data: [...balances.entries()].map(([wallet, balance]) => ({
        coin: coin.pool,
        wallet,
        balance,
        updatedSlot: slot,
      })),
    }),
  ]);

  console.log(`Resnapshotted ${balances.size} holders for ${coin.pool} at slot ${slot}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    await prisma.$disconnect();
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
