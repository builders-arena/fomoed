/**
 * verify-phase4.ts — offline checks for the bot fee split.
 *
 * The real DoD (24h unattended loop on devnet with reconciling ledgers) needs
 * Postgres + Redis + devnet. This verifies the split math the whole money flow
 * depends on: parts sum exactly to the claim and exclude the on-chain creator.
 */
import { FEE_SPLIT_BPS, splitPartnerClaim, SPLIT_DENOMINATOR_BPS } from '@float/core';

let failed = false;
function check(name: string, ok: boolean): void {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}`);
  if (!ok) failed = true;
}

check('denominator excludes creator (9500)', Number(SPLIT_DENOMINATOR_BPS) === 10_000 - FEE_SPLIT_BPS.CREATOR);

for (const amt of [0n, 1n, 123_456_789n, 9_999_999_999n]) {
  const s = splitPartnerClaim(amt);
  const sum = s.holders + s.flagship + s.traders + s.treasury;
  check(`split of ${amt} sums exactly (no dust)`, sum === amt);
  check(`split of ${amt} is all non-negative`, s.holders >= 0n && s.flagship >= 0n && s.traders >= 0n && s.treasury >= 0n);
}

if (failed) {
  console.error('\nverify-phase4: FAILED');
  process.exit(1);
}
console.log('\nverify-phase4: all offline checks passed.');
