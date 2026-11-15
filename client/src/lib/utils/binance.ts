// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
/**
 * Binance API utility functions
 * Extracted from multiple files for reusability
 */

/**
 * Convert timeframe to Binance API format
 * Used across ChartFullscreenPage, useSimpleChart, historicalDataCache, TickerTable
 */
export const convertTimeframe = (tf: string): string => {
  // Every interval Binance's /api/v3/klines accepts. Previously only six were
  // listed and anything else (e.g. '1w' for a weekly EMA) silently fell back to
  // '1h', so a "200W" EMA was really a 200-hour EMA built from hourly candles.
  const map: Record<string, string> = {
    '1m': '1m', '3m': '3m', '5m': '5m', '15m': '15m', '30m': '30m',
    '1h': '1h', '2h': '2h', '4h': '4h', '6h': '6h', '8h': '8h', '12h': '12h',
    '1d': '1d', '3d': '3d', '1w': '1w', '1M': '1M',
    // Common aliases
    '1D': '1d', '1W': '1w', '1H': '1h', '4H': '4h',
  };
  return map[tf] || '1h';
};
