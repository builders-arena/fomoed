/**
 * mainnet-preflight.ts — assert the configuration is safe before pointing the
 * system at mainnet-beta. Exits non-zero on any hard failure.
 *
 *   CLUSTER=mainnet-beta pnpm --filter @float/scripts exec tsx src/mainnet-preflight.ts
 */
import { getConnection, isMainnet, loadEnv, loadKeypair, loadWallets } from '@float/core';
import { PublicKey } from '@solana/web3.js';

const WALLET_CAP_SOL = Number(process.env.MAINNET_WALLET_CAP_SOL ?? 50);

let failed = false;
function must(name: string, ok: boolean, detail = ''): void {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed = true;
}
function warn(name: string, detail = ''): void {
  console.log(`  WARN  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main(): Promise<void> {
  const env = loadEnv();
  console.log('mainnet-preflight:');

  must('CLUSTER is mainnet-beta', isMainnet(env), env.CLUSTER);

  // fee_claimer must be an external multisig address (no local signer).
  const wallets = loadWallets(env);
  must('FEE_CLAIMER_ADDRESS is set (external multisig)', Boolean(env.FEE_CLAIMER_ADDRESS));
  must('fee_claimer has no local keypair (not admin)', wallets.feeClaimerSigner === null);
  must('LEFTOVER_RECEIVER_ADDRESS is set', Boolean(env.LEFTOVER_RECEIVER_ADDRESS));
  must('TREASURY_ADDRESS is set', Boolean(env.TREASURY_ADDRESS));
  must(
    'treasury != admin',
    !wallets.treasury.equals(wallets.admin.publicKey),
    wallets.treasury.toBase58(),
  );

  must('HELIUS_WEBHOOK_SECRET is set', Boolean(env.HELIUS_WEBHOOK_SECRET));
  must('ADMIN_API_TOKEN is set', Boolean(process.env.ADMIN_API_TOKEN));
  must('FLAGSHIP_MINT is set (buyback target)', Boolean(process.env.FLAGSHIP_MINT));
  if (process.env.FLAGSHIP_MINT) {
    try {
      new PublicKey(process.env.FLAGSHIP_MINT);
    } catch {
      must('FLAGSHIP_MINT is a valid pubkey', false);
    }
  }

  if (env.DRY_RUN) {
    warn('DRY_RUN is true — bots will simulate only (flip explicitly to go live)');
  } else {
    warn('DRY_RUN is false — bots WILL send real transactions');
  }

  // Bot hot-wallet balances must be capped.
  const connection = getConnection();
  for (const [name, path] of [
    ['payout', env.PAYOUT_KEYPAIR],
    ['buyback', env.BUYBACK_KEYPAIR],
    ['airdrop', env.AIRDROP_KEYPAIR],
  ] as const) {
    if (!path) {
      must(`${name} keypair configured`, false);
      continue;
    }
    try {
      const kp = loadKeypair(path);
      const sol = (await connection.getBalance(kp.publicKey)) / 1e9;
      must(`${name} balance capped (<= ${WALLET_CAP_SOL} SOL)`, sol <= WALLET_CAP_SOL, `${sol} SOL`);
    } catch (err) {
      must(`${name} keypair loads`, false, err instanceof Error ? err.message : String(err));
    }
  }

  if (failed) {
    console.error('\nmainnet-preflight: FAILED — do not go live.');
    process.exit(1);
  }
  console.log('\nmainnet-preflight: all hard checks passed.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
