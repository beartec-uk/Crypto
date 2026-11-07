// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { WATCHLIST_TAP_HINT } from '@/lib/watchlistHints';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { calculateEMABias } from '@/utils/emaBias';
import { detectStructure } from '@/utils/structureDetection';
import { BiasBadge } from '@/components/BiasBadge';
import { convertTimeframe } from '@/lib/utils/binance';
import { formatTickerDisplay } from '@/lib/chart/priceUtils';
import { falconSafeTimeframe, isFalconTicker } from '@/lib/tickerUtils';
import type { Bias } from '@/types/candle';

interface TickerData {
  symbol: string;
  price: number;
  priceChange: number;
  emaBias: Bias;
  structureBias: Bias;
}


function candleTimeSec(time: number): number {
  return time > 1e12 ? time / 1000 : time;
}

function parseFalconWatchlistCandles(raw: any[]) {
  return raw.map((c) => ({
    time: Number(c.time),
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    volume: Number(c.volume ?? 0),
  })).filter((c) => Number.isFinite(c.close));
}

function falconChangePercent(parsed: Array<{ time: number; close: number }>): number {
  if (parsed.length < 2) return 0;
  const last = parsed[parsed.length - 1];
  const cutoff = candleTimeSec(last.time) - 24 * 3600;
  let ref = parsed[0];
  for (const candle of parsed) {
    if (candleTimeSec(candle.time) <= cutoff) ref = candle;
    else break;
  }
  if (!ref.close) return 0;
  return ((last.close - ref.close) / ref.close) * 100;
}

async function fetchFalconWatchlistRow(
  ticker: string,
  timeframe: string,
  structurePivotLength?: number,
): Promise<TickerData> {
  const tf = falconSafeTimeframe(timeframe);
  const candleResponse = await fetch(
    `/api/crypto/falcon/candles?pair=${encodeURIComponent(ticker)}&timeframe=${encodeURIComponent(tf)}&limit=1000`,
  );
  if (!candleResponse.ok) {
    throw new Error(`Falcon candles ${candleResponse.status}`);
  }
  const payload = await candleResponse.json();
  const parsed = parseFalconWatchlistCandles(Array.isArray(payload.candles) ? payload.candles : []);
  if (parsed.length === 0) {
    return {
      symbol: ticker,
      price: 0,
      priceChange: 0,
      emaBias: 'neutral',
      structureBias: 'neutral',
    };
  }
  const last = parsed[parsed.length - 1];
  return {
    symbol: ticker,
    price: last.close,
    priceChange: falconChangePercent(parsed),
    emaBias: calculateEMABias(parsed),
    structureBias: detectStructure(parsed, structurePivotLength || 5),
  };
}

interface TickerTableProps {
  tickers: string[];
  onRemoveTicker: (symbol: string) => void;
  onSelectTicker: (symbol: string) => void;
  selectedTicker: string;
  timeframe: string;
  onTimeframeChange: (timeframe: string) => void;

  // Bias configuration (UI exists, calculation implementation pending)
  // These values are persisted but not yet applied to calculations
  structurePivotLength?: number;
  emaLengths?: number[]; // e.g. [21, 50, 200]
  
  // Settings button handler
  onOpenSettings?: () => void;
  /** Fired whenever EMA/structure rows refresh so the page mascot can follow majority bias. */
  onBiasUpdate?: (rows: Array<{ symbol: string; emaBias: Bias; structureBias: Bias }>) => void;
}

/**
 * Watchlist table component showing ticker data
 * Columns: Ticker, Price, % Change, EMA Bias, Structure Bias, Remove
 */
export function TickerTable({
  tickers,
  onRemoveTicker,
  onSelectTicker,
  selectedTicker,
  timeframe,
  onTimeframeChange,
  structurePivotLength, // NEW
  emaLengths,           // NEW
  onOpenSettings,       // NEW
  onBiasUpdate,
}: TickerTableProps) {
  const [tickerData, setTickerData] = useState<Record<string, TickerData>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Fetch real prices and calculate EMA/Structure
  useEffect(() => {
    if (tickers.length === 0) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Binance 24hr stats — optional so Falcon-only rows still load if this fails
        let priceData: any[] = [];
        try {
          const priceResponse = await fetch('https://api.binance.com/api/v3/ticker/24hr');
          const parsed = await priceResponse.json();
          if (Array.isArray(parsed)) priceData = parsed;
        } catch (err) {
          console.error('Failed to fetch Binance 24hr tickers:', err);
        }

        const newTickerData: Record<string, TickerData> = {};
        const binanceTimeframe = convertTimeframe(timeframe);

        // Fetch candle data for each ticker
        for (const ticker of tickers) {
          if (isFalconTicker(ticker)) {
            try {
              newTickerData[ticker] = await fetchFalconWatchlistRow(
                ticker,
                timeframe,
                structurePivotLength,
              );
            } catch (err) {
              console.error(`Failed to fetch Falcon data for ${ticker}:`, err);
              newTickerData[ticker] = {
                symbol: ticker,
                price: 0,
                priceChange: 0,
                emaBias: 'neutral',
                structureBias: 'neutral',
              };
            }
            continue;
          }

          const tickerInfo = priceData.find((t: any) => t.symbol === ticker);
          
          if (tickerInfo) {
            try {
              // Fetch last 500 candles for EMA and structure calculation
              const candleResponse = await fetch(
                `https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=${binanceTimeframe}&limit=500`
              );
              const candles = await candleResponse.json();
              console.log(`📊 Fetched ${candles.length} candles for ${ticker} on ${binanceTimeframe}`);
              
              // Parse candles
              const parsedCandles = candles.map((c: any) => ({
                time: c[0],
                open: parseFloat(c[1]),
                high: parseFloat(c[2]),
                low: parseFloat(c[3]),
                close: parseFloat(c[4]),
                volume: parseFloat(c[5]),
              }));
              
              // Calculate EMA bias using utility
              // TODO: calculateEMABias currently uses fixed EMA lengths (20,50,100); emaLengths parameter not yet implemented
              const emaBias = calculateEMABias(parsedCandles);
              
              // Detect structure using utility with configurable lookback
              const structureBias = detectStructure(parsedCandles, structurePivotLength || 5);
              
              newTickerData[ticker] = {
                symbol: ticker,
                price: parseFloat(tickerInfo.lastPrice),
                priceChange: parseFloat(tickerInfo.priceChangePercent),
                emaBias,
                structureBias,
              };
            } catch (err) {
              console.error(`Failed to fetch candles for ${ticker}:`, err);
              // Fallback to just price data
              newTickerData[ticker] = {
                symbol: ticker,
                price: parseFloat(tickerInfo.lastPrice),
                priceChange: parseFloat(tickerInfo.priceChangePercent),
                emaBias: 'neutral',
                structureBias: 'neutral',
              };
            }
          }
        }

        setTickerData(newTickerData);
        onBiasUpdate?.(
          Object.values(newTickerData).map((row) => ({
            symbol: row.symbol,
            emaBias: row.emaBias,
            structureBias: row.structureBias,
          })),
        );
        console.log('✅ Loaded ticker data:', Object.keys(newTickerData).length, 'tickers');
      } catch (error) {
        console.error('Failed to fetch ticker data:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch real-time data',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    // Fetch immediately
    fetchData();

    // Update every 10 seconds
    const interval = setInterval(fetchData, 10000);

    return () => clearInterval(interval);
  }, [
    tickers,
    timeframe,
    toast,
    structurePivotLength,
    emaLengths,
    onBiasUpdate,
  ]);

  const formatPrice = (price: number) => {
    if (price === 0) return '-';
    return price < 1 ? price.toFixed(6) : price.toFixed(2);
  };

  const formatChange = (change: number) => {
    const sign = change > 0 ? '+' : '';
    const color = change > 0 ? 'text-green-500' : change < 0 ? 'text-red-500' : 'text-gray-500';
    return <span className={color}>{sign}{change.toFixed(2)}%</span>;
  };

  const formatWatchlistPrice = (ticker: string, data?: TickerData) => {
    if (!data) return '-';
    const formatted = formatPrice(data.price);
    if (formatted === '-') return '-';
    return isFalconTicker(ticker) ? `${formatted} FPL` : `$${formatted}`;
  };

  return (
    <div className="w-full space-y-3">
      {/* Header with timeframe selector and settings button */}
      <div className="flex items-center justify-between bg-slate-900 p-3 rounded-lg">
        <h3 className="text-lg font-semibold text-white">WATCHLIST</h3>
        <div className="flex items-center gap-2">
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-slate-900/80 border border-slate-600 rounded-md hover:bg-slate-800 transition-colors text-slate-300 hover:text-white"
              title="Configure bias settings"
            >
              <Settings2 className="h-3 w-3" />
              <span className="hidden sm:inline">Bias</span>
            </button>
          )}
          <span className="text-sm text-white hidden sm:inline">Timeframe:</span>
          <Select value={timeframe} onValueChange={onTimeframeChange}>
            <SelectTrigger className="w-20 sm:w-24 bg-slate-800 text-white border-slate-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m">1m</SelectItem>
              <SelectItem value="5m">5m</SelectItem>
              <SelectItem value="15m">15m</SelectItem>
              <SelectItem value="1h">1H</SelectItem>
              <SelectItem value="4h">4H</SelectItem>
              <SelectItem value="1d">1D</SelectItem>
              <SelectItem value="1w">1W</SelectItem>
              <SelectItem value="1M">1M</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Table */}
      <div className="border border-slate-700 rounded-lg overflow-x-auto bg-slate-900">
        <table className="w-full table-auto min-w-[600px]">
          <thead className="bg-slate-800">
            <tr>
              <th className="px-1 sm:px-2 py-2 text-left text-xs sm:text-sm font-medium text-gray-300 w-[120px]">Ticker</th>
              <th className="px-1 sm:px-2 py-2 text-right text-xs sm:text-sm font-medium text-gray-300 w-[100px]">Price</th>
              <th className="px-1 sm:px-2 py-2 text-right text-xs sm:text-sm font-medium text-gray-300 w-[80px]">% Chg</th>
              <th className="px-1 sm:px-2 py-2 text-center text-xs sm:text-sm font-medium text-gray-300 w-[90px]">EMA</th>
              <th className="px-1 sm:px-2 py-2 text-center text-xs sm:text-sm font-medium text-gray-300 w-[90px]">Structure</th>
              <th className="px-1 sm:px-2 py-2 text-center text-xs sm:text-sm font-medium text-gray-300 w-[60px]"></th>
            </tr>
          </thead>
          <tbody>
            {tickers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No tickers in watchlist. Use the search above to add some.
                </td>
              </tr>
            ) : loading && Object.keys(tickerData).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  Loading...
                </td>
              </tr>
            ) : (
              tickers.map((ticker) => {
                const data = tickerData[ticker];
                const isSelected = ticker === selectedTicker;
                
                return (
                  <tr
                    key={ticker}
                    className={`border-t border-slate-700 hover:bg-slate-800 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-400 ${
                      isSelected ? 'bg-sky-950/60 shadow-[inset_3px_0_0_0_rgb(56,189,248)]' : ''
                    }`}
                    onClick={() => onSelectTicker(ticker)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectTicker(ticker);
                      }
                    }}
                    tabIndex={0}
                    aria-current={isSelected ? 'true' : undefined}
                    aria-label={`Select ${formatTickerDisplay(ticker)} to load its chart and indicators`}
                    data-selected={isSelected ? 'true' : undefined}
                  >
                    <td className={`px-1 sm:px-2 py-3 font-medium text-xs sm:text-sm w-[120px] ${isSelected ? 'text-sky-300' : 'text-white'}`}>
                      {formatTickerDisplay(ticker)}
                    </td>
                    <td className="px-1 sm:px-2 py-3 text-right font-mono text-gray-300 text-xs sm:text-sm w-[100px]">
                      {formatWatchlistPrice(ticker, data)}
                    </td>
                    <td className="px-1 sm:px-2 py-3 text-right font-mono text-xs sm:text-sm w-[80px]">
                      {data ? formatChange(data.priceChange) : '-'}
                    </td>
                    <td className="px-1 sm:px-2 py-3 w-[90px]">
                      {data && <BiasBadge bias={data.emaBias} />}
                    </td>
                    <td className="px-1 sm:px-2 py-3 w-[90px]">
                      {data && <BiasBadge bias={data.structureBias} />}
                    </td>
                    <td className="px-1 sm:px-2 py-3 text-center w-[60px]">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveTicker(ticker);
                        }}
                        className="h-6 w-6 sm:h-8 sm:w-8 p-0 hover:bg-red-500/20 hover:text-red-400"
                      >
                        <X className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {tickers.length > 0 && (
        <p className="mt-2 text-xs sm:text-sm text-slate-400" data-testid="watchlist-tap-hint">
          👆 {WATCHLIST_TAP_HINT}
        </p>
      )}
    </div>
  );
}
