import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { botConfig, INTERVALS } from './config.js';
import { captureError } from './observability.js';
import { log } from './shared.js';
import { runCycle } from './workers/cycle.js';
import { runPayout } from './workers/payout.js';
import { runBuyback } from './workers/buyback.js';
import { runAirdropSend, runAirdropSnapshot } from './workers/airdrop.js';
import { runMigrator } from './workers/migrator.js';

export const QUEUE_NAME = 'float';

export type JobName =
  | 'cycle'
  | 'payout'
  | 'buyback'
  | 'airdrop'
  | 'airdrop-snapshot'
  | 'migrator';

let connection: IORedis | null = null;
function redis(): IORedis {
  if (!connection) connection = new IORedis(botConfig().REDIS_URL, { maxRetriesPerRequest: null });
  return connection;
}

let queue: Queue | null = null;
export function getQueue(): Queue {
  if (!queue) queue = new Queue(QUEUE_NAME, { connection: redis() });
  return queue;
}

async function process(job: Job): Promise<void> {
  const name = job.name as JobName;
  log.info({ job: name, data: job.data }, 'bot: job start');
  switch (name) {
    case 'cycle':
      return runCycle(job.data ?? {});
    case 'payout':
      return runPayout(job.data ?? {});
    case 'buyback':
      return runBuyback();
    case 'airdrop':
      return runAirdropSend();
    case 'airdrop-snapshot':
      await runAirdropSnapshot(job.data?.windowHours ?? 24);
      return;
    case 'migrator':
      return runMigrator();
    default:
      log.warn({ job: name }, 'bot: unknown job');
  }
}

export function startWorker(): Worker {
  const worker = new Worker(QUEUE_NAME, process, { connection: redis(), concurrency: 1 });
  worker.on('failed', (job, err) => {
    log.error({ job: job?.name, err }, 'bot: job failed');
    captureError(err, { job: job?.name });
  });
  return worker;
}

/** Register the repeatable (cron-like) schedules. Idempotent by jobId. */
export async function addRepeatables(): Promise<void> {
  const q = getQueue();
  const add = (name: JobName, every: number) =>
    q.add(name, {}, { repeat: { every }, jobId: `repeat:${name}`, removeOnComplete: 100, removeOnFail: 100 });
  await add('cycle', INTERVALS.cycle);
  await add('payout', INTERVALS.payout);
  await add('buyback', INTERVALS.buyback);
  await add('airdrop', INTERVALS.airdrop);
  await add('migrator', INTERVALS.migrator);
  await q.add(
    'airdrop-snapshot',
    { windowHours: 24 },
    { repeat: { every: 24 * 60 * 60_000 }, jobId: 'repeat:airdrop-snapshot', removeOnComplete: 10 },
  );
}
