import 'dotenv/config';
import { initObservability } from './observability.js';
import { log } from './shared.js';
import { runCycle } from './workers/cycle.js';
import { runPayout } from './workers/payout.js';
import { runBuyback } from './workers/buyback.js';
import { runAirdropSend } from './workers/airdrop.js';
import { runMigrator } from './workers/migrator.js';

/**
 * One-shot tick — runs each worker once and exits. Invoked on a schedule by
 * GitHub Actions (the Redis-free, host-free way to run the bots). Idempotency
 * (tx_log / idemKey) makes overlapping or repeated ticks safe.
 */

async function step(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    log.info({ worker: name }, 'tick: ok');
  } catch (err) {
    log.error({ err, worker: name }, 'tick: worker failed');
  }
}

async function main(): Promise<void> {
  initObservability();
  log.info({ cluster: process.env.CLUSTER, dryRun: process.env.DRY_RUN }, 'tick: start');
  await step('migrator', runMigrator); // migrate completed curves first
  await step('cycle', runCycle); // claim fees + credit ledger
  await step('payout', runPayout); // pay holders
  await step('buyback', runBuyback); // convert + buy/burn flagship
  await step('airdrop', runAirdropSend); // convert + pay approved airdrop rounds
  log.info('tick: complete');
  process.exit(0);
}

main().catch((err) => {
  log.error({ err }, 'tick: fatal');
  process.exit(1);
});
