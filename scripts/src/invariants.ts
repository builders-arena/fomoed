/**
 * invariants.ts — reconcile the money flow against the ledger. Run hourly
 * (cron / scheduled task). Exits non-zero if any invariant is violated.
 *
 *   pnpm --filter @float/scripts exec tsx src/invariants.ts
 *
 * Checks:
 *   1. every fee_claim's recorded split sums to its claimed total
 *   2. holder payouts per coin never exceed what was credited to holders
 *   3. every buyback with SOL in produced flagship out (sanity)
 *   4. no wallet was paid twice within a payout or airdrop round
 */
import { payoutWithinCredit, splitReconciles } from '@float/core';
import { prisma } from '@float/db';

interface Violation {
  check: string;
  detail: string;
}

async function main(): Promise<void> {
  const violations: Violation[] = [];

  // 1. split reconciliation
  const claims = await prisma.feeClaim.findMany();
  for (const c of claims) {
    const ok = splitReconciles({
      total: c.totalClaimed,
      holders: c.holdersAmount,
      creator: c.creatorAmount,
      flagship: c.flagshipAmount,
      traders: c.tradersAmount,
      treasury: c.treasuryAmount,
    });
    if (!ok) violations.push({ check: 'split', detail: `fee_claim ${c.claimTx} split != total` });
  }

  // 2. payouts <= credited (per coin)
  const [credited, paid] = await Promise.all([
    prisma.feeClaim.groupBy({ by: ['pool'], _sum: { holdersAmount: true } }),
    prisma.payout.groupBy({ by: ['coin'], where: { status: 'sent' }, _sum: { amount: true } }),
  ]);
  const creditByPool = new Map(credited.map((c) => [c.pool, c._sum.holdersAmount ?? 0n]));
  for (const p of paid) {
    const credit = creditByPool.get(p.coin) ?? 0n;
    const out = p._sum.amount ?? 0n;
    if (!payoutWithinCredit(credit, out)) {
      violations.push({
        check: 'payout>credit',
        detail: `coin ${p.coin}: paid ${out} > credited ${credit}`,
      });
    }
  }

  // 3. buyback sanity
  const badBuybacks = await prisma.buyback.findMany({
    where: { solIn: { gt: 0n }, flagshipOut: { lte: 0n } },
  });
  for (const b of badBuybacks) {
    violations.push({ check: 'buyback', detail: `buyback ${b.id}: solIn>0 but flagshipOut<=0` });
  }

  // 4. double-pay within a round
  const dupPayouts = await prisma.payout.groupBy({
    by: ['roundId', 'wallet'],
    _count: { _all: true },
    having: { wallet: { _count: { gt: 1 } } },
  });
  for (const d of dupPayouts) {
    violations.push({ check: 'double-payout', detail: `round ${d.roundId} wallet ${d.wallet} x${d._count._all}` });
  }
  const dupAirdrops = await prisma.airdrop.groupBy({
    by: ['roundId', 'wallet'],
    _count: { _all: true },
    having: { wallet: { _count: { gt: 1 } } },
  });
  for (const d of dupAirdrops) {
    violations.push({ check: 'double-airdrop', detail: `round ${d.roundId} wallet ${d.wallet} x${d._count._all}` });
  }

  if (violations.length === 0) {
    console.log(`invariants: OK (${claims.length} claims checked)`);
    return;
  }
  console.error(`invariants: ${violations.length} VIOLATION(S)`);
  for (const v of violations) console.error(`  [${v.check}] ${v.detail}`);
  process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    await prisma.$disconnect();
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
