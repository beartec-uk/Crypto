// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { describe, it, expect } from 'vitest';
import { projectSeriesOntoCandles } from '../projectHtfSeries';
import { convertTimeframe } from '@/lib/utils/binance';

const DAY = 86400;
const WEEK = 7 * DAY;

describe('projectSeriesOntoCandles', () => {
  it('maps a weekly series onto daily candles without adding timestamps', () => {
    const w0 = 1_700_000_000 - (1_700_000_000 % WEEK);
    const weekly = [w0, w0 + WEEK, w0 + 2 * WEEK];
    const values = [undefined, 10, 20];
    const daily = Array.from({ length: 21 }, (_, i) => w0 + i * DAY);
    const out = projectSeriesOntoCandles(daily, weekly, values);
    // Only chart candle times are used.
    expect(out.every(p => daily.includes(p.time))).toBe(true);
    // First week has no EMA value yet (warm-up), so it's skipped.
    expect(out[0].time).toBe(w0 + WEEK);
    expect(out.find(p => p.time === w0 + WEEK + 6 * DAY)?.value).toBe(10);
    expect(out.find(p => p.time === w0 + 2 * WEEK)?.value).toBe(20);
    expect(out[out.length - 1].value).toBe(20);
  });

  it('takes the last lower-TF bar inside each higher-TF candle', () => {
    const t0 = 1_700_000_000 - (1_700_000_000 % DAY);
    const hourly = Array.from({ length: 48 }, (_, i) => t0 + i * 3600);
    const values = hourly.map((_, i) => i);
    const out = projectSeriesOntoCandles([t0, t0 + DAY], hourly, values);
    expect(out).toEqual([
      { time: t0, value: 23 },
      { time: t0 + DAY, value: 47 },
    ]);
  });

  it('returns nothing when source data starts after the candles', () => {
    expect(projectSeriesOntoCandles([1, 2, 3], [10, 20], [1, 2])).toEqual([]);
  });
});

describe('convertTimeframe', () => {
  it('passes weekly/monthly through instead of falling back to 1h', () => {
    expect(convertTimeframe('1w')).toBe('1w');
    expect(convertTimeframe('1M')).toBe('1M');
    expect(convertTimeframe('4h')).toBe('4h');
  });
});
