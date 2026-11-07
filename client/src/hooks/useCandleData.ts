// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useState, useEffect, useRef, useCallback } from 'react';
import type { Candle } from '@/types/chart';
import { isFalconTicker } from '@/lib/tickerUtils';
import { parseFalconCandleMeta, type FalconCandleMeta } from '@/lib/falconChartStatus';

export type { FalconCandleMeta };

interface UseCandleDataOptions {
  symbol: string;
  timeframe: string;
  enabled?: boolean;
  refreshInterval?: number; // milliseconds
}

interface UseCandleDataReturn {
  candles: Candle[];
  /** Key reflecting the symbol+timeframe the current `candles` array actually belongs to.
   *  Callers can compare against `${symbol}_${timeframe}` to detect stale candle data. */
  candlesKey: string;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  /** Falcon (testnet 2300) metadata: note, emptyReason, timeQuality, coverage… null for non-Falcon symbols. */
  falconMeta: FalconCandleMeta | null;
}

export function useCandleData({
  symbol,
  timeframe,
  enabled = true,
  refreshInterval = 10000, // 10s default
}: UseCandleDataOptions): UseCandleDataReturn {
  const [candles, setCandles] = useState<Candle[]>([]);
  /** Tracks which symbol+timeframe the current `candles` array represents. */
  const [candlesKey, setCandlesKey] = useState(`${symbol}_${timeframe}`);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [falconMeta, setFalconMeta] = useState<FalconCandleMeta | null>(null);
  const requestIdRef = useRef(0);

  const fetchCandles = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++requestIdRef.current;

    try {
      setIsLoading(true);
      setError(null);

      const falcon = isFalconTicker(symbol);
      const response = await fetch(
        falcon
          ? `/api/crypto/falcon/candles?pair=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=1000`
          : `/api/crypto/extended-history?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`,
        { signal },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch candles: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const candleData: Candle[] = Array.isArray(data.candles) ? data.candles : [];

      if (requestId === requestIdRef.current) {
        setCandles(candleData);
        setFalconMeta(falcon ? parseFalconCandleMeta(data, symbol) : null);
        setCandlesKey(`${symbol}_${timeframe}`);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      console.error('Failed to fetch candle data:', err);
      if (requestId === requestIdRef.current) {
        setCandles([]);
        setFalconMeta(null);
        setCandlesKey(`${symbol}_${timeframe}`);
        setError(err instanceof Error ? err : new Error('Unknown error'));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [symbol, timeframe]);

  useEffect(() => {
    if (!enabled || !symbol?.trim()) {
      setCandles([]);
      setFalconMeta(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Do NOT immediately clear candles on symbol/timeframe changes.
    // Keeping the previous bars visible prevents the chart from going blank
    // during the brief network round-trip.  New data replaces them atomically
    // once the fetch completes.  The `candlesKey` lets the chart lifecycle skip
    // rendering stale candles at the wrong timeframe scale.
    setError(null);
    setIsLoading(true);
    setFalconMeta(null);

    const initialController = new AbortController();
    fetchCandles(initialController.signal);

    const interval = setInterval(() => {
      const pollController = new AbortController();
      fetchCandles(pollController.signal);
    }, refreshInterval);

    return () => {
      initialController.abort();
      clearInterval(interval);
    };
  }, [symbol, timeframe, enabled, refreshInterval, fetchCandles]);

  return {
    candles,
    candlesKey,
    isLoading,
    error,
    refetch: fetchCandles,
    falconMeta,
  };
}
