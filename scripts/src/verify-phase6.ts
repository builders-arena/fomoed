/**
 * verify-phase6.ts — offline checks for the invariant helpers that back the
 * hourly reconciler. The live reconciler + mainnet-preflight need Postgres / RPC.
 */
import { payoutWithinCredit, splitReconciles, withinSlippage } from '@float/core';

let failed = false;
function check(name: string, ok: boolean): void {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}`);
  if (!ok) failed = true;
}

check(
  'split reconciles when parts sum to total',
  splitReconciles({ total: 100n, holders: 60n, creator: 0n, flagship: 20n, traders: 15n, treasury: 5n }),
);
check(
  'split fails when parts mismatch',
  !splitReconciles({ total: 100n, holders: 60n, creator: 0n, flagship: 20n, traders: 15n, treasury: 4n }),
);
check('slippage within tolerance accepted', withinSlippage(1000n, 995n, 100));
check('slippage beyond tolerance rejected', !withinSlippage(1000n, 980n, 100));
check('payout within credit accepted', payoutWithinCredit(100n, 100n));
check('overpayment rejected', !payoutWithinCredit(100n, 101n));

if (failed) {
  console.error('\nverify-phase6: FAILED');
  process.exit(1);
}
console.log('\nverify-phase6: all offline checks passed.');
