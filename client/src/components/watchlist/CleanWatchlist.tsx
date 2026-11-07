// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useState, useCallback, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { TickerSearch } from '@/components/TickerSearch';
import { TickerTable } from '@/components/TickerTable';
import { ChartPreview } from '@/components/ChartPreview';
import { useWatchlistState } from '@/hooks/useWatchlistState';
import { useWatchlistBiasSettings } from '@/hooks/useWatchlistBiasSettings';
import { WatchlistSettingsPanel } from '@/components/watchlist/WatchlistSettingsPanel';
import { falconSafeTimeframe, isFalconTicker } from '@/lib/tickerUtils';

interface CleanWatchlistProps {
  onExpandChart?: (context: {
    symbol: string;
    timeframe: string;
    watchlist: string[];
  }) => void;
  onSelectionChange?: (context: {
    symbol: string;
    timeframe: string;
    watchlist: string[];
  }) => void;
  onWatchlistBias?: (rows: Array<{ symbol: string; emaBias: 'bullish' | 'bearish' | 'neutral'; structureBias: 'bullish' | 'bearish' | 'neutral' }>) => void;
}

/**
 * Clean-page watchlist wrapper:
 * - Owns selected ticker and timeframe state
 * - Uses useWatchlistBiasSettings for global watchlist bias settings (pivot + EMA lengths) with persistence
 * - Uses useWatchlistState for tickers and add/remove
 * - Shows bias settings in a modal triggered from TickerTable header
 * - Keeps CryptoIndicatorsClean free of inline handlers / watchlist logic
 */
export function CleanWatchlist({ onExpandChart, onSelectionChange, onWatchlistBias }: CleanWatchlistProps = { onExpandChart: undefined, onSelectionChange: undefined }) {
  const watchlist = useWatchlistState();
  const biasSettings = useWatchlistBiasSettings();

  // Selected row — empty until the user adds a ticker
  const [selectedSymbol, setSelectedSymbol] = useState('');

  // Timeframe for watchlist bias calculations (drives TickerTable Select)
  const [tableTimeframe, setTableTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w' | '1M'>('1h');

  // Modal state for settings
  const [showSettings, setShowSettings] = useState(false);

  // Chart container ref
  const chartContainerRef = useRef<HTMLDivElement>(null);

  // ----- Handlers (non-inline) -----

  const handleAddTicker = useCallback(
    (ticker: string) => {
      watchlist.handleAddTicker(ticker, setSelectedSymbol);
    },
    [watchlist]
  );

  const handleRemoveTicker = useCallback(
    (ticker: string) => {
      watchlist.handleRemoveTicker(ticker, selectedSymbol, setSelectedSymbol);
    },
    [watchlist, selectedSymbol]
  );

  const handleSelectTicker = useCallback(
    (ticker: string) => {
      setSelectedSymbol(ticker);
    },
    []
  );

  const handleTimeframeChange = useCallback(
    (tf: string) => {
      const allowed = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'] as const;
      if (!allowed.includes(tf as any)) return;
      setTableTimeframe(tf as (typeof allowed)[number]);
    },
    []
  );

  const handleChangeStructurePivot = useCallback(
    (length: number) => {
      biasSettings.updateSettings({ structurePivotLength: length });
    },
    [biasSettings.updateSettings]
  );

  const handleChangeEmaLength = useCallback(
    (index: number, length: number) => {
      const newEmaLengths = [...biasSettings.settings.emaLengths];
      newEmaLengths[index] = length;
      biasSettings.updateSettings({ emaLengths: newEmaLengths });
    },
    [biasSettings.updateSettings, biasSettings.settings.emaLengths]
  );

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  const chartTimeframe = isFalconTicker(selectedSymbol)
    ? falconSafeTimeframe(tableTimeframe)
    : tableTimeframe;

  const handleExpandChart = useCallback(() => {
    onExpandChart?.({
      symbol: selectedSymbol,
      timeframe: chartTimeframe,
      watchlist: watchlist.watchlistTickers
    });
  }, [selectedSymbol, chartTimeframe, watchlist.watchlistTickers, onExpandChart]);

  useEffect(() => {
    onSelectionChange?.({
      symbol: selectedSymbol,
      timeframe: tableTimeframe,
      watchlist: watchlist.watchlistTickers,
    });
  }, [selectedSymbol, tableTimeframe, watchlist.watchlistTickers, onSelectionChange]);

  // ----- Render -----

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <TickerSearch
        onAddTicker={handleAddTicker}
        existingTickers={watchlist.watchlistTickers}
      />

      {/* Watchlist table + timeframe selector (inside TickerTable) */}
      <TickerTable
        tickers={watchlist.watchlistTickers}
        onRemoveTicker={handleRemoveTicker}
        onSelectTicker={handleSelectTicker}
        selectedTicker={selectedSymbol}
        timeframe={tableTimeframe}
        onTimeframeChange={handleTimeframeChange}
        structurePivotLength={biasSettings.settings.structurePivotLength}
        emaLengths={biasSettings.settings.emaLengths}
        onOpenSettings={handleOpenSettings}
        onBiasUpdate={onWatchlistBias}
      />

      {/* Chart Preview - only show when ticker selected and tickers exist */}
      {watchlist.watchlistTickers.length > 0 && selectedSymbol && (
        <div className="mt-4">
          <ChartPreview
            symbol={selectedSymbol}
            timeframe={chartTimeframe}
            onExpand={handleExpandChart}
            chartContainerRef={chartContainerRef}
          />
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={handleCloseSettings}
        >
          <div 
            className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl max-w-sm w-full p-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={handleCloseSettings}
              className="absolute top-3 right-3 text-slate-400 hover:text-white transition-colors"
              aria-label="Close settings"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Title */}
            <h3 className="text-lg font-semibold text-white mb-2">Bias Settings</h3>
            <p className="text-xs text-slate-400 mb-4">
              Configure EMA lengths and structure pivot for bias calculations. Settings are saved automatically.
            </p>

            {/* Settings panel */}
            <WatchlistSettingsPanel
              structurePivotLength={biasSettings.settings.structurePivotLength}
              emaLengths={biasSettings.settings.emaLengths}
              onChangeStructurePivot={handleChangeStructurePivot}
              onChangeEmaLength={handleChangeEmaLength}
            />
          </div>
        </div>
      )}
    </div>
  );
}
