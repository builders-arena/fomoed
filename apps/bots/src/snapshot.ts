import 'dotenv/config';
import { log } from './shared.js';
import { runAirdropSnapshot } from './workers/airdrop.js';

/** One-shot airdrop snapshot — builds a pending_review round from the day's volume. */
async function main(): Promise<void> {
  const round = await runAirdropSnapshot(24);
  log.info({ round }, 'snapshot: done');
  process.exit(0);
}

main().catch((err) => {
  log.error({ err }, 'snapshot: fatal');
  process.exit(1);
});
