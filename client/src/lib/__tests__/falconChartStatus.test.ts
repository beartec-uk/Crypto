import { describe, it, expect } from 'vitest';
import { parseFalconCandleMeta, falconChartStatus, FALCON_ARRIVAL_NOTE } from '../falconChartStatus';

const cov = (timed: number, untimed: number) => ({ timedFills: timed, untimedFills: untimed, gaps: [] });
const run = (data: any, pair = 'USDC-FPL', extra: any = {}) =>
  falconChartStatus({ pair, candleCount: data?.candles?.length ?? 0, isLoading: false, error: null, meta: data ? parseFalconCandleMeta(data, pair) : null, ...extra });

describe('falconChartStatus', () => {
  it('bars -> arrival note, never verified UTC', () => {
    const d = { candles: [{ time: 1 }], verifiedUtc: true, coverage: cov(1, 0), networkId: 2300, quote: 'FPL' };
    expect(parseFalconCandleMeta(d, 'BTC4-FPL').verifiedUtc).toBe(false);
    const s = run(d, 'BTC4-FPL');
    expect(s.kind).toBe('bars');
    expect(s.detail).toBe(FALCON_ARRIVAL_NOTE);
    expect(s.detail).toMatch(/not verified UTC/);
    expect(s.title).toContain('BTC4/FPL');
  });
  it('USDC with zero fills -> no trades, labelled USDC', () => {
    const s = run({ candles: [], emptyReason: 'no_observer_arrival_times', coverage: cov(0, 0) });
    expect(s.kind).toBe('no_trades');
    expect(s.title).toContain('USDC/FPL');
    expect(s.title).not.toContain('BTC4');
  });
  it('untimed fills -> no arrival times', () => {
    expect(run({ candles: [], emptyReason: 'no_observer_arrival_times', coverage: cov(0, 3) }).kind).toBe('no_arrival_times');
  });
  it('no coverage -> no ingest', () => {
    expect(run({ candles: [], emptyReason: 'no_ingest_yet', coverage: null }).kind).toBe('no_ingest');
  });
  it('error and loading', () => {
    expect(run(null, 'USDC-FPL', { error: new Error('x') }).kind).toBe('error');
    expect(run(null, 'USDC-FPL', { isLoading: true }).kind).toBe('loading');
  });
});
