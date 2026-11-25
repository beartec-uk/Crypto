// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.

export interface FalconWatchlistCandle {
  time: number;
  open: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

export function candleTimeSec(time: number): number {
  return time > 1e12 ? time / 1000 : time;
}

export function falconChangePercent(parsed: FalconWatchlistCandle[]): number {
  if (parsed.length === 0) return 0;
  const last = parsed[parsed.length - 1];
  if (parsed.length === 1) {
    if (!last.open || last.open <= 0) return 0;
    return ((last.close - last.open) / last.open) * 100;
  }
  const cutoff = candleTimeSec(last.time) - 24 * 3600;
  let ref = parsed[0];
  let hitCutoff = false;
  for (const candle of parsed) {
    if (candleTimeSec(candle.time) <= cutoff) {
      ref = candle;
      hitCutoff = true;
    } else {
      break;
    }
  }
  const baseline = hitCutoff ? ref.close : (ref.open > 0 ? ref.open : ref.close);
  if (!baseline || baseline <= 0) return 0;
  return ((last.close - baseline) / baseline) * 100;
}
