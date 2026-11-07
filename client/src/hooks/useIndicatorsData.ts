// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useMemo } from 'react';
import { isFalconTicker } from '@/lib/tickerUtils';
import { useCandleData } from './useCandleData';
import { generateMockCVDData } from '@/utils/mockCVDData';
import { useGDSMarketMetrics } from '@/hooks/indicators/useGDSMarketMetrics';
import type { CVDDataItem } from '@/types/chart';
import type { GDSExternalMetrics } from '@/lib/indicators/genuineDemandScore';

interface UseIndicatorsDataOptions {
  symbol: string;
  timeframe: string;
}

interface UseIndicatorsDataReturn {
  candles: ReturnType<typeof useCandleData>['candles'];
  cvdData: CVDDataItem[];
  externalMetrics: GDSExternalMetrics;
  isLoading: boolean;
  error: Error | null;
  candlesLoading: boolean;
  candlesError: Error | null;
  falconMeta: ReturnType<typeof useCandleData>['falconMeta'];
}

export function useIndicatorsData({
  symbol,
  timeframe,
}: UseIndicatorsDataOptions): UseIndicatorsDataReturn {
  const hasSymbol = Boolean(symbol && symbol.trim());

  const { candles, isLoading, error, falconMeta } = useCandleData({
    symbol,
    timeframe,
    enabled: hasSymbol,
    refreshInterval: 10000,
  });

  const {
    externalMetrics,
    cvdData: liveCvdData,
    isLoading: isMetricsLoading,
    error: metricsError,
  } = useGDSMarketMetrics({
    symbol,
    timeframe,
    enabled: hasSymbol && !isFalconTicker(symbol),
  });

  // Generate mock CVD data when candles update
  const fallbackCvdData = useMemo(() => {
    if (candles.length === 0) return [];
    return generateMockCVDData(candles);
  }, [candles]);

  const cvdData = liveCvdData.length > 0 ? liveCvdData : fallbackCvdData;

  return {
    candles,
    cvdData,
    externalMetrics,
    isLoading: isLoading || isMetricsLoading,
    error: error || metricsError,
    candlesLoading: isLoading,
    candlesError: error,
    falconMeta,
  };
}
