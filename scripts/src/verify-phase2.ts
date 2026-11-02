/**
 * verify-phase2.ts — offline checks for Phase 2 wiring.
 *
 * The real DoD (launch -> fill-curve -> migrate -> trade on DAMM v2 -> claim)
 * is an on-chain devnet cycle. This verifies the parts that need no RPC:
 * the migration fee config resolves, and pool-address derivation is stable.
 */
import { deriveMigratedPoolAddress, WSOL_MINT } from '@float/core';
import {
  DAMM_V2_MIGRATION_FEE_ADDRESS,
  MigrationFeeOption,
} from '@meteora-ag/dynamic-bonding-curve-sdk';
import { PublicKey } from '@solana/web3.js';

let failed = false;
function check(name: string, ok: boolean): void {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}`);
  if (!ok) failed = true;
}

const base = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

const dammConfig = DAMM_V2_MIGRATION_FEE_ADDRESS[MigrationFeeOption.Customizable];
check('Customizable migration fee config resolves', !!dammConfig);

const p1 = deriveMigratedPoolAddress(base, WSOL_MINT, MigrationFeeOption.Customizable);
const p2 = deriveMigratedPoolAddress(WSOL_MINT, base, MigrationFeeOption.Customizable);
check('migrated pool address is order-independent', p1.equals(p2));
check('migrated pool address is a valid pubkey', p1.toBase58().length >= 32);

console.log(`  derived DAMM v2 pool: ${p1.toBase58()}`);

if (failed) {
  console.error('\nverify-phase2: FAILED');
  process.exit(1);
}
console.log('\nverify-phase2: all offline checks passed.');
