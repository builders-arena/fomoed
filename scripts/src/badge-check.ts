/**
 * badge-check.ts — classify a quote-mint and report whether it needs a Meteora
 * TokenBadge to be usable as a DBC quote mint.
 *
 *   pnpm --filter @float/scripts exec tsx src/badge-check.ts --mint <pubkey> [--markdown]
 *
 * Verdict is one of:
 *   - spl                       (plain SPL token; no badge required)
 *   - token-2022-permissionless (Token-2022 with only permissionless-supported
 *                                extensions; no badge required)
 *   - needs-badge               (Token-2022 with extensions that require a badge)
 * plus whether the `['token_badge', mint]` PDA already exists on DBC.
 */
import { deriveTokenBadgeAddress } from '@meteora-ag/dynamic-bonding-curve-sdk';
import {
  ExtensionType,
  getExtensionTypes,
  getMint,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { getConnection } from '@float/core';
import { parseArgs, PublicKey, requireArg } from './_shared.js';

/** Extensions Meteora supports permissionlessly (no badge). Conservative set — */
/* confirm against https://docs.meteora.ag/core-products/dbc/token-2022-support */
const PERMISSIONLESS_EXTENSIONS = new Set<ExtensionType>([
  ExtensionType.TransferFeeConfig,
  ExtensionType.TransferFeeAmount,
  ExtensionType.MetadataPointer,
  ExtensionType.TokenMetadata,
  ExtensionType.InterestBearingConfig,
  ExtensionType.GroupPointer,
  ExtensionType.GroupMemberPointer,
]);

type Verdict = 'spl' | 'token-2022-permissionless' | 'needs-badge' | 'unknown';

async function main(): Promise<void> {
  const args = parseArgs();
  const mint = new PublicKey(requireArg(args, 'mint'));
  const markdown = args['markdown'] === true;

  const connection = getConnection();
  const info = await connection.getAccountInfo(mint);
  if (!info) throw new Error(`Mint ${mint.toBase58()} not found`);

  let verdict: Verdict = 'unknown';
  let extensionNames: string[] = [];

  if (info.owner.equals(TOKEN_PROGRAM_ID)) {
    verdict = 'spl';
  } else if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    const mintState = await getMint(connection, mint, 'confirmed', TOKEN_2022_PROGRAM_ID);
    const extensions = getExtensionTypes(mintState.tlvData);
    extensionNames = extensions.map((e) => ExtensionType[e] ?? String(e));
    const risky = extensions.filter((e) => !PERMISSIONLESS_EXTENSIONS.has(e));
    verdict = risky.length === 0 ? 'token-2022-permissionless' : 'needs-badge';
  }

  const badgePda = deriveTokenBadgeAddress(mint);
  const badgeInfo = await connection.getAccountInfo(badgePda);
  const badgeExists = badgeInfo !== null;

  if (markdown) {
    // mint | token program | extensions | verdict | badge exists
    const program =
      verdict === 'spl' ? 'SPL' : verdict === 'unknown' ? info.owner.toBase58() : 'Token-2022';
    console.log(
      `| \`${mint.toBase58()}\` | ${program} | ${extensionNames.join(', ') || '—'} | ${verdict} | ${badgeExists ? 'yes' : 'no'} |`,
    );
  } else {
    console.log(`mint:        ${mint.toBase58()}`);
    console.log(`owner:       ${info.owner.toBase58()}`);
    if (extensionNames.length) console.log(`extensions:  ${extensionNames.join(', ')}`);
    console.log(`verdict:     ${verdict}`);
    console.log(`badge PDA:   ${badgePda.toBase58()} (${badgeExists ? 'exists' : 'missing'})`);
    const needs = verdict === 'needs-badge' && !badgeExists;
    console.log(`\n=> ${needs ? 'NEEDS a badge from Meteora before launch' : 'usable as a quote mint as-is'}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
