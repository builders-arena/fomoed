import { BorshCoder, EventParser, type Idl } from '@coral-xyz/anchor';
import { DAMM_V2_PROGRAM_ID, DBC_PROGRAM_ID } from '@float/core';
import { CpAmmIdl } from '@meteora-ag/cp-amm-sdk';
import { DynamicBondingCurveIdl } from '@meteora-ag/dynamic-bonding-curve-sdk';

/**
 * Pure event parser: given a transaction's program logs, decode the DBC and
 * DAMM v2 Anchor events we care about into a normalized shape.
 *
 * Kept free of IO so it can be reused by both the webhook handler and the
 * backfill script, and unit-tested against a synthetic log line.
 */

export type SwapVenue = 'DBC' | 'DAMM';

export interface SwapEvent {
  kind: 'swap';
  venue: SwapVenue;
  eventIndex: number;
  pool: string;
  /** Raw on-chain trade direction (interpreted per-venue by the handler). */
  tradeDirection: number;
  /** Input amount including fee (base units of the input token). */
  includedInputAmount: bigint;
  /** Output amount (base units of the output token). */
  outputAmount: bigint;
  /** LP/partner+creator fee (quote units under QuoteToken collect mode). */
  tradingFee: bigint;
  protocolFee: bigint;
  referralFee: bigint;
  hasReferral: boolean;
}

export interface CurveCompleteEvent {
  kind: 'curveComplete';
  eventIndex: number;
  pool: string;
}

export interface InitPoolEvent {
  kind: 'initPool';
  eventIndex: number;
  pool: string;
  config: string;
  creator: string;
  baseMint: string;
}

export type ParsedEvent = SwapEvent | CurveCompleteEvent | InitPoolEvent;

const dbcParser = new EventParser(DBC_PROGRAM_ID, new BorshCoder(DynamicBondingCurveIdl as Idl));
const dammParser = new EventParser(DAMM_V2_PROGRAM_ID, new BorshCoder(CpAmmIdl as Idl));

/** BN | number | bigint | string -> bigint. */
function toBigInt(v: unknown): bigint {
  if (v === null || v === undefined) return 0n;
  if (typeof v === 'bigint') return v;
  return BigInt((v as { toString(): string }).toString());
}

function pk(v: unknown): string {
  return (v as { toString(): string }).toString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSwap(venue: SwapVenue, data: any, eventIndex: number): SwapEvent {
  const r = data.swapResult ?? {};
  return {
    kind: 'swap',
    venue,
    eventIndex,
    pool: pk(data.pool),
    tradeDirection: Number(data.tradeDirection ?? 0),
    includedInputAmount: toBigInt(r.includedFeeInputAmount),
    outputAmount: toBigInt(r.outputAmount),
    tradingFee: toBigInt(r.tradingFee ?? r.claimingFee),
    protocolFee: toBigInt(r.protocolFee),
    referralFee: toBigInt(r.referralFee),
    hasReferral: Boolean(data.hasReferral),
  };
}

/** Parse the events we index from a transaction's log messages. */
export function parseEventsFromLogs(logs: string[]): ParsedEvent[] {
  const out: ParsedEvent[] = [];
  let idx = 0;

  const consume = (parser: EventParser, venue: SwapVenue): void => {
    for (const ev of parser.parseLogs(logs, false)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = ev.data as any;
      switch (ev.name) {
        case 'EvtSwap2':
        case 'EvtSwap2WithTransferHook':
          out.push(mapSwap(venue, data, idx++));
          break;
        case 'EvtCurveComplete':
        case 'EvtCurveCompleteWithTransferHook':
          out.push({ kind: 'curveComplete', eventIndex: idx++, pool: pk(data.pool) });
          break;
        case 'EvtInitializePool':
        case 'EvtInitializePoolWithTransferHook':
          if (venue === 'DBC') {
            out.push({
              kind: 'initPool',
              eventIndex: idx++,
              pool: pk(data.pool),
              config: pk(data.config),
              creator: pk(data.creator),
              baseMint: pk(data.baseMint),
            });
          }
          break;
        default:
          break;
      }
    }
  };

  // parseLogs mutates an internal cursor per call, so run each coder over a copy.
  consume(dbcParser, 'DBC');
  consume(dammParser, 'DAMM');
  return out;
}
