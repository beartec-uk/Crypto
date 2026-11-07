// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
/**
 * Honest Falcon candle time labels.
 *
 * Matches Falcon-faucet-wallet #187 honestSealTimes:
 *   chain_physics — sealed_at_ms / tip_sealed_at_ms, never wall-clock UTC
 *   observer      — observed_at / first_seen_at arrival, not trade time
 *   unavailable   — no admitted time (missing, zero, malformed, pre-activation)
 *   utc_committed — signed UTC candidate only. Not a verified candle.
 *
 * `canonical_sealed` and `estimated_observation` are retired. A parseable
 * sealed_at is not verified UTC. Chart mode is estimated_observer: published
 * bars use observer arrival and never claim verified UTC.
 */
import { normalizeFalconSymbol } from './falconMarkets.js';

export const VERIFIED_UTC_CANDLES_ENABLED = false;
export const CHART_MODE = 'estimated_observer' as const;
export type FalconChartMode = typeof CHART_MODE | 'not_selected';

/** Exact tokens accepted by GET/POST candle routes. Do not lowercase first: Elliott sends 1M for 1 Month. */
export const FALCON_CANDLE_TIMEFRAMES = ['1m', '5m', '15m', '1h'] as const;
export type FalconCandleTimeframe = (typeof FALCON_CANDLE_TIMEFRAMES)[number];

export function parseFalconTimeframe(
  raw: unknown,
  fallback: FalconCandleTimeframe | null = '5m',
): FalconCandleTimeframe | null {
  if (raw === undefined || raw === null || raw === '') {
    return fallback;
  }
  const token = String(raw).trim();
  if (!token) return fallback;
  return (FALCON_CANDLE_TIMEFRAMES as readonly string[]).includes(token)
    ? (token as FalconCandleTimeframe)
    : null;
}

export const HONEST_CANDLE_NOTE =
  'These candles use observer arrival time (when the explorer or collector first saw the fill), not trade time. ' +
  'Verified UTC candles are not enabled. ' +
  'sealed_at_ms / tip_sealed_at_ms are chain physics and are never presented as wall-clock UTC. ' +
  'A parseable sealed_at is not verified UTC. utc_committed is a candidate label only until ' +
  'protocol activation and a hash-bound identity→committed-UTC source exist. ' +
  'Network 2300 UTC activation is disabled. Quote is FPL, not USD or USDT. ' +
  'Untimed fills stay in coverage.untimedFills. ' +
  'USDC-FPL is the default market and an empty USDC book is not replaced with BTC4.';

export const FALCON_TIME_QUALITIES = ['chain_physics', 'observer', 'unavailable', 'utc_committed'] as const;
export type FalconTimeQuality = (typeof FALCON_TIME_QUALITIES)[number];

export const FALCON_TIME_SOURCES = ['chain_physics', 'observer', 'none', 'signed_utc_v5'] as const;
export type FalconTimeSource = (typeof FALCON_TIME_SOURCES)[number];

const RETIRED_QUALITY: Record<string, FalconTimeQuality> = {
  canonical_sealed: 'unavailable',
  estimated_observation: 'observer',
};

export interface FalconCandleRow {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  fillCount: number;
}

export interface FalconCoverageMeta {
  pair: string;
  timeframe?: string;
  timedFills: number;
  untimedFills: number;
  firstTimedHeight: number | null;
  lastTimedHeight: number | null;
  firstTime: number | null;
  lastTime: number | null;
  gaps: Array<{ fromTime: number; toTime: number; reason: string }>;
  ringLimitNote: string;
  timeSource: FalconTimeSource;
  timeQuality: FalconTimeQuality;
  verifiedUtc: false;
  chartMode: FalconChartMode;
  quote: 'FPL';
  emptyReasonHint?: string | null;
  evidenceCounts?: Partial<Record<FalconTimeQuality, number>>;
  /** Retired. Always 0. Not a count of verified tips. */
  canonicalTipsStored?: number;
  observationOnlyTipsStored?: number;
  physicsTipsStored?: number;
  utcCommittedCandidates?: number;
}

export interface FalconCandlePayload {
  source: 'falcon-pl-testnet';
  networkId: 2300;
  testnet: true;
  pair: string;
  timeframe: string;
  candles: Array<Pick<FalconCandleRow, 'time' | 'open' | 'high' | 'low' | 'close' | 'volume'>>;
  count: number;
  emptyReason: string | null;
  coverage: FalconCoverageMeta | null;
  timeQuality: FalconTimeQuality;
  timeSource: FalconTimeSource;
  verifiedUtc: false;
  chartMode: FalconChartMode;
  withheldCandleRows: number;
  quote: 'FPL';
  priceUnit: 'FPL per 1 whole base';
  defaultMarket: 'USDC-FPL';
  note: string;
}

export interface IngestDecision {
  ok: boolean;
  status: number;
  error?: string;
  candles: FalconCandleRow[];
  coverage: FalconCoverageMeta | null;
}

export function normalizeTimeQuality(raw: unknown): FalconTimeQuality {
  if (typeof raw !== 'string') return 'unavailable';
  const token = raw.trim();
  if (token in RETIRED_QUALITY) return RETIRED_QUALITY[token];
  if (token === 'verified_utc') return 'unavailable';
  if ((FALCON_TIME_QUALITIES as readonly string[]).includes(token)) return token as FalconTimeQuality;
  return 'unavailable';
}

export function normalizeTimeSource(raw: unknown): FalconTimeSource {
  if (typeof raw !== 'string') return 'none';
  const token = raw.trim();
  if (!token || token === 'explorer.sealed_at' || token === 'verified_utc') return 'none';
  if ((FALCON_TIME_SOURCES as readonly string[]).includes(token)) return token as FalconTimeSource;
  return 'none';
}

export function mapEmptyReason(hint: unknown, fallback: string): string {
  if (typeof hint !== 'string' || !hint.trim()) return fallback;
  if (hint.trim() === 'no_canonical_block_time') return 'verified_utc_unavailable';
  return hint.trim();
}

function wholeCount(value: unknown): number | null {
  if (typeof value === 'boolean' || value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

function copyEvidence(raw: unknown): Partial<Record<FalconTimeQuality, number>> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: Partial<Record<FalconTimeQuality, number>> = {};
  for (const key of FALCON_TIME_QUALITIES) {
    const n = wholeCount((raw as Record<string, unknown>)[key]);
    if (n != null) out[key] = n;
  }
  return out;
}

function copyGaps(raw: unknown): FalconCoverageMeta['gaps'] {
  if (!Array.isArray(raw)) return [];
  const gaps: FalconCoverageMeta['gaps'] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const fromTime = Number(row.fromTime);
    const toTime = Number(row.toTime);
    const reason = typeof row.reason === 'string' ? row.reason : '';
    if (!Number.isFinite(fromTime) || !Number.isFinite(toTime) || !reason) continue;
    gaps.push({ fromTime, toTime, reason });
  }
  return gaps;
}

function observerEstimateCoverage(raw: Record<string, unknown>): boolean {
  return (
    CHART_MODE === 'estimated_observer' &&
    normalizeTimeQuality(raw.timeQuality) === 'observer' &&
    normalizeTimeSource(raw.timeSource) === 'observer'
  );
}

/**
 * Accept coverage labels. Publish observer-estimate candles when chart mode
 * is estimated_observer. Reject physics/UTC rows that would draw a fake
 * verified axis. verifiedUtc stays false.
 */
export function decideCandleIngest(
  pair: string,
  candles: FalconCandleRow[],
  coverage: unknown,
): IngestDecision {
  const rawPreview = coverage && typeof coverage === 'object' ? (coverage as Record<string, unknown>) : null;
  if (candles.length > 0 && !VERIFIED_UTC_CANDLES_ENABLED) {
    if (!rawPreview || !observerEstimateCoverage(rawPreview)) {
      return {
        ok: false,
        status: 400,
        error: 'candles_rejected_not_verified_utc',
        candles: [],
        coverage: null,
      };
    }
  }
  if (coverage == null) {
    return { ok: true, status: 200, candles: [], coverage: null };
  }
  if (typeof coverage !== 'object') {
    return { ok: false, status: 400, error: 'invalid_coverage', candles: [], coverage: null };
  }
  const raw = coverage as Record<string, unknown>;
  if (typeof raw.pair === 'string' && raw.pair.trim()) {
    const coveragePair = normalizeFalconSymbol(raw.pair);
    if (coveragePair !== pair) {
      return { ok: false, status: 400, error: 'coverage_pair_mismatch', candles: [], coverage: null };
    }
  }
  if (raw.quote != null && String(raw.quote).trim() !== '' && String(raw.quote).toUpperCase() !== 'FPL') {
    return { ok: false, status: 400, error: 'quote_must_be_fpl', candles: [], coverage: null };
  }
  if (raw.untimedFills != null && wholeCount(raw.untimedFills) == null) {
    return { ok: false, status: 400, error: 'invalid_untimed_fills', candles: [], coverage: null };
  }
  if (raw.timedFills != null && wholeCount(raw.timedFills) == null) {
    return { ok: false, status: 400, error: 'invalid_timed_fills', candles: [], coverage: null };
  }
  const timedFills = raw.timedFills == null ? 0 : (wholeCount(raw.timedFills) as number);
  const untimedFills = raw.untimedFills == null ? 0 : (wholeCount(raw.untimedFills) as number);
  const observerOk = observerEstimateCoverage(raw);
  if (!VERIFIED_UTC_CANDLES_ENABLED && timedFills > 0 && !observerOk) {
    return { ok: false, status: 400, error: 'timed_fills_not_verified_utc', candles: [], coverage: null };
  }
  const stored: FalconCoverageMeta = {
    pair,
    timedFills,
    untimedFills,
    firstTimedHeight: null,
    lastTimedHeight: null,
    firstTime: null,
    lastTime: null,
    gaps: copyGaps(raw.gaps),
    ringLimitNote: typeof raw.ringLimitNote === 'string' ? raw.ringLimitNote : '',
    timeSource: normalizeTimeSource(raw.timeSource),
    timeQuality: normalizeTimeQuality(raw.timeQuality),
    verifiedUtc: false,
    chartMode: CHART_MODE,
    quote: 'FPL',
    emptyReasonHint: mapEmptyReason(raw.emptyReasonHint, observerOk ? 'no_observer_arrival_times' : 'verified_utc_unavailable'),
    evidenceCounts: copyEvidence(raw.evidenceCounts),
    canonicalTipsStored: 0,
    observationOnlyTipsStored: wholeCount(raw.observationOnlyTipsStored) ?? undefined,
    physicsTipsStored: wholeCount(raw.physicsTipsStored) ?? undefined,
    utcCommittedCandidates: wholeCount(raw.utcCommittedCandidates) ?? undefined,
  };
  const accepted = observerOk || VERIFIED_UTC_CANDLES_ENABLED ? candles : [];
  return { ok: true, status: 200, candles: accepted, coverage: stored };
}

export function presentFalconCandles(input: {
  pair: string;
  timeframe: string;
  candles: FalconCandleRow[];
  coverage: FalconCoverageMeta | null;
  emptyReason?: string | null;
}): FalconCandlePayload {
  const quality = normalizeTimeQuality(input.coverage?.timeQuality);
  const source = normalizeTimeSource(input.coverage?.timeSource);
  const publish =
    (VERIFIED_UTC_CANDLES_ENABLED &&
      (input.coverage as { verifiedUtc?: boolean } | null)?.verifiedUtc === true) ||
    (CHART_MODE === 'estimated_observer' && quality === 'observer' && source === 'observer');
  const candles = publish
    ? input.candles.map((row) => ({
        time: row.time,
        open: row.open,
        high: row.high,
        low: row.low,
        close: row.close,
        volume: row.volume,
      }))
    : [];
  const coverage = input.coverage
    ? {
        ...input.coverage,
        pair: input.pair,
        timeQuality: quality,
        timeSource: source,
        verifiedUtc: false as const,
        chartMode: CHART_MODE,
        quote: 'FPL' as const,
        canonicalTipsStored: 0,
        emptyReasonHint: mapEmptyReason(
          input.coverage.emptyReasonHint,
          publish ? 'no_observer_arrival_times' : 'verified_utc_unavailable',
        ),
      }
    : null;
  let emptyReason: string | null = null;
  if (!candles.length) {
    emptyReason = coverage
      ? coverage.emptyReasonHint || 'verified_utc_unavailable'
      : input.emptyReason || 'no_ingest_yet';
  }
  return {
    source: 'falcon-pl-testnet',
    networkId: 2300,
    testnet: true,
    pair: input.pair,
    timeframe: input.timeframe,
    candles,
    count: candles.length,
    emptyReason,
    coverage,
    timeQuality: coverage ? quality : 'unavailable',
    timeSource: coverage ? source : 'none',
    verifiedUtc: false,
    chartMode: CHART_MODE,
    withheldCandleRows: publish ? 0 : input.candles.length,
    quote: 'FPL',
    priceUnit: 'FPL per 1 whole base',
    defaultMarket: 'USDC-FPL',
    note: HONEST_CANDLE_NOTE,
  };
}
