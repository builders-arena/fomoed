import { botConfig } from './config.js';
import { addRepeatables, startWorker } from './queues.js';
import { buildAdmin } from './admin.js';
import { initObservability } from './observability.js';
import { log } from './shared.js';

/**
 * Boot: one BullMQ worker process (all five jobs, concurrency 1) plus the admin
 * HTTP API. Repeatable schedules are registered idempotently on start.
 */
async function main(): Promise<void> {
  const cfg = botConfig();

  initObservability();
  startWorker();
  await addRepeatables();
  log.info('bots: worker started, repeatables registered');

  const admin = buildAdmin();
  await admin.listen({ port: cfg.ADMIN_API_PORT, host: process.env.HOST ?? '0.0.0.0' });
  log.info({ port: cfg.ADMIN_API_PORT }, 'bots: admin API listening');
}

main().catch((err) => {
  log.error({ err }, 'bots: fatal');
  process.exit(1);
});
