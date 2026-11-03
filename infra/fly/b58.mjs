// Print the base58-encoded secret key for a solana-keygen JSON keypair file.
// Usage: node infra/fly/b58.mjs <abs-path-to-keypair.json>
import bs58 from 'bs58';
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('usage: node b58.mjs <keypair.json>');
  process.exit(1);
}
const secret = Uint8Array.from(JSON.parse(readFileSync(path, 'utf8')));
process.stdout.write(bs58.encode(secret));
