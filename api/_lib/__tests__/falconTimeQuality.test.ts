import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  VERIFIED_UTC_CANDLES_ENABLED,
  decideCandleIngest,
  normalizeTimeQuality,
  normalizeTimeSource,
  parseFalconTimeframe,
  presentFalconCandles,
  type FalconCandleRow,
  type FalconCoverageMeta,
} from '../falconTimeQuality';

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../tools/falcon-fills-store/fixtures/time_honesty.json',
);
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
  cases: Array<{ name: string; expect: { timeQuality: string; timeSource: string; verifiedUtc: boolean } }>;
};

const bar = (time: number): FalconCandleRow => ({
  time,
  open: 1,
  high: 2,
  low: 0.5,
  close: 1.5,
  volume: 3,
  fillCount: 1,
});

function coverage(partial: Record<string, unknown>): FalconCoverageMeta {
  const decision = decideCandleIngest('USDC-FPL', [], {
    pair: 'USDC-FPL',
    timedFills: 0,
    untimedFills: 4,
    timeQuality: 'unavailable',
    timeSource: 'none',
    quote: 'FPL',
    ...partial,
  });
  if (!decision.ok || !decision.coverage) {
    throw new Error(decision.error || 'expected coverage');
  }
  return decision.coverage;
}

describe('falcon time honesty', () => {
  it('keeps verified UTC buckets disabled', () => {
    expect(VERIFIED_UTC_CANDLES_ENABLED).toBe(false);
  });

  it('retires canonical_sealed and estimated_observation', () => {
    expect(normalizeTimeQuality('canonical_sealed')).toBe('unavailable');
    expect(normalizeTimeQuality('estimated_observation')).toBe('observer');
    expect(normalizeTimeQuality('verified_utc')).toBe('unavailable');
    expect(normalizeTimeSource('explorer.sealed_at')).toBe('none');
    expect(normalizeTimeQuality('utc_committed')).toBe('utc_committed');
    expect(normalizeTimeSource('signed_utc_v5')).toBe('signed_utc_v5');
  });

  it('preserves fixture qualities through ingest and presentation', () => {
    const required = [
      'physics_only',
      'observed_only',
      'missing_utc',
      'zero_utc',
      'malformed_time',
      'pre_activation',
      'physics_as_iso',
      'utc_committed_network_2300',
    ];
    const names = new Set(fixture.cases.map((item) => item.name));
    for (const name of required) expect(names.has(name)).toBe(true);

    for (const item of fixture.cases) {
      const stored = coverage({
        timeQuality: item.expect.timeQuality,
        timeSource: item.expect.timeSource,
        untimedFills: 4,
        verifiedUtc: true,
        quote: 'FPL',
        emptyReasonHint: 'verified_utc_unavailable',
      });
      expect(stored.timeQuality, item.name).toBe(item.expect.timeQuality);
      expect(stored.timeSource, item.name).toBe(item.expect.timeSource);
      expect(stored.verifiedUtc, item.name).toBe(false);
      expect(stored.untimedFills, item.name).toBe(4);
      expect(stored.quote).toBe('FPL');
      expect(stored.chartMode).toBe('estimated_observer');

      const body = presentFalconCandles({
        pair: 'USDC-FPL',
        timeframe: '5m',
        candles: [bar(1_700_000_000)],
        coverage: stored,
      });
      expect(body.timeQuality, item.name).toBe(item.expect.timeQuality);
      expect(body.timeSource, item.name).toBe(item.expect.timeSource);
      expect(body.verifiedUtc).toBe(false);
      const publishObserver = item.expect.timeQuality === 'observer' && item.expect.timeSource === 'observer';
      if (publishObserver) {
        expect(body.candles, item.name).toEqual([
          { time: 1_700_000_000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 3 },
        ]);
        expect(body.count, item.name).toBe(1);
        expect(body.withheldCandleRows, item.name).toBe(0);
      } else {
        expect(body.candles, item.name).toEqual([]);
        expect(body.count, item.name).toBe(0);
        expect(body.withheldCandleRows, item.name).toBe(1);
      }
      expect(body.coverage?.untimedFills).toBe(4);
      expect(body.quote).toBe('FPL');
      expect(body.defaultMarket).toBe('USDC-FPL');
      expect(body.pair).toBe('USDC-FPL');
      expect(body.chartMode).toBe('estimated_observer');
      expect(body.timeQuality).not.toBe('canonical_sealed');
      expect(body.timeQuality).not.toBe('verified_utc');
      expect(body.note).not.toMatch(/canonical_sealed/);
      expect(body.note).toMatch(/not trade time/i);
      expect(body.note).toMatch(/not verified UTC/i);
      expect(body.note).toMatch(/USDC-FPL/);
    }
  });

  it('rejects candle rows that would draw a UTC or physics axis', () => {
    for (const timeQuality of ['chain_physics', 'unavailable', 'utc_committed', 'canonical_sealed', 'verified_utc']) {
      const decision = decideCandleIngest('USDC-FPL', [bar(1_700_000_000)], {
        pair: 'USDC-FPL',
        timeQuality,
        timeSource: 'chain_physics',
        untimedFills: 2,
        quote: 'FPL',
      });
      expect(decision.ok, timeQuality).toBe(false);
      expect(decision.error).toBe('candles_rejected_not_verified_utc');
      expect(decision.candles).toEqual([]);
      expect(decision.coverage).toBeNull();
    }
  });

  it('accepts observer-estimate candles without claiming verified UTC', () => {
    const decision = decideCandleIngest('USDC-FPL', [bar(1_700_000_000)], {
      pair: 'USDC-FPL',
      timeQuality: 'observer',
      timeSource: 'observer',
      timedFills: 1,
      untimedFills: 2,
      quote: 'FPL',
    });
    expect(decision.ok).toBe(true);
    expect(decision.candles).toHaveLength(1);
    expect(decision.coverage?.chartMode).toBe('estimated_observer');
    expect(decision.coverage?.verifiedUtc).toBe(false);
    expect(decision.coverage?.timeQuality).toBe('observer');
    const body = presentFalconCandles({
      pair: 'USDC-FPL',
      timeframe: '5m',
      candles: decision.candles,
      coverage: decision.coverage,
    });
    expect(body.candles).toHaveLength(1);
    expect(body.candles[0]?.time).toBe(1_700_000_000);
    expect(body.withheldCandleRows).toBe(0);
    expect(body.verifiedUtc).toBe(false);
    expect(body.chartMode).toBe('estimated_observer');
    expect(body.emptyReason).toBeNull();
  });

  it('does not substitute BTC4 when USDC coverage is empty', () => {
    const mismatch = decideCandleIngest('USDC-FPL', [], {
      pair: 'BTC4-FPL',
      timeQuality: 'chain_physics',
      timeSource: 'chain_physics',
      untimedFills: 9,
      quote: 'FPL',
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.error).toBe('coverage_pair_mismatch');

    const stored = coverage({ untimedFills: 0, timeQuality: 'unavailable', timeSource: 'none' });
    const body = presentFalconCandles({
      pair: 'USDC-FPL',
      timeframe: '5m',
      candles: [],
      coverage: stored,
    });
    expect(body.pair).toBe('USDC-FPL');
    expect(body.coverage?.pair).toBe('USDC-FPL');
    expect(body.coverage?.untimedFills).toBe(0);
    expect(body.candles).toEqual([]);
    expect(body.defaultMarket).toBe('USDC-FPL');
  });

  it('rejects a USD quote and keeps an omitted quote as FPL', () => {
    const usd = decideCandleIngest('BTC4-FPL', [], {
      pair: 'BTC4-FPL',
      quote: 'USDT',
      timeQuality: 'unavailable',
      timeSource: 'none',
      untimedFills: 1,
    });
    expect(usd.ok).toBe(false);
    expect(usd.error).toBe('quote_must_be_fpl');

    const stored = decideCandleIngest('BTC4-FPL', [], {
      pair: 'BTC4',
      timeQuality: 'observer',
      timeSource: 'observer',
      untimedFills: 3,
    });
    expect(stored.ok).toBe(true);
    expect(stored.coverage?.pair).toBe('BTC4-FPL');
    expect(stored.coverage?.quote).toBe('FPL');
    expect(stored.coverage?.timeQuality).toBe('observer');
    expect(stored.coverage?.untimedFills).toBe(3);
  });

  it('maps the retired empty reason and does not invent canonical_sealed', () => {
    const stored = coverage({
      timeQuality: 'canonical_sealed',
      timeSource: 'explorer.sealed_at',
      emptyReasonHint: 'no_canonical_block_time',
      untimedFills: 8,
    });
    expect(stored.timeQuality).toBe('unavailable');
    expect(stored.timeSource).toBe('none');
    expect(stored.emptyReasonHint).toBe('verified_utc_unavailable');
    expect(stored.canonicalTipsStored).toBe(0);
    const body = presentFalconCandles({
      pair: 'USDC-FPL',
      timeframe: '1m',
      candles: [],
      coverage: stored,
    });
    expect(body.timeQuality).toBe('unavailable');
    expect(body.emptyReason).toBe('verified_utc_unavailable');
    expect(body.coverage?.untimedFills).toBe(8);
  });
});

describe('parseFalconTimeframe', () => {
  it('defaults a missing value and rejects 1M and other unsupported tokens', () => {
    expect(parseFalconTimeframe(undefined)).toBe('5m');
    expect(parseFalconTimeframe('')).toBe('5m');
    expect(parseFalconTimeframe('1m')).toBe('1m');
    expect(parseFalconTimeframe('5m')).toBe('5m');
    expect(parseFalconTimeframe('15m')).toBe('15m');
    expect(parseFalconTimeframe('1h')).toBe('1h');
    expect(parseFalconTimeframe('1M')).toBeNull();
    expect(parseFalconTimeframe('1H')).toBeNull();
    expect(parseFalconTimeframe('4h')).toBeNull();
    expect(parseFalconTimeframe('1d')).toBeNull();
    expect(parseFalconTimeframe('1w')).toBeNull();
  });
});
