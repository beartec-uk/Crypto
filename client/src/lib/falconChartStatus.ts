// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
// Pure helpers for Falcon (testnet 2300, quote FPL) chart metadata + customer copy.
// Times on Falcon bars are observer arrival times, never verified UTC.

export interface FalconCoverageSummary {
  timedFills: number;
  untimedFills: number;
  gaps: Array<{ fromTime: number; toTime: number; reason: string }>;
}

export interface FalconCandleMeta {
  source: string | null;
  networkId: number | null;
  pair: string | null;
  quote: string | null;
  count: number;
  note: string | null;
  emptyReason: string | null;
  timeQuality: string | null;
  timeSource: string | null;
  chartMode: string | null;
  verifiedUtc: false;
  coverage: FalconCoverageSummary | null;
  withheldCandleRows: number;
}

function num(v: unknown, d = 0): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : d;
}
function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Parse the /api/crypto/falcon/candles payload. verifiedUtc is forced false. */
export function parseFalconCandleMeta(data: any, requestedPair: string): FalconCandleMeta {
  const cov = data && typeof data.coverage === 'object' && data.coverage ? data.coverage : null;
  const candles = Array.isArray(data?.candles) ? data.candles : [];
  return {
    source: str(data?.source),
    networkId: data?.networkId == null ? null : num(data.networkId),
    pair: str(data?.pair) ?? requestedPair,
    quote: str(data?.quote),
    count: data?.count == null ? candles.length : num(data.count),
    note: str(data?.note),
    emptyReason: str(data?.emptyReason),
    timeQuality: str(data?.timeQuality),
    timeSource: str(data?.timeSource),
    chartMode: str(data?.chartMode),
    verifiedUtc: false,
    coverage: cov
      ? {
          timedFills: num(cov.timedFills),
          untimedFills: num(cov.untimedFills),
          gaps: Array.isArray(cov.gaps) ? cov.gaps : [],
        }
      : null,
    withheldCandleRows: num(data?.withheldCandleRows),
  };
}

export type FalconChartStatusKind =
  | 'loading'
  | 'error'
  | 'bars'
  | 'no_trades'
  | 'no_arrival_times'
  | 'no_ingest'
  | 'unavailable';

export interface FalconChartStatus {
  kind: FalconChartStatusKind;
  tone: 'info' | 'warn' | 'error';
  title: string;
  detail: string;
}

export const FALCON_ARRIVAL_NOTE =
  'Falcon testnet 2300 · prices in FPL. Bar times are when our collector or the explorer first saw each fill (arrival time), not the trade time, and not verified UTC.';

function marketLabel(pair: string): string {
  return pair.replace('-', '/');
}

export function falconChartStatus(input: {
  pair: string;
  candleCount: number;
  isLoading: boolean;
  error: Error | null;
  meta: FalconCandleMeta | null;
}): FalconChartStatus {
  const { pair, candleCount, isLoading, error, meta } = input;
  const m = marketLabel(pair);
  if (candleCount > 0) {
    return { kind: 'bars', tone: 'info', title: `${m} · arrival-time bars`, detail: FALCON_ARRIVAL_NOTE };
  }
  if (error) {
    return {
      kind: 'error',
      tone: 'error',
      title: `Couldn't load ${m} bars`,
      detail: 'The Falcon chart service did not respond. Try again shortly.',
    };
  }
  if (isLoading && !meta) {
    return { kind: 'loading', tone: 'info', title: `Loading ${m}…`, detail: 'Fetching Falcon testnet 2300 bars (FPL).' };
  }
  const reason = meta?.emptyReason ?? 'no_ingest_yet';
  const cov = meta?.coverage;
  if (reason === 'no_ingest_yet' || !cov) {
    return {
      kind: 'no_ingest',
      tone: 'warn',
      title: `No ${m} data received yet`,
      detail: 'Our Falcon collector has not sent bars for this market yet. Nothing is shown rather than borrowed data.',
    };
  }
  if (cov.timedFills + cov.untimedFills === 0) {
    return {
      kind: 'no_trades',
      tone: 'info',
      title: `No ${m} trades yet`,
      detail: 'This Falcon testnet 2300 market has no fills yet, so there are no bars to draw.',
    };
  }
  if (reason === 'no_observer_arrival_times' || cov.timedFills === 0) {
    return {
      kind: 'no_arrival_times',
      tone: 'warn',
      title: `${m} trades found, no arrival times yet`,
      detail: `${cov.untimedFills} fill(s) exist but none have a recorded arrival time, so bars can't be placed on a timeline.`,
    };
  }
  return {
    kind: 'unavailable',
    tone: 'warn',
    title: `${m} bars unavailable`,
    detail: 'Bars are withheld because their times could not be confirmed. Verified UTC is not available on Falcon.',
  };
}
