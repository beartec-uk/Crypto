// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { Button } from '@/components/ui/button';
import { FALCON_CANDLE_TIMEFRAMES, isFalconTicker } from '@/lib/tickerUtils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RefreshCw, Maximize2, Minimize2, ArrowRight } from 'lucide-react';

interface ChartControlBarProps {
  symbol: string;
  interval: string;
  period: string;
  onSymbolChange: (symbol: string) => void;
  onIntervalChange: (interval: string) => void;
  onPeriodChange: (period: string) => void;
  onRefresh: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  autoScroll?: boolean;
  onToggleAutoScroll?: () => void;
}

const INTERVALS = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
  { value: '1d', label: '1d' },
  { value: '1w', label: '1w' },
  { value: '1M', label: '1M' }
];

const PERIODS = [
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' }
];

export function ChartControlBar({
  symbol,
  interval,
  period,
  onSymbolChange,
  onIntervalChange,
  onPeriodChange,
  onRefresh,
  isFullscreen,
  onToggleFullscreen,
  autoScroll,
  onToggleAutoScroll
}: ChartControlBarProps) {
  return (
    <div className="flex items-center gap-2 p-2 bg-slate-900 border-b border-slate-700 flex-wrap">
      {/* Symbol Selector */}
      <Select value={symbol} onValueChange={onSymbolChange}>
        <SelectTrigger className="w-32 bg-slate-800 border-slate-700">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="BTCUSDT">BTC/USDT</SelectItem>
          <SelectItem value="ETHUSDT">ETH/USDT</SelectItem>
          <SelectItem value="XRPUSDT">XRP/USDT</SelectItem>
          <SelectItem value="SOLUSDT">SOL/USDT</SelectItem>
          <SelectItem value="BNBUSDT">BNB/USDT</SelectItem>
        </SelectContent>
      </Select>

      {/* Interval Buttons */}
      <div className="flex gap-1 bg-slate-800 rounded p-1">
        {(isFalconTicker(symbol)
          ? INTERVALS.filter(({ value }) => (FALCON_CANDLE_TIMEFRAMES as readonly string[]).includes(value))
          : INTERVALS
        ).map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onIntervalChange(value)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              interval === value
                ? 'bg-blue-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Period Selector */}
      <div className="flex gap-1 bg-slate-800 rounded p-1">
        {PERIODS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => onPeriodChange(value)}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              period === value
                ? 'bg-cyan-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 ml-auto">
        {/* Auto-scroll Toggle */}
        {onToggleAutoScroll && (
          <Button
            size="sm"
            variant="outline"
            onClick={onToggleAutoScroll}
            className={autoScroll ? 'bg-blue-600/20 border-blue-600' : ''}
            title="Auto-scroll to latest candle"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}

        {/* Refresh */}
        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          title="Refresh data"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>

        {/* Fullscreen */}
        <Button
          size="sm"
          variant="outline"
          onClick={onToggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen (F11)' : 'Fullscreen (F11)'}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
