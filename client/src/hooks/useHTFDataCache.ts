// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useState, useEffect, useRef } from 'react';
import { convertTimeframe } from '@/lib/utils/binance';

interface EMAConfig {
  timeframe: string;
  period: number;
  color?: string;
}

interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface UseHTFDataCacheOptions {
  symbol: string;
  currentTimeframe: string;
  emaConfigs: EMAConfig[];
  enabled: boolean;
}

interface UseHTFDataCacheReturn {
  htfDataCache: React.MutableRefObject<Record<string, CandleData[]>>;
  /** Bumps every time new HTF candles land in the cache, so consumers re-render. */
  cacheVersion: number;
  isLoading: boolean;
}

// Enough history for long HTF EMAs (e.g. 200W) while staying bounded.
const HTF_TARGET_CANDLES = 2000;
// Hard stop on paging so a misbehaving API can never loop forever.
const HTF_MAX_PAGES = 3;

export function useHTFDataCache({
  symbol,
  currentTimeframe,
  emaConfigs,
  enabled,
}: UseHTFDataCacheOptions): UseHTFDataCacheReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(0);
  const htfDataCache = useRef<Record<string, CandleData[]>>({});
  const prevSymbolRef = useRef<string>(symbol);

  // Clear cache when symbol changes.
  // NOTE: we no longer clear on timeframe change. HTF candles are keyed by
  // symbol+HTF and don't depend on the chart timeframe; MovingAverages now maps
  // HTF values onto the chart's own candle times, so no stale timestamps leak
  // into the time scale. Clearing on every switch forced a refetch and left the
  // HTF EMA blank (or squashed) after each timeframe change.
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      htfDataCache.current = {};
      prevSymbolRef.current = symbol;
      setCacheVersion(v => v + 1);
    }
  }, [symbol]);

  // Stable key of the HTF timeframes we need, so unrelated config edits
  // (colour, width, period) don't refire the fetch.
  const htfKey = [...new Set(
    emaConfigs
      .map(c => c.timeframe)
      .filter(tf => tf && tf !== 'current' && tf !== currentTimeframe),
  )].sort().join(',');

  useEffect(() => {
    if (!enabled || !symbol || !htfKey) return;

    const controller = new AbortController();
    let cancelled = false;

    const fetchHTFData = async () => {
      setIsLoading(true);
      for (const tf of htfKey.split(',')) {
        if (cancelled) return;
        const cacheKey = `${symbol}_${tf}`;
        if (htfDataCache.current[cacheKey]) continue;

        try {
          const binanceInterval = convertTimeframe(tf);
          const allKlines: any[] = [];
          let endTime = Date.now();

          for (let page = 0; page < HTF_MAX_PAGES && allKlines.length < HTF_TARGET_CANDLES; page++) {
            const response = await fetch(
              `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${binanceInterval}&limit=1000&endTime=${endTime}`,
              { signal: controller.signal },
            );
            if (!response.ok) break;
            const klines = await response.json();
            if (!Array.isArray(klines) || !klines.length) break;
            allKlines.unshift(...klines);
            endTime = klines[0][0] - 1;
            if (klines.length < 1000) break;
          }

          if (cancelled) return;
          if (allKlines.length > 0) {
            htfDataCache.current[cacheKey] = allKlines.slice(-HTF_TARGET_CANDLES).map((kline: any[]) => ({
              time: Math.floor(kline[0] / 1000),
              open: parseFloat(kline[1]),
              high: parseFloat(kline[2]),
              low: parseFloat(kline[3]),
              close: parseFloat(kline[4]),
              volume: parseFloat(kline[5]),
            }));
            setCacheVersion(v => v + 1);
          }
        } catch (e) {
          if ((e as Error)?.name !== 'AbortError') {
            console.error(`[EMA HTF] Failed to fetch ${tf} data:`, e);
          }
        }
      }
      if (!cancelled) setIsLoading(false);
    };

    fetchHTFData();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, htfKey, symbol]);

  return { htfDataCache, cacheVersion, isLoading };
}
