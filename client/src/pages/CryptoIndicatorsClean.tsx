// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useCallback, useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ChevronDown } from 'lucide-react';
import { usePageViewTracking } from '@/hooks/useAnalytics';
import { VideoSequencePlayer } from '@/components/trading/VideoSequencePlayer';
import { CryptoNavigation } from '@/components/CryptoNavigation';
import bearTecLogoNew from '@assets/beartec logo_1763645889028.png';
import { CleanWatchlist } from '@/components/watchlist/CleanWatchlist';
import { IndicatorsSection } from '@/components/indicators/IndicatorsSection';
import { OSCILLATOR_OPTIONS } from '@/components/indicators/OscillatorsPanel';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Bias } from '@/types/candle';
import { useIndicatorsData } from '@/hooks/useIndicatorsData';
import { falconSafeTimeframe, isFalconTicker } from '@/lib/tickerUtils';
import { FalconChartStatusBanner } from '@/components/falcon/FalconChartStatusBanner';
import { useOscillatorPreferences, type OscillatorId, VALID_OSCILLATOR_IDS } from '@/hooks/useOscillatorPreferences';
import { Link, useLocation } from 'wouter';

const DEFAULT_TIMEFRAME = '1h';

export default function CryptoIndicatorsClean() {
  usePageViewTracking('Crypto Indicators');
  
  const [, navigate] = useLocation();
  // No default ticker — user picks from watchlist after adding
  const [selectedSymbol, setSelectedSymbol] = useState('');
  const [selectedTimeframe, setSelectedTimeframe] = useState(DEFAULT_TIMEFRAME);

  // Persistent oscillator preferences from DB
  const { favoriteOscillators, isLoading: prefsLoading, updatePreferences } = useOscillatorPreferences();

  // No oscillators on by default for new users; hydrate from saved prefs when available
  const [activeOscillators, setActiveOscillators] = useState<OscillatorId[]>([]);
  const [prefsInitialised, setPrefsInitialised] = useState(false);
  const [watchlistTickers, setWatchlistTickers] = useState<string[]>([]);

  // Hydrate local state from persisted prefs exactly once after they load
  useEffect(() => {
    if (!prefsLoading && !prefsInitialised) {
      // Empty array is valid — new users start with nothing selected
      setActiveOscillators(favoriteOscillators);
      setPrefsInitialised(true);
    }
  }, [prefsLoading, prefsInitialised, favoriteOscillators]);
  
  // Mascot follows watchlist majority (EMA + structure), not a demo timer
  const [targetMarketState, setTargetMarketState] = useState<'bullish' | 'bearish'>('bearish');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const handleWatchlistBias = useCallback((
    rows: Array<{ symbol: string; emaBias: Bias; structureBias: Bias }>,
  ) => {
    let bullVotes = 0;
    let bearVotes = 0;
    for (const row of rows) {
      if (row.emaBias === 'bullish') bullVotes += 1;
      else if (row.emaBias === 'bearish') bearVotes += 1;
      if (row.structureBias === 'bullish') bullVotes += 1;
      else if (row.structureBias === 'bearish') bearVotes += 1;
    }
    if (bearVotes > bullVotes) setTargetMarketState('bearish');
    else if (bullVotes > bearVotes) setTargetMarketState('bullish');
    if (isInitialLoad) setIsInitialLoad(false);
  }, [isInitialLoad]);

  const watchlistHasTickers = watchlistTickers.length > 0;

  // Fetch candle/CVD only when the watchlist has at least one ticker
  const { candles, cvdData, externalMetrics, candlesLoading, candlesError, falconMeta } = useIndicatorsData({
    symbol: watchlistHasTickers ? selectedSymbol : '',
    timeframe: selectedTimeframe,
  });

  const handleSelectionChange = useCallback((context: {
    symbol: string;
    timeframe: string;
    watchlist: string[];
  }) => {
    setSelectedSymbol(context.symbol);
    setSelectedTimeframe(
      isFalconTicker(context.symbol) ? falconSafeTimeframe(context.timeframe) : context.timeframe,
    );
    setWatchlistTickers(context.watchlist.filter(Boolean));
  }, []);

  // Handler to expand chart to fullscreen - navigate to chart page
  const handleExpandChart = useCallback((context: { 
    symbol: string; 
    timeframe: string; 
    watchlist: string[] 
  }) => {
    console.log('📊 Navigating to chart page with context:', context);
    
    // Save watchlist to localStorage so ChartPage can access it
    localStorage.setItem('watchlistTickers', JSON.stringify(context.watchlist));
    
    // Navigate to chart page with URL params (client-side navigation)
    navigate(`/chart?symbol=${context.symbol}&timeframe=${context.timeframe}`);
  }, [navigate]);

  const handleOscillatorToggle = useCallback((oscillatorId: string, checked: boolean) => {
    setActiveOscillators((previous) => {
      // Only allow known OscillatorId values through to keep types strict
      if (!VALID_OSCILLATOR_IDS.has(oscillatorId as OscillatorId)) return previous;
      const id = oscillatorId as OscillatorId;
      const next = checked
        ? previous.includes(id) ? previous : [...previous, id]
        : previous.filter((o) => o !== id);
      updatePreferences(next);
      return next;
    });
  }, [updatePreferences]);

  const oscillatorSummary =
    activeOscillators.length === 0
      ? 'No oscillators selected'
      : activeOscillators.length <= 2
        ? activeOscillators
            .map((id) => OSCILLATOR_OPTIONS.find((option) => option.id === id)?.label ?? id)
            .join(', ')
        : `${activeOscillators.length} oscillators selected`;

  return (
    <>
      <Helmet>
        <title>Crypto Indicators & Oscillators | BearTec</title>
        <meta name="description" content="Beginner-friendly crypto charts with multiple oscillators, indicators, and educational AI technical scenarios. Not financial advice." />
      </Helmet>

      {/* Main Content */}
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 text-white">
          
          {/* Container for all content */}
          <div className="max-w-7xl mx-auto px-4 py-6 pb-32">
            
            {/* Logo */}
            <div className="mb-8">
              <Link href="/cryptoindicators">
                <img 
                  src={bearTecLogoNew} 
                  alt="BearTec Logo" 
                  className="h-20 w-auto cursor-pointer"
                />
              </Link>
            </div>

            {/* Video Animation — silent watchlist-majority gimmick, no caption */}
            <div className="flex justify-center mb-12">
              <div className="relative" style={{ height: '240px', width: '100%', maxWidth: '800px' }}>
                <VideoSequencePlayer
                  targetMarketState={targetMarketState}
                  isInitialLoad={isInitialLoad}
                  onInitialComplete={() => setIsInitialLoad(false)}
                />
              </div>
            </div>

          {/* Watchlist Section */}
          <CleanWatchlist
            onExpandChart={handleExpandChart}
            onSelectionChange={handleSelectionChange}
            onWatchlistBias={handleWatchlistBias}
          />

          {/* Indicators Section (Oscillators + CVD) */}
          <div className="mb-4 flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="border-slate-700 bg-slate-900/80 text-slate-100 hover:bg-slate-800"
                >
                  Oscillators: {oscillatorSummary}
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                collisionPadding={12}
                className="w-64 max-h-[min(70dvh,var(--radix-dropdown-menu-content-available-height))] overflow-y-auto overscroll-contain border-slate-700 bg-slate-900 text-slate-100"
              >
                <DropdownMenuLabel>Toggle oscillator panels</DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-slate-700" />
                {OSCILLATOR_OPTIONS.map((oscillator) => (
                  <DropdownMenuCheckboxItem
                    key={oscillator.id}
                    checked={activeOscillators.includes(oscillator.id)}
                    onCheckedChange={(checked) => handleOscillatorToggle(oscillator.id, checked === true)}
                    className="focus:bg-slate-800"
                  >
                    {oscillator.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {watchlistHasTickers && isFalconTicker(selectedSymbol) && (
            <FalconChartStatusBanner
              className="mb-2"
              pair={selectedSymbol}
              candleCount={candles.length}
              isLoading={candlesLoading}
              error={candlesError}
              meta={falconMeta}
            />
          )}

          <IndicatorsSection
            candles={candles}
            cvdData={cvdData}
            externalMetrics={externalMetrics}
            symbol={selectedSymbol}
            timeframe={selectedTimeframe}
            showPatternBacktest={false}
            activeOscillators={activeOscillators}
            onActiveOscillatorsChange={(oscillators) => {
              setActiveOscillators(
                oscillators.filter((id): id is OscillatorId =>
                  VALID_OSCILLATOR_IDS.has(id as OscillatorId),
                ),
              );
            }}
            watchlistHasTickers={watchlistHasTickers}
          />
          </div>

          {/* Bottom Navigation */}
          <CryptoNavigation />
        </div>
    </>
  );
}
