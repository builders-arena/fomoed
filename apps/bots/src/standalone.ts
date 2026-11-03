import 'dotenv/config';
import { botConfig, INTERVALS } from './config.js';
import { initObservability } from './observability.js';
import { log } from './shared.js';
import { buildAdmin } from './admin.js';
import { runCycle } from './workers/cycle.js';
import { runPayout } from './workers/payout.js';
import { runBuyback } from './workers/buyback.js';
import { runAirdropSend, runAirdropSnapshot } from './workers/airdrop.js';
import { runMigrator } from './workers/migrator.js';

/**
 * Standalone bot runner — schedules the five workers on timers directly, with
 * no Redis/BullMQ. One process; run it on a small always-on host (or locally).
 * Each worker runs to completion before its next tick (no overlap).
 */

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function schedule(name: string, fn: () => Promise<void>, interval: number): void {
  void (async () => {
    // stagger starts a little so they don't all fire at once
    await sleep(Math.floor(Math.random() * 3000));
    for (;;) {
      const started = Date.now();
      try {
        await fn();
      } catch (err) {
        log.error({ err, worker: name }, 'worker tick failed');
      }
      await sleep(Math.max(1000, interval - (Date.now() - started)));
    }
  })();
}

async function main(): Promise<void> {
  const cfg = botConfig();
  initObservability();
  log.info({ cluster: process.env.CLUSTER, dryRun: process.env.DRY_RUN }, 'bots: standalone runner starting');

  schedule('cycle', () => runCycle(), INTERVALS.cycle);
  schedule('payout', () => runPayout(), INTERVALS.payout);
  schedule('buyback', () => runBuyback(), INTERVALS.buyback);
  schedule('airdrop', () => runAirdropSend(), INTERVALS.airdrop);
  schedule('migrator', () => runMigrator(), INTERVALS.migrator);
  schedule('airdrop-snapshot', async () => void (await runAirdropSnapshot(24)), 24 * 60 * 60_000);

  const admin = buildAdmin();
  await admin.listen({ port: cfg.ADMIN_API_PORT, host: '0.0.0.0' });
  log.info({ port: cfg.ADMIN_API_PORT }, 'bots: admin API listening');
}

main().catch((err) => {
  log.error({ err }, 'bots: fatal');
  process.exit(1);
});
