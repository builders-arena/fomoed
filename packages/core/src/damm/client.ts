import { CpAmm } from '@meteora-ag/cp-amm-sdk';
import { getConnection } from '../connection.js';

/** cp-amm (DAMM v2) client bound to the configured RPC. */
export function getCpAmm(): CpAmm {
  return new CpAmm(getConnection());
}
