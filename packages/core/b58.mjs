// Print the base58-encoded secret key for a solana-keygen JSON keypair file.
// Lives in packages/core so Node resolves `bs58` from its node_modules.
// Usage: node packages/core/b58.mjs <abs-path-to-keypair.json>
import bs58 from 'bs58';
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('usage: node b58.mjs <keypair.json>');
  process.exit(1);
}
const secret = Uint8Array.from(JSON.parse(readFileSync(path, 'utf8')));
if (secret.length !== 64) {
  console.error(`expected 64-byte secret key, got ${secret.length}`);
  process.exit(1);
}
process.stdout.write(bs58.encode(secret));
