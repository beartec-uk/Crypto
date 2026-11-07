// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { X, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatTickerDisplay } from '@/lib/chart/priceUtils';
import { FALCON_CANDLE_TIMEFRAMES, isFalconTicker } from '@/lib/tickerUtils';

interface FullscreenChartToolbarProps {
  symbol: string;
  onSymbolChange: (symbol: string) => void;
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  watchlistTickers: string[];
  onClose: () => void;
  onOpenAlerts?: () => void;
}

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];

export function FullscreenChartToolbar({
  symbol,
  onSymbolChange,
  timeframe,
  onTimeframeChange,
  watchlistTickers,
  onClose,
  onOpenAlerts,
}: FullscreenChartToolbarProps) {
  return (
    <div className="bt-dark-surface bg-slate-900 border-b border-slate-700 px-2 py-2 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onClose} aria-label="Close chart">
          <X className="h-3.5 w-3.5" />
        </Button>

        {onOpenAlerts && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenAlerts}
            aria-label="Open alerts"
            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:border-blue-500"
          >
            <Bell className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <Select value={symbol} onValueChange={onSymbolChange}>
        <SelectTrigger className="w-28 bg-slate-800 text-white border-slate-600 hover:bg-slate-700 focus:ring-slate-500">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-600">
          {watchlistTickers.map((ticker) => (
            <SelectItem key={ticker} value={ticker} className="text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer">
              {formatTickerDisplay(ticker)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={timeframe} onValueChange={onTimeframeChange}>
        <SelectTrigger className="w-16 bg-slate-800 text-white border-slate-600 hover:bg-slate-700 focus:ring-slate-500">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-800 border-slate-600">
          {(isFalconTicker(symbol)
            ? TIMEFRAMES.filter((tf) => (FALCON_CANDLE_TIMEFRAMES as readonly string[]).includes(tf))
            : TIMEFRAMES
          ).map((tf) => (
            <SelectItem key={tf} value={tf} className="text-white hover:bg-slate-700 focus:bg-slate-700 cursor-pointer">
              {tf}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
