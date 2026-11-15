// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
/**
 * Project an EMA computed on another timeframe onto the chart's own candle
 * timestamps. For each chart candle we take the EMA of the last source bar that
 * opened before the next chart candle opens — i.e. the HTF bar containing the
 * candle (for a higher TF), or the final sub-bar inside it (for a lower TF).
 *
 * Plotting the HTF series on its own timestamps (the previous behaviour) injected
 * hundreds/thousands of extra time points into the chart's shared time scale,
 * which squashed the real candles, broke fitContent and made a timeframe switch
 * look like it never loaded.
 */
export function projectSeriesOntoCandles(
  candleTimes: number[],
  sourceTimes: number[],
  sourceValues: (number | undefined)[],
): { time: number; value: number }[] {
  const out: { time: number; value: number }[] = [];
  let j = -1;
  for (let i = 0; i < candleTimes.length; i++) {
    // The last candle has no successor; assume the same spacing as the previous
    // bar so source bars newer than the chart data aren't pulled in.
    const end = i + 1 < candleTimes.length
      ? candleTimes[i + 1]
      : i > 0
        ? candleTimes[i] + (candleTimes[i] - candleTimes[i - 1])
        : Number.POSITIVE_INFINITY;
    while (j + 1 < sourceTimes.length && sourceTimes[j + 1] < end) j++;
    if (j < 0) continue;
    const v = sourceValues[j];
    if (v === undefined || v === null || !Number.isFinite(v)) continue;
    out.push({ time: candleTimes[i], value: v });
  }
  return out;
}
