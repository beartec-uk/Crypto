// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, ColorType, CandlestickSeries } from 'lightweight-charts';
import { convertTimeframe } from '@/lib/utils/binance';
import { falconSafeTimeframe, isFalconTicker } from '@/lib/tickerUtils';

interface UseSimpleChartProps {
  containerRef: React.RefObject<HTMLDivElement>;
  symbol: string;
  timeframe: string;
}

export function useSimpleChart({ containerRef, symbol, timeframe }: UseSimpleChartProps) {
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);

  // Initialize chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      width: containerRef.current.clientWidth,
      height: containerRef.current.clientHeight,
      timeScale: {
        rightOffset: 5,
        barSpacing: 6,
        fixLeftEdge: false,
        fixRightEdge: false,
        lockVisibleTimeRangeOnResize: false,
        rightBarStaysOnScroll: true,
        borderVisible: false,
        visible: true,
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
        borderVisible: false,
        autoScale: true, // Auto-fit to price range
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false, // Disable vertical scroll
      },
      handleScale: {
        axisPressedMouseMove: false,
        mouseWheel: false, // Disable zoom via scroll
        pinch: false, // Disable pinch zoom
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#22c55e',
      borderDownColor: '#ef4444',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceScaleId: 'right',
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;

    // Handle resize
    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [containerRef]);

  // Fetch and update data
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    const getTargetCandleCount = (tf: string): number => {
      const targets: Record<string, number> = {
        '1m': 1500,
        '5m': 2000,
        '15m': 2500,
        '1h': 3000,
        '4h': 3000,
        '1d': 3000,
        '1w': 2000,
      };
      return targets[tf] || 2000;
    };

    const fetchData = async () => {
      try {
        if (isFalconTicker(symbol)) {
          const tf = falconSafeTimeframe(timeframe);
          const response = await fetch(
            `/api/crypto/falcon/candles?pair=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(tf)}&limit=1000`,
          );
          if (!response.ok) {
            console.error(`Failed to fetch Falcon chart data: ${response.status} ${response.statusText}`);
            return;
          }
          const payload = await response.json();
          const list = Array.isArray(payload.candles) ? payload.candles : [];
          const chartData = list.map((c: any) => ({
            time: Number(c.time) as any,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
          }));
          candleSeriesRef.current?.setData(chartData);
          return;
        }
        const binanceTimeframe = convertTimeframe(timeframe);
        const targetCandles = getTargetCandleCount(timeframe);
        const allCandles: any[] = [];
        let endTime = Date.now();

        while (allCandles.length < targetCandles) {
          const response = await fetch(
            `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${binanceTimeframe}&limit=1000&endTime=${endTime}`
          );

          if (!response.ok) {
            console.error(`Failed to fetch chart data: ${response.status} ${response.statusText}`);
            break;
          }

          const batch = await response.json();
          if (!batch.length) break;

          allCandles.unshift(...batch);
          endTime = batch[0][0] - 1;

          if (batch.length < 1000) break;
        }

        const chartData = allCandles.slice(-targetCandles).map((c: any) => ({
          time: Math.floor(c[0] / 1000) as any,
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low: parseFloat(c[3]),
          close: parseFloat(c[4]),
        }));

        candleSeriesRef.current?.setData(chartData);
      } catch (error) {
        console.error('Failed to fetch chart data:', error);
      }
    };

    fetchData();

    // Update every 10 seconds
    const interval = setInterval(fetchData, 10000);

    return () => clearInterval(interval);
  }, [symbol, timeframe]);

  return { chartRef, candleSeriesRef };
}
