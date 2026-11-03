import { prisma } from '@float/db';

/**
 * Server-side data access for the web app. All bigint amounts are returned as
 * strings so results can cross the server/client boundary safely.
 */

const DAY_MS = 24 * 60 * 60_000;

export interface CoinListItem {
  pool: string;
  baseMint: string;
  quoteMint: string;
  ticker: string;
  name: string;
  migrationState: number;
  volume24h: string;
  rewardsPaid: string;
  launchedAt: string;
}

export async function listCoins(quoteMint?: string): Promise<CoinListItem[]> {
  const coins = await prisma.coin.findMany({
    where: quoteMint ? { quoteMint } : undefined,
    orderBy: { launchedAt: 'desc' },
  });
  const since = new Date(Date.now() - DAY_MS);

  const [vol, paid] = await Promise.all([
    prisma.swap.groupBy({ by: ['pool'], where: { ts: { gte: since } }, _sum: { quoteAmount: true } }),
    prisma.payout.groupBy({ by: ['coin'], where: { status: 'sent' }, _sum: { amount: true } }),
  ]);
  const volByPool = new Map(vol.map((v) => [v.pool, v._sum.quoteAmount ?? 0n]));
  const paidByCoin = new Map(paid.map((p) => [p.coin, p._sum.amount ?? 0n]));

  return coins.map((c) => ({
    pool: c.pool,
    baseMint: c.baseMint,
    quoteMint: c.quoteMint,
    ticker: c.ticker,
    name: c.name,
    migrationState: c.migrationState,
    volume24h: (volByPool.get(c.pool) ?? 0n).toString(),
    rewardsPaid: (paidByCoin.get(c.pool) ?? 0n).toString(),
    launchedAt: c.launchedAt.toISOString(),
  }));
}

export interface CoinDetail extends CoinListItem {
  config: string;
  creator: string;
  creatorWallet: string | null;
  uri: string;
  dammPool: string | null;
  pendingHolders: string;
  totalClaimed: string;
  swapCount: number;
}

export async function getCoin(pool: string): Promise<CoinDetail | null> {
  const c = await prisma.coin.findUnique({ where: { pool } });
  if (!c) return null;
  const since = new Date(Date.now() - DAY_MS);
  const [vol, paid, pending, claimed, swapCount] = await Promise.all([
    prisma.swap.aggregate({ where: { pool, ts: { gte: since } }, _sum: { quoteAmount: true } }),
    prisma.payout.aggregate({ where: { coin: pool, status: 'sent' }, _sum: { amount: true } }),
    prisma.holdersPool.findUnique({ where: { coin_mint: { coin: pool, mint: c.quoteMint } } }),
    prisma.feeClaim.aggregate({ where: { pool }, _sum: { totalClaimed: true } }),
    prisma.swap.count({ where: { pool } }),
  ]);
  return {
    pool: c.pool,
    baseMint: c.baseMint,
    quoteMint: c.quoteMint,
    ticker: c.ticker,
    name: c.name,
    migrationState: c.migrationState,
    config: c.config,
    creator: c.creator,
    creatorWallet: c.creatorWallet,
    uri: c.uri,
    dammPool: c.dammPool,
    launchedAt: c.launchedAt.toISOString(),
    volume24h: (vol._sum.quoteAmount ?? 0n).toString(),
    rewardsPaid: (paid._sum.amount ?? 0n).toString(),
    pendingHolders: (pending?.amount ?? 0n).toString(),
    totalClaimed: (claimed._sum.totalClaimed ?? 0n).toString(),
    swapCount,
  };
}

/** Recent price points (quote per token) derived from swaps, oldest→newest. */
export async function getCoinSeries(
  pool: string,
  quoteDecimals: number,
  limit = 120,
): Promise<Array<{ t: number; v: number }>> {
  const swaps = await prisma.swap.findMany({
    where: { pool, baseAmount: { gt: 0n }, quoteAmount: { gt: 0n } },
    orderBy: { ts: 'desc' },
    take: limit,
    select: { ts: true, baseAmount: true, quoteAmount: true },
  });
  const baseDec = 6;
  return swaps
    .reverse()
    .map((s) => {
      const q = Number(s.quoteAmount) / 10 ** quoteDecimals;
      const b = Number(s.baseAmount) / 10 ** baseDec;
      return { t: s.ts.getTime(), v: b > 0 ? q / b : 0 };
    })
    .filter((p) => p.v > 0);
}

export interface Analytics {
  totalFees: string;
  paidToHolders: string;
  burned: string;
  airdropVault: string;
  leaderboard: Array<{ wallet: string; volume: string }>;
  nextAirdrop: string | null;
}

export async function getAnalytics(): Promise<Analytics> {
  const [fees, paid, burned, vault, lastRound] = await Promise.all([
    prisma.feeClaim.aggregate({ _sum: { totalClaimed: true } }),
    prisma.payout.aggregate({ where: { status: 'sent' }, _sum: { amount: true } }),
    prisma.buyback.aggregate({ _sum: { flagshipOut: true } }),
    prisma.tradersPool.aggregate({ _sum: { amount: true } }),
    prisma.airdropRound.findFirst({ orderBy: { createdAt: 'desc' } }),
  ]);

  let leaderboard: Array<{ wallet: string; volume: string }> = [];
  let nextAirdrop: string | null = null;
  if (lastRound) {
    const shares = await prisma.airdrop.findMany({
      where: { roundId: lastRound.id },
      orderBy: { volume: 'desc' },
      take: 20,
    });
    leaderboard = shares.map((s) => ({ wallet: s.wallet, volume: s.volume.toString() }));
    nextAirdrop = new Date(lastRound.windowEnd.getTime() + DAY_MS).toISOString();
  }

  return {
    totalFees: (fees._sum.totalClaimed ?? 0n).toString(),
    paidToHolders: (paid._sum.amount ?? 0n).toString(),
    burned: (burned._sum.flagshipOut ?? 0n).toString(),
    airdropVault: (vault._sum.amount ?? 0n).toString(),
    leaderboard,
    nextAirdrop,
  };
}

export async function getProfile(wallet: string): Promise<{
  created: CoinListItem[];
  rewards: Array<{ coin: string; mint: string; amount: string; tx: string | null }>;
  airdrops: Array<{ mint: string; amount: string; tx: string | null }>;
}> {
  const [created, rewards, airdrops] = await Promise.all([
    listCoinsByCreator(wallet),
    prisma.payout.findMany({ where: { wallet, status: 'sent' }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.airdrop.findMany({ where: { wallet, status: 'sent' }, take: 100 }),
  ]);
  return {
    created,
    rewards: rewards.map((r) => ({ coin: r.coin, mint: r.mint, amount: r.amount.toString(), tx: r.tx })),
    airdrops: airdrops.map((a) => ({ mint: a.mint, amount: a.amount.toString(), tx: a.tx })),
  };
}

async function listCoinsByCreator(wallet: string): Promise<CoinListItem[]> {
  const coins = await prisma.coin.findMany({
    where: { OR: [{ creatorWallet: wallet }, { creator: wallet }] },
    orderBy: { launchedAt: 'desc' },
  });
  return coins.map((c) => ({
    pool: c.pool,
    baseMint: c.baseMint,
    quoteMint: c.quoteMint,
    ticker: c.ticker,
    name: c.name,
    migrationState: c.migrationState,
    volume24h: '0',
    rewardsPaid: '0',
    launchedAt: c.launchedAt.toISOString(),
  }));
}

export async function getBurns(): Promise<{
  burns: Array<{ id: string; ts: string; solIn: string; flagshipOut: string; burnTx: string | null }>;
  cumulative: string;
}> {
  const burns = await prisma.buyback.findMany({ orderBy: { ts: 'desc' }, take: 200 });
  const total = burns.reduce((s, b) => s + b.flagshipOut, 0n);
  return {
    burns: burns.map((b) => ({
      id: b.id,
      ts: b.ts.toISOString(),
      solIn: b.solIn.toString(),
      flagshipOut: b.flagshipOut.toString(),
      burnTx: b.burnTx,
    })),
    cumulative: total.toString(),
  };
}
