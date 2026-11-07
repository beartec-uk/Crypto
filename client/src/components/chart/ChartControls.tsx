import { FALCON_CANDLE_TIMEFRAMES, isFalconTicker } from '@/lib/tickerUtils';
// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
interface ChartControlsProps {
  symbol: string;
  interval: string;
  onSymbolChange: (symbol: string) => void;
  onIntervalChange: (interval: string) => void;
  watchlistTickers: string[];
  isFullscreen?: boolean;
}

export function ChartControls({
  symbol,
  interval,
  onSymbolChange,
  onIntervalChange,
  watchlistTickers,
  isFullscreen = false
}: ChartControlsProps) {
  if (!isFullscreen) {
    return null;
  }

  return (
    <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
      {/* Ticker Dropdown */}
      <select
        value={symbol}
        onChange={(e) => {
          const newSymbol = e.target.value;
          if (newSymbol && newSymbol !== symbol) {
            onSymbolChange(newSymbol);
          }
        }}
        className="px-3 py-2 bg-slate-800/90 text-white rounded-lg border border-slate-600 hover:bg-slate-700 transition-all text-sm font-medium"
      >
        {watchlistTickers.map(ticker => (
          <option key={ticker} value={ticker}>
            {ticker.replace('USDT', '/USDT')}
          </option>
        ))}
      </select>
      
      {/* Timeframe Dropdown */}
      <select
        value={interval}
        onChange={(e) => onIntervalChange(e.target.value)}
        className="px-3 py-2 bg-slate-800/90 text-white rounded-lg border border-slate-600 hover:bg-slate-700 transition-all text-sm font-medium"
      >
        {(isFalconTicker(symbol) ? [...FALCON_CANDLE_TIMEFRAMES] : ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','3d','1w','1M']).map((tf) => (
          <option key={tf} value={tf}>{tf === '1d' ? '1D' : tf === '1w' ? '1W' : tf === '1M' ? '1M' : tf}</option>
        ))}
      </select>
    </div>
  );
}
