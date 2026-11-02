import { MigrationFeeOption } from '@meteora-ag/dynamic-bonding-curve-sdk';
import { PublicKey } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';
import { WSOL_MINT } from '../constants.js';
import { deriveMigratedPoolAddress, sortMints } from './positions.js';

const BASE = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

describe('sortMints', () => {
  it('orders by public-key bytes and is stable regardless of input order', () => {
    const [a1, b1] = sortMints(BASE, WSOL_MINT);
    const [a2, b2] = sortMints(WSOL_MINT, BASE);
    expect(a1.equals(a2)).toBe(true);
    expect(b1.equals(b2)).toBe(true);
    expect(Buffer.compare(a1.toBuffer(), b1.toBuffer())).toBeLessThanOrEqual(0);
  });
});

describe('deriveMigratedPoolAddress', () => {
  it('is deterministic and independent of base/quote argument order', () => {
    const p1 = deriveMigratedPoolAddress(BASE, WSOL_MINT, MigrationFeeOption.Customizable);
    const p2 = deriveMigratedPoolAddress(WSOL_MINT, BASE, MigrationFeeOption.Customizable);
    expect(p1.equals(p2)).toBe(true);
  });

  it('defaults to the Customizable migration fee option', () => {
    const withDefault = deriveMigratedPoolAddress(BASE, WSOL_MINT);
    const explicit = deriveMigratedPoolAddress(BASE, WSOL_MINT, MigrationFeeOption.Customizable);
    expect(withDefault.equals(explicit)).toBe(true);
  });
});
