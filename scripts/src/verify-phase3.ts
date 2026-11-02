/**
 * verify-phase3.ts — offline checks for the indexer wiring.
 *
 * The real DoD (webhook end-to-end on devnet; backfill reproduces resnapshot
 * holder balances; survives restart + duplicate deliveries) needs Postgres and
 * an RPC. This verifies the parts that need neither: the DBC + DAMM v2 IDLs
 * load into Anchor's event coder, and the pure swap mapping is correct.
 */
import { parseEventsFromLogs, resolveAmounts } from '@float/indexer';

let failed = false;
function check(name: string, ok: boolean): void {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${name}`);
  if (!ok) failed = true;
}

// Constructing the parsers (at import) validates both IDLs against Anchor.
const empty = parseEventsFromLogs([]);
check('event parsers construct and parse empty logs', Array.isArray(empty) && empty.length === 0);

const coin = {
  baseMint: 'So11111111111111111111111111111111111111112',
  quoteMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
};
const buy = resolveAmounts(
  {
    kind: 'swap',
    venue: 'DBC',
    eventIndex: 0,
    pool: 'p',
    tradeDirection: 1,
    includedInputAmount: 100n,
    outputAmount: 50n,
    tradingFee: 0n,
    protocolFee: 0n,
    referralFee: 0n,
    hasReferral: false,
  },
  coin,
);
check('DBC QuoteToBase maps to a buy', buy.side === 'Buy' && buy.baseAmount === 50n);

if (failed) {
  console.error('\nverify-phase3: FAILED');
  process.exit(1);
}
console.log('\nverify-phase3: all offline checks passed.');
