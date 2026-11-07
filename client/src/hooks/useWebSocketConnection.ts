// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useEffect, useRef } from 'react';
import type { CandleData } from '@/types/chart.types';
import { isFalconTicker } from '@/lib/tickerUtils';

interface UseWebSocketConnectionOptions {
  symbol: string;
  interval: string;
  enabled: boolean;
  candlesLength: number;
  onKlineUpdate: (bar: CandleData, isClosed: boolean) => void;
  onTradeUpdate: (delta: number) => void;
}

export function useWebSocketConnection({
  symbol,
  interval,
  enabled,
  candlesLength,
  onKlineUpdate,
  onTradeUpdate
}: UseWebSocketConnectionOptions) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled || !symbol || !interval || candlesLength === 0) return;
    if (isFalconTicker(symbol)) return;

    // Use global Binance endpoint (works worldwide, not just USA)
    const ws = new WebSocket('wss://stream.binance.com:9443/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('📡 WebSocket connected for real-time updates');
      ws.send(JSON.stringify({
        method: 'SUBSCRIBE',
        params: [
          `${symbol.toLowerCase()}@kline_${interval}`,
          `${symbol.toLowerCase()}@trade`,
        ],
        id: 1,
      }));
    };

    ws.onerror = (error) => {
      console.error('📡 WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('📡 WebSocket closed');
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      
      if (msg.e === 'kline') {
        const k = msg.k;
        const bar: CandleData = {
          time: k.t / 1000,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        };

        onKlineUpdate(bar, k.x); // k.x indicates if candle is closed
      } else if (msg.e === 'trade') {
        const qty = parseFloat(msg.q);
        const isBuy = !msg.m; // Buyer is maker = sell, not maker = buy
        const delta = isBuy ? qty : -qty;
        onTradeUpdate(delta);
      }
    };

    return () => {
      ws.close();
    };
  }, [symbol, interval, enabled, candlesLength, onKlineUpdate, onTradeUpdate]);

  return wsRef;
}
