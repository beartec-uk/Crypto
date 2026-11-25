import { describe, expect, it } from 'vitest';
import { falconChangePercent } from '../falconWatchlist';

describe('falconChangePercent', () => {
  it('returns 0 when empty', () => {
    expect(falconChangePercent([])).toBe(0);
  });

  it('uses open-to-close on a single candle', () => {
    expect(
      falconChangePercent([{ time: 1795640400, open: 80, close: 82 }]),
    ).toBeCloseTo(2.5);
  });

  it('uses first candle open when all candles are within 24h', () => {
    expect(
      falconChangePercent([
        { time: 1795640400, open: 4000000, close: 4020000 },
        { time: 1795640460, open: 4020000, close: 4100000 },
      ]),
    ).toBeCloseTo(2.5);
  });

  it('uses the 24h cutoff candle close when history spans > 24h', () => {
    expect(
      falconChangePercent([
        { time: 1795500000, open: 3900000, close: 4000000 },
        { time: 1795560000, open: 4000000, close: 4050000 },
        { time: 1795640000, open: 4050000, close: 4080000 },
      ]),
    ).toBeCloseTo(2.0);
  });
});
