// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useEffect, useRef } from 'react';
import { IChartApi, LineSeries } from 'lightweight-charts';
import type { MAConfig } from '@/types/chart.types';
import { projectSeriesOntoCandles } from '@/lib/chart/projectHtfSeries';

interface MovingAveragesProps {
  chart: IChartApi | null;
  maConfigs: MAConfig[];
  show: boolean;
  candles: any[];
  calculateEMA: (closes: number[], period: number) => number[];
  emaHTFDataCache: React.MutableRefObject<Record<string, any[]>>;
  symbol: string;
  interval: string;
  /** Changes whenever new HTF candles land in emaHTFDataCache (a ref), so the
   *  HTF EMA is drawn as soon as its data arrives rather than on the next poll. */
  htfCacheVersion?: number;
}

export function MovingAverages({
  chart,
  maConfigs,
  show,
  candles,
  calculateEMA,
  emaHTFDataCache,
  symbol,
  interval,
  htfCacheVersion = 0,
}: MovingAveragesProps) {
  const emaSeriesRefs = useRef<Record<string, any>>({});

  // Format MA label helper
  const formatMALabel = (period: number, timeframe: string): string => {
    if (timeframe === 'current') return `${period}`;
    // Map timeframe to short code: '1d' -> 'D', '1w' -> 'W', '4h' -> 'h4', etc.
    const tfMap: Record<string, string> = {
      '1m': 'm1', '3m': 'm3', '5m': 'm5', '15m': 'm15', '30m': 'm30',
      '1h': 'h1', '2h': 'h2', '4h': 'h4', '6h': 'h6', '8h': 'h8', '12h': 'h12',
      '1d': 'D', '3d': '3D', '1w': 'W', '1M': 'M'
    };
    const suffix = tfMap[timeframe] || timeframe;
    return `${period}${suffix}`;
  };

  useEffect(() => {
    if (!chart || candles.length === 0) return;

    const refs = emaSeriesRefs.current;

    // Remove old EMA series that are no longer in configs
    const currentIds = new Set(maConfigs.map(c => c.id));
    Object.keys(refs).forEach(key => {
      if (!currentIds.has(key) && refs[key]) {
        try { chart.removeSeries(refs[key]!); } catch (e) {}
        delete refs[key];
      }
    });

    if (!show) {
      // Remove all EMA series when disabled
      Object.keys(refs).forEach(key => {
        if (refs[key]) {
          try { chart.removeSeries(refs[key]!); } catch (e) {}
          delete refs[key];
        }
      });
      return;
    }

    // Render each EMA config
    for (const config of maConfigs) {
      let emaData: { time: any; value: number }[] = [];
      
      // Determine which data source to use
      const isCurrentTimeframe = config.timeframe === 'current' || config.timeframe === interval;
      
      if (isCurrentTimeframe) {
        // Use current chart candles
        const closes = candles.map(c => c.close);
        const emaValues = calculateEMA(closes, config.period);
        
        // EMA calculation returns array starting at index period-1
        // Pad with undefined to align with candle array
        const paddedEmaValues = new Array(config.period - 1).fill(undefined).concat(emaValues);
        
        emaData = candles.map((c, i) => ({
          time: c.time as any,
          value: paddedEmaValues[i]
        })).filter(d => d.value !== undefined);
      } else {
        // Use higher timeframe data and map to current chart
        const cacheKey = `${symbol}_${config.timeframe}`;
        const htfCandles = emaHTFDataCache.current[cacheKey];
        
        if (htfCandles && htfCandles.length > 0) {
          const htfCloses = htfCandles.map(c => c.close);
          const htfEmaValues = calculateEMA(htfCloses, config.period);
          
          // EMA calculation returns array starting at index period-1
          // Pad with undefined to align with candle array
          const paddedEmaValues = new Array(config.period - 1).fill(undefined).concat(htfEmaValues);
          
          // Map HTF EMA onto the current chart's candle times (no extra
          // timestamps in the shared time scale).
          emaData = projectSeriesOntoCandles(
            candles.map(c => Number(c.time)),
            htfCandles.map(c => Number(c.time)),
            paddedEmaValues,
          ) as { time: any; value: number }[];
        } else if (refs[config.id]) {
          // HTF data not loaded yet (or symbol changed) – clear any old line.
          try { refs[config.id].setData([]); } catch (e) {
            console.warn('[MovingAverages] Failed to clear HTF EMA series data:', e);
          }
        }
      }

      if (emaData.length === 0) continue;

      // Create or update series
      if (!refs[config.id]) {
        const series = chart.addSeries(LineSeries, {
          color: config.color,
          lineWidth: (config.lineWidth || 2) as any,
          title: formatMALabel(config.period, config.timeframe),
          priceLineVisible: false,
          lastValueVisible: true,
        });
        series.setData(emaData);
        refs[config.id] = series;
      } else {
        refs[config.id].setData(emaData);
        refs[config.id].applyOptions({
          color: config.color,
          lineWidth: (config.lineWidth || 2) as any,
          title: formatMALabel(config.period, config.timeframe),
        });
      }
    }

    return () => {
      // Cleanup on unmount
      Object.keys(refs).forEach(key => {
        if (refs[key]) {
          try { chart.removeSeries(refs[key]!); } catch (e) {}
        }
      });
      emaSeriesRefs.current = {};
    };
  }, [chart, maConfigs, show, candles, calculateEMA, symbol, interval, htfCacheVersion]);

  return null;
}
