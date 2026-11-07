// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useState, useCallback, useRef, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { CandleData } from '@/types/chart.types';
import type { FootprintData } from '@/types/smc.types';
import { isFalconTicker } from '@/lib/tickerUtils';

interface UseChartDataOptions {
  symbol: string;
  interval: string;
  useMultiExchange: boolean;
}

export function useChartData({ symbol, interval, useMultiExchange }: UseChartDataOptions) {
  const [candles, setCandles] = useState<CandleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [footprintData, setFootprintData] = useState<FootprintData[]>([]);
  const [realDeltaData, setRealDeltaData] = useState<Map<number, number>>(new Map());
  const [deltaHistory, setDeltaHistory] = useState<any[]>([]);
  const [cumDelta, setCumDelta] = useState(0);
  
  const fetchGenerationRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Fetch initial candle data from Binance via backend proxy
  // Fetches up to 3000 candles by making multiple requests
  const fetchInitialData = useCallback(async () => {
    // Cancel any pending requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    // Increment generation to invalidate any pending responses
    fetchGenerationRef.current += 1;
    const currentGeneration = fetchGenerationRef.current;
    
    try {
      setLoading(true);

      // Falcon PL testnet — do not hit Binance for these symbols.
      if (isFalconTicker(symbol)) {
        const tf = interval;
        const resp = await fetch(
          `/api/crypto/falcon/candles?pair=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(tf)}&limit=1000`,
          { signal: abortController.signal },
        );
        if (!resp.ok) throw new Error(`Failed to fetch Falcon candles: ${resp.statusText}`);
        const payload = await resp.json();
        if (currentGeneration !== fetchGenerationRef.current) return;
        const list = Array.isArray(payload.candles) ? payload.candles : [];
        const mapped: CandleData[] = list.map((c: any) => ({
          time: Number(c.time),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume ?? 0),
        }));
        setCandles(mapped);
        setFootprintData([]);
        setRealDeltaData(new Map());
        setDeltaHistory([]);
        setCumDelta(0);
        setLoading(false);
        return;
      }
      
      // Fetch first batch (most recent 1000 candles)
      const url1 = `/api/binance/klines?symbol=${symbol}&interval=${interval}&limit=1000`;
      const response1 = await fetch(url1, { signal: abortController.signal });
      
      if (!response1.ok) {
        throw new Error(`Failed to fetch candles: ${response1.statusText}`);
      }
      
      const klines1 = await response1.json();
      
      // Check if this response is still relevant
      if (currentGeneration !== fetchGenerationRef.current) {
        console.log('🚫 Ignoring stale response from generation', currentGeneration);
        return;
      }
      
      // Get the earliest timestamp from first batch to fetch older data
      let allKlines = [...klines1];
      
      if (klines1.length > 0) {
        const earliestTime = klines1[0][0]; // First candle's open time
        
        // Fetch second batch with cache-busting
        const endTime2 = earliestTime - 1;
        console.log('📊 Fetching extended history - batch 2 endTime:', endTime2);
        const url2 = `/api/binance/klines?symbol=${symbol}&interval=${interval}&limit=1000&endTime=${endTime2}&_=${Date.now()}`;
        
        try {
          const response2 = await fetch(url2, { cache: 'no-store' });
          if (response2.ok) {
            const klines2 = await response2.json();
            console.log('📊 Batch 2 received:', klines2.length, 'candles, earliest:', klines2[0]?.[0]);
            if (klines2.length > 0 && klines2[0][0] < earliestTime) {
              allKlines = [...klines2, ...allKlines];
              
              // Fetch third batch
              const endTime3 = klines2[0][0] - 1;
              console.log('📊 Fetching extended history - batch 3 endTime:', endTime3);
              const url3 = `/api/binance/klines?symbol=${symbol}&interval=${interval}&limit=1000&endTime=${endTime3}&_=${Date.now() + 1}`;
              
              try {
                const response3 = await fetch(url3, { cache: 'no-store' });
                if (response3.ok) {
                  const klines3 = await response3.json();
                  console.log('📊 Batch 3 received:', klines3.length, 'candles, earliest:', klines3[0]?.[0]);
                  if (klines3.length > 0 && klines3[0][0] < klines2[0][0]) {
                    allKlines = [...klines3, ...allKlines];
                  }
                }
              } catch (e) {
                console.log('📊 Batch 3 failed (optional):', e);
              }
            }
          }
        } catch (e) {
          console.log('📊 Batch 2 failed:', e);
        }
      }
      
      // Check again if this response is still relevant
      if (currentGeneration !== fetchGenerationRef.current) {
        console.log('🚫 Ignoring stale response from generation', currentGeneration);
        return;
      }
      
      // Sort by time ascending (required by lightweight-charts)
      allKlines.sort((a: any[], b: any[]) => a[0] - b[0]);
      
      // Remove duplicates (in case of overlapping data)
      const uniqueKlines = allKlines.filter((kline: any[], index: number, arr: any[][]) => 
        index === 0 || kline[0] !== arr[index - 1][0]
      );
      
      const candleData: CandleData[] = uniqueKlines.map((k: any[]) => ({
        time: k[0] / 1000,
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
      }));

      console.log('✅ Fetched candle data:', candleData.length, 'candles (extended history)');
      setCandles(candleData);
      
      // Fetch REAL delta data from Binance aggTrades via orderflow API
      // SKIP if using multi-exchange mode (multi-exchange provides its own table data)
      if (!useMultiExchange) {
        try {
          const yahooSymbol = symbol.replace('USDT', '-USD');
          const footprintUrl = `/api/crypto/orderflow?symbol=${yahooSymbol}&period=1mo&interval=${interval}`;
          const fpResponse = await fetch(footprintUrl, { signal: abortController.signal });
          
          if (fpResponse.ok) {
            const fpData = await fpResponse.json();
            
            // Check if this response is still relevant
            if (currentGeneration !== fetchGenerationRef.current) {
              console.log('🚫 Ignoring stale orderflow response');
              return;
            }
            
            // Store footprint data for FVG analysis
            if (fpData.footprint) {
              setFootprintData(fpData.footprint);
              
              // Create a map of timestamp -> real delta
              const deltaMap = new Map<number, number>();
              fpData.footprint.forEach((fp: any) => {
                deltaMap.set(fp.time, fp.delta);
              });
              setRealDeltaData(deltaMap);
              
              // Calculate delta history using REAL delta values
              let runningCVD = 0;
              const history = candleData.slice(-20).map(candle => {
                const delta = deltaMap.get(candle.time) || 0;
                runningCVD += delta;
                return {
                  time: new Date(candle.time * 1000).toLocaleTimeString(),
                  timestamp: candle.time, // Unix timestamp for chart matching
                  delta,
                  cumDelta: runningCVD,
                  isBull: candle.close >= candle.open,
                  volume: candle.volume
                };
              });
              
              setDeltaHistory(history);
              setCumDelta(runningCVD);
              
              console.log('✅ Loaded REAL delta data from Binance aggTrades:', fpData.footprint.length, 'candles');
              console.log('📊 Delta match rate:', (fpData.footprint.filter((fp: any) => candleData.some(c => c.time === fp.time)).length / candleData.length * 100).toFixed(1) + '%');
            }
          }
        } catch (fpError) {
          // Ignore abort errors (user changed timeframe)
          if (fpError instanceof Error && fpError.name === 'AbortError') {
            console.log('🚫 Orderflow fetch aborted');
            return;
          }
          console.warn('Could not fetch footprint data:', fpError);
        }
      }
    } catch (error) {
      // Ignore abort errors (user changed timeframe)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🚫 Main fetch aborted');
        return;
      }
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  }, [symbol, interval, useMultiExchange]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  useEffect(() => {
    if (!isFalconTicker(symbol)) return undefined;
    const id = window.setInterval(() => {
      void (async () => {
        try {
          const resp = await fetch(
            `/api/crypto/falcon/candles?pair=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(interval)}&limit=1000`,
          );
          if (!resp.ok) return;
          const payload = await resp.json();
          const list = Array.isArray(payload.candles) ? payload.candles : [];
          setCandles(list.map((c: any) => ({
            time: Number(c.time),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: Number(c.volume ?? 0),
          })));
        } catch {
          /* keep the last Falcon bars */
        }
      })();
    }, 10000);
    return () => window.clearInterval(id);
  }, [symbol, interval]);

  return {
    candles,
    setCandles,
    loading,
    setLoading,
    footprintData,
    setFootprintData,
    realDeltaData,
    setRealDeltaData,
    deltaHistory,
    setDeltaHistory,
    cumDelta,
    setCumDelta,
    fetchInitialData
  };
}
