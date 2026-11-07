// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
/**
 * ⛔️ DO NOT USE THIS FILE - DEPRECATED ⛔️
 * 
 * This file is OBSOLETE and should NOT be modified.
 * 
 * Use client/src/pages/ChartFullscreenPage.tsx instead.
 * 
 * CryptoIndicators.tsx has been replaced by:
 * - CryptoIndicatorsClean.tsx (main page)
 * - ChartFullscreenPage.tsx (fullscreen mode)
 * 
 * ANY CHANGES TO THIS FILE WILL BE IGNORED.
 * 
 * ⛔️ DO NOT USE THIS FILE - DEPRECATED ⛔️
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { createChart, ColorType, CrosshairMode, IChartApi, CandlestickSeries, LineSeries, HistogramSeries, ISeriesApi, createSeriesMarkers, ISeriesMarkersPluginApi, LineWidth, Time } from 'lightweight-charts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TrendingUp, TrendingDown, Activity, DollarSign, Loader2, Bell, ChevronDown, ChevronUp, Zap, Save, Settings, MessageSquare, Maximize2, Minimize2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useCryptoAuth } from '@/hooks/useCryptoAuth';
import { isOwnerOnlyEmail } from '@/constants/ownerOnlyFeatures';
import { authenticatedApiRequest } from '@/lib/apiAuth';
import { useLocation } from 'wouter';
import { useChartGestures, type GesturePoint } from '@/hooks/useChartGestures';
import { useChartData } from '@/hooks/useChartData';
import { useWebSocketConnection } from '@/hooks/useWebSocketConnection';
import { useWatchlistState } from '@/hooks/useWatchlistState';
import { useIndicatorState } from '@/hooks/useIndicatorState';
import { useDrawingState } from '@/hooks/useDrawingState';
import { useFullscreen } from '@/hooks/useFullscreen';
import bearTecLogo from '@assets/1_20251120_023939_0000_1763606422703.png';
import bearTecLogoNew from '@assets/beartec logo_1763645889028.png';
import grokLogo from '@assets/Grok_Full_Logomark_Light_1763287603908.png';
import aiButtonVideo from '@assets/grok_video_2025-11-20-02-22-16_1763605488674.mp4';
import { AlertSettingsDialog } from '@/components/AlertSettingsDialog';
import { incrementTickerClick, falconSafeTimeframe, isFalconCandleTimeframe, isFalconTicker } from '@/lib/tickerUtils';
import { FalconChartStatusBanner } from '@/components/falcon/FalconChartStatusBanner';
import { useCandleData } from '@/hooks/useCandleData';
import { TickerSearch } from '@/components/TickerSearch';
import { TickerTable } from '@/components/TickerTable';
import { CryptoNavigation } from '@/components/CryptoNavigation';
import { usePageViewTracking } from '@/hooks/useAnalytics';
import { DrawingSettingsPanel } from '@/components/drawing-settings';
import { FullscreenOscillatorPanel } from '@/components/FullscreenOscillatorPanel';
import { OscillatorContainer } from '@/components/indicators/OscillatorContainer';

// Chart Components
import { 
  ChartContainer, 
  MovingAverages, 
  ChartControls, 
  ChartVisibleRange, 
  ChartTimeTooltip,
  ChartControlBar
} from '@/components/chart';

// SMC Components
import { 
  FVGOverlay, 
  OrderBlockOverlay, 
  BOSCHoCHMarkers, 
  SMCControls 
} from '@/components/smc';

// Drawing Components
import { 
  DrawingManager, 
  DrawingRenderer 
} from '@/components/drawings';

// Trend Indicator Overlays
import { 
  SupertrendOverlay, 
  BollingerBandsOverlay, 
  VWAPOverlay, 
  SessionVWAPOverlay, 
  ParabolicSAROverlay 
} from '@/components/indicators/trend';

// Trading Components
import {
  AlertsPanel,
  ReplayModeControls,
  VideoSequencePlayer,
  ActionButtonsToolbar,
  ExchangeStatusPopover
} from '@/components/trading';

// AI Components
import {
  GrokPanel,
  GrokInsights,
  MarketReviewButton,
  MarketSummaryCard
} from '@/components/ai';

// Watchlist Components
import { WatchlistPanel } from '@/components/watchlist';

// Settings Components
import { SettingsPanel, SettingsDialog } from '@/components/settings';
import { ConfirmationDialog } from '@/components/modals';
import { DrawingAlertSettings } from '@/components/modals/DrawingAlertSettings';
import { useModalManager } from '@/hooks/useModalManager';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useModalState } from '@/hooks/useModalState';
import { getAlertPrefix } from '@/utils/drawingAlerts';
import { 
  useReplayMode, 
  useChartSettings, 
  useDrawingsPersistence, 
  useSettingsPersistence,
  useCVDSettings,
  useChartControls,
  useAIAnalysis,
  useIndicatorCalculations,
  usePanelState
} from '@/hooks';

// Volume Components
import { CVDTable } from '@/components/indicators/volume';
import { CVDDetailsPanel } from '@/components/volume';

// Alert Components
import { MarketAlertsPanel } from '@/components/alerts';

// Common Components
import { LoadingOverlay, ErrorDisplay } from '@/components/common';

// Elliott Wave Components
import { useElliottWave } from '@/hooks/usePredictiveElliottWave';

// Data utilities
import { binanceToCandleData, removeUSDTSuffix, formatMultiExchangeSymbol } from '@/lib/data/candleTransforms';

import {
  calculateSupertrend,
  calculateVWAPBands,
  calculateOrderBlocks,
  calculateStochasticRSI,
  calculateWilliamsR,
  calculateCCI,
  calculateADX,
  calculateSMA,
  SupertrendValue,
  BandValue,
  IndicatorValue
} from '@/lib/indicators';
import {
  createDrawingPrimitive,
  DrawingPrimitive,
  TrendLinePrimitive,
  HorizontalLinePrimitive,
  RectanglePrimitive,
  FibRetracementPrimitive,
  ChannelPrimitive
} from '@/lib/chartPrimitives';
import { touchesZone, inZone, aboveZone, belowZone, priceInZone } from '@/utils/zoneHelpers';

// Indicator calculation utilities
import { calculateRSI, calculateMACD, calculateEMA } from '@/lib/indicators/momentum';
import { calculateOBV, calculateMFI } from '@/lib/indicators/volume';
import { calculateBollingerBands } from '@/lib/indicators/volatility';
import { calculateATR } from '@/lib/indicators/trend';
import { buildIndicatorCoach } from '@/lib/indicators/indicatorCoach';

// SMC utilities
import { isActiveFVG } from '@/lib/smc/fvg';
import { calculateSwings } from '@/lib/smc/pivots';
import { detectTrendlines, Trendline } from '@/lib/smc/trendlineDetector';

// Market structure utilities (for market alerts and visualization)
import {
  calculateBOSandCHoCH,
} from '@/lib/strategies';

// Calculation utilities
import {
  // Divergence
  detectDivergence,
  getOscillatorDivergence,
  detectDivergences,
  // Pivots
  findStopLossLevel,
  findNextSwingLevels,
  findPreviousSwingLevels,
  // VWAP
  calculateRollingVWAP,
  calculatePeriodicVWAP,
  getClosestVWAP as getClosestVWAPHelper,
  // FVG
  analyzeFVGValue,
  calculateFVGs,
  getFVGFillTime,
  // Market Analysis
  getCurrentATR,
  determineBias as determineBiasCalc,
  determineStructureTrend as determineStructureTrendCalc,
  checkTrendFilter as checkTrendFilterCalc,
  checkDirectionFilter as checkDirectionFilterCalc,
} from '@/lib/calculations';

// Chart utilities  
import { formatPrice, formatVolume, formatPercentChange } from '@/lib/chart/priceUtils';
import { getBullBearColor, getIndicatorColor, getZoneColor } from '@/lib/chart/styleUtils';

// Type imports
import type { 
  CandleData, 
  VWAPData, 
  MAConfig 
} from '@/types/chart.types';

import type { 
  FVG, 
  BOS, 
  CHoCH,
  FootprintData
} from '@/types/smc.types';

import type { 
  DrawingTool 
} from '@/types/drawings.types';

import type { 
  MarketAlert,
} from '@/types/trading.types';

// Utility imports
import { 
  generateFutureWhitespace, 
  getFutureBarCount,
  getInitialVisibleFutureBarCount,
  getTableRowLimit,
  generateRangeValues,
  FUTURE_BAR_COUNT,
  formatTimestamp,
  formatTimeOnly,
  formatDateOnly
} from '@/lib/chart/timeUtils';

import { 
  formatMALabel,
  formatTickerDisplay
} from '@/lib/chart/priceUtils';

import { 
  getAutoColor 
} from '@/lib/chart/colorUtils';

import { 
  findPeaksAndTroughs 
} from '@/lib/smc/pivots';



const MA_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
const MA_TIMEFRAMES = [
  { value: 'current', label: 'Current' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
];

export default function CryptoIndicators() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const seriesMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fetchGenerationRef = useRef(0); // Track latest fetch to prevent stale updates
  const abortControllerRef = useRef<AbortController | null>(null); // Cancel pending requests
  const { toast } = useToast();

  const { isAuthenticated, isLoading: authLoading, getToken, user } = useCryptoAuth();
  const showOwnerOnlyTools = isOwnerOnlyEmail(user?.email);
  
  usePageViewTracking('crypto-indicators');
  const [, setLocation] = useLocation();
  
  // Stable user ID for storage keys - prevents re-loading on user object reference changes
  const userId = user?.id || 'anonymous';

  const { data: subscription } = useQuery<{tier: string, aiCreditsRemaining?: number}>({
    queryKey: ['/api/crypto/my-subscription'],
    enabled: isAuthenticated && !authLoading
  });
  const tier = subscription?.tier || 'free';
  const isPaidTier = true;
  
  // Memoized tier check to prevent infinite loops
  const hasMinimalTier = useMemo(() => {
    const requiredTier = 'elite'; // This component requires elite tier
    const currentTier = (user?.publicMetadata?.subscriptionTier as string)?.toLowerCase() || 'free';
    
    const tierHierarchy: Record<string, number> = {
      'free': 0,
      'basic': 1,
      'professional': 2,
      'elite': 3
    };
    
    const currentLevel = tierHierarchy[currentTier] || 0;
    const requiredLevel = tierHierarchy[requiredTier] || 0;
    
    return currentLevel >= requiredLevel;
  }, [user?.publicMetadata?.subscriptionTier]);
  
  // Free tier oscillators: only RSI and MACD, max 1 active at a time
  const FREE_OSCILLATORS = ['RSI', 'MACD'];
  const MAX_FREE_OSCILLATORS = 1;

  const [symbol, setSymbol] = useState('XRPUSDT');
  const [interval, setTimeframeInterval] = useState(() => {
    // Load saved default timeframe for the initial symbol
    const savedTimeframe = localStorage.getItem('defaultTimeframe_XRPUSDT');
    return savedTimeframe || '15m';
  });
  // TODO: Period state for ChartControlBar - implement period-based data fetching
  // This will control how much historical data to display (24h, 7d, 30d, 90d)
  const [period, setPeriod] = useState('30d');
  
  // Consolidated modal state management
  const modals = useModalState();
  
  const [apiKeys, setApiKeys] = useState({
    binance: localStorage.getItem('binance_api_key') || '',
    coinbase: localStorage.getItem('coinbase_api_key') || '',
    xai: localStorage.getItem('xai_api_key') || ''
  });
  
  // Multi-exchange orderflow state (needed by chart data hook)
  const [useMultiExchange, setUseMultiExchange] = useState(true);
  
  // Chart data hook - manages candle data and orderflow
  const {
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
  } = useChartData({ symbol, interval, useMultiExchange });
  
  // Watchlist hook - manages watchlist state and persistence
  const {
    watchlistTickers,
    setWatchlistTickers,
    handleAddTicker: handleAddTickerBase,
    handleRemoveTicker: handleRemoveTickerBase,
    refetchWatchlist
  } = useWatchlistState();
  
  // Wrap handlers to include symbol change logic
const handleAddTicker = useCallback((ticker: string) => {
  handleAddTickerBase(ticker, setSymbol);
}, [handleAddTickerBase]);

const handleRemoveTicker = useCallback((ticker: string) => {
  handleRemoveTickerBase(ticker, symbol, setSymbol);
}, [handleRemoveTickerBase, symbol]);

// Handler for selecting a ticker from the table
const handleSelectTicker = useCallback((ticker: string) => {
  setSymbol(ticker);
  incrementTickerClick(ticker);
}, []);

// Indicator hook - manages all indicator state
const indicators = useIndicatorState();

// CVD Settings hook - manages CVD spike level state
const cvdSettings = useCVDSettings();

// Chart Controls hook - manages chart UI state
const chartControls = useChartControls();

// AI Analysis hook - manages AI market analysis state
const aiAnalysisState = useAIAnalysis();

// Panel State hook - manages collapsible panel states
const panels = usePanelState();

// Local state for WebSocket delta tracking (not persisted)
const [currentDelta, setCurrentDelta] = useState(0);

// Track previous symbol to clear HTF caches on symbol change
const prevSymbolRef = useRef(symbol);

// Video sequence state - targetMarketState is used by VideoSequencePlayer
const [targetMarketState, setTargetMarketState] = useState<'bullish' | 'bearish'>('bearish');
const [isInitialLoad, setIsInitialLoad] = useState(true);

const aiReviewMutation = useMutation({
  mutationFn: async () => {
    const response = await apiRequest('POST', '/api/crypto/ai-market-review', {
      candles: candles,
      currentPrice: candles[candles.length - 1]?.close
    });
    return await response.json();
  },
  onSuccess: (data) => {
    toast({
      title: 'AI Market Review',
      description: data.analysis,
      duration: 10000
    });
  },
  onError: () => {
    toast({
      title: 'Error',
      description: 'Failed to get AI analysis. Please upgrade to Beginner tier.',
      variant: 'destructive'
    });
  }
});

const handleAIMarketReview = () => {
  aiReviewMutation.mutate();
};

  // Drawing tools state
  type DrawingTool = 'trendline' | 'horizontal' | 'rectangle' | 'fib_retracement' | 'trend_fib' | 'channel' | 'elliott_wave' | null;
  const { isFullscreen, setIsFullscreen } = useFullscreen(); // Fullscreen chart mode with keyboard support
  const [activeTool, setActiveTool] = useState<DrawingTool>(null);
  const [showToolPicker, setShowToolPicker] = useState(false);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [drawingsVisible, setDrawingsVisible] = useState(true); // Toggle to hide/show all drawings
  const [tempDrawing, setTempDrawing] = useState<{points: {time: number; price: number; snapType?: 'high' | 'low' | 'none'}[]} | null>(null);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [alertSettingsOpen, setAlertSettingsOpen] = useState(false);
  
  // Drawings persistence hook - replaces inline mutations
  const drawingsPersistence = useDrawingsPersistence(symbol, interval);
  
  // Elliott Wave predictive tool
  const elliottWave = useElliottWave();
  
  // ChartControlBar state
  const [chartPeriod, setChartPeriod] = useState('24h');
  const [autoScroll, setAutoScroll] = useState(false);

  const [tableTimeframe, setTableTimeframe] = useState('1h');
    // Independent fullscreen chart state
  const [fullscreenSymbol, setFullscreenSymbol] = useState(symbol);
  const [fullscreenInterval, setFullscreenInterval] = useState(interval);
  // Falcon (testnet 2300) status only: note / empty reason / time quality for the banner.
  const falconStatusSymbol = isFullscreen ? fullscreenSymbol : symbol;
  const falconStatusTf = falconSafeTimeframe(isFullscreen ? fullscreenInterval : interval);
  const falconStatus = useCandleData({
    symbol: falconStatusSymbol,
    timeframe: falconStatusTf,
    enabled: isFalconTicker(falconStatusSymbol),
    refreshInterval: 15000,
  });
  const [fullscreenCandles, setFullscreenCandles] = useState<CandleData[]>([]);
  
  // Native primitives for high-performance drawing rendering
  const drawingPrimitivesRef = useRef<Map<string, DrawingPrimitive>>(new Map());
  
  // Modal manager for confirmation dialogs
  const modalManager = useModalManager();
  
  // Keyboard shortcuts
  useKeyboardShortcuts({
    onToggleDrawingMode: () => chartControls.setDrawingMode(chartControls.drawingMode === 'draw' ? 'off' : 'draw'),
    onTurnOffDrawing: () => {
      chartControls.setDrawingMode('off');
      setActiveTool(null);
      setShowToolPicker(false);
    },
    onSelectTool: (tool) => {
      setActiveTool(tool as any);
      chartControls.setDrawingMode('draw');
    },
    onToggleFullscreen: () => setIsFullscreen(prev => !prev),
    onOpenSettings: () => modals.openModal('settings-dialog'),
    onDeleteSelected: () => {
      if (selectedDrawingId) {
        modalManager.openModal('delete-drawing', { id: selectedDrawingId });
      }
    },
    onDeselectAll: () => setSelectedDrawingId(null),
  });
  const [editFibMode, setEditFibMode] = useState<'none' | 'values' | 'labels'>('none');
  const [crosshairModeActive, setCrosshairModeActive] = useState(false);
  const [autoSnapEnabled, setAutoSnapEnabled] = useState(true);
  const [autoColorEnabled, setAutoColorEnabled] = useState(true);
  
  // Point editing state - when a point is picked, it's visually removed and must be replaced
  const [activeEdit, setActiveEdit] = useState<{
    drawingId: string;
    pointIndex: number;
    originalDrawing: any;
  } | null>(null);
  const activeEditRef = useRef<typeof activeEdit>(null);
  const updateDrawingMutationRef = useRef<{ mutate: (data: { id: string; style?: any; coordinates?: any }) => void } | null>(null);
  const candlesRef = useRef<CandleData[]>([]);
  
  // Ref for tracking active tool in callbacks
  const activeToolRef = useRef(activeTool);
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);
  
  // Ref for tracking auto-color setting in callbacks
  const autoColorEnabledRef = useRef(autoColorEnabled);
  useEffect(() => {
    autoColorEnabledRef.current = autoColorEnabled;
  }, [autoColorEnabled]);
  
  // Keep activeEdit ref in sync
  useEffect(() => {
    activeEditRef.current = activeEdit;
  }, [activeEdit]);
  
  // Keep candles ref in sync for callbacks
  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  // Resize chart when oscillator panel visibility changes in fullscreen.
  // Only resize dimensions — do NOT call fitContent() here to avoid resetting user zoom.
  useEffect(() => {
    if (isFullscreen && chartRef.current && chartContainerRef.current) {
      const resizeTimeout = setTimeout(() => {
        if (chartRef.current && chartContainerRef.current) {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight
          });
        }
      }, 100);
      
      return () => clearTimeout(resizeTimeout);
    }
  }, [panels.oscillatorPanel, isFullscreen]);

  // Force resize when entering/exiting fullscreen.
  // fitContent() is intentionally called here on entry so the initial view is correct.
  useEffect(() => {
    if (chartRef.current && chartContainerRef.current) {
      const resizeTimeout = setTimeout(() => {
        if (chartRef.current && chartContainerRef.current) {
          const rect = chartContainerRef.current.getBoundingClientRect();
          chartRef.current.applyOptions({
            width: rect.width,
            height: rect.height,
          });
          if (isFullscreen) {
            chartRef.current.timeScale().fitContent();
          }
        }
      }, 200);
      
      return () => clearTimeout(resizeTimeout);
    }
  }, [isFullscreen]);

  // Sync fullscreen chart state when entering fullscreen
  useEffect(() => {
    if (isFullscreen) {
      setFullscreenSymbol(symbol);
      setFullscreenInterval(interval);
      setFullscreenCandles([...candles]);
      console.log('📺 Entered fullscreen - synced state');
    }
  }, [isFullscreen, symbol, interval, candles]);
    
  // Cooldown ref to prevent immediate placement after pickup (1 second delay)
  const pointPickupTimeRef = useRef<number>(0);
  const EDIT_PLACEMENT_COOLDOWN_MS = 1000;
  
  // Handler to pick up a point (first click on green circle) - removes point visually
  const handlePointPick = useCallback((drawingId: string, pointIndex: number, e: React.MouseEvent | React.TouchEvent) => {
    console.log('🎯 Point picked up (will be removed until replaced):', { drawingId, pointIndex });
    e.preventDefault();
    e.stopPropagation();
    
    // Record pickup time for cooldown
    pointPickupTimeRef.current = Date.now();
    
    // Find the drawing
    const drawing = drawings.find(d => d.id === drawingId);
    if (!drawing) return;
    
    // Store the edit state with original drawing
    setActiveEdit({
      drawingId,
      pointIndex,
      originalDrawing: { ...drawing, points: [...drawing.points] }
    });
    
    // Keep the drawing selected
    setSelectedDrawingId(drawingId);
  }, [drawings]);
  
  // Ref for gesture controller's findSnapPoint function
  const findSnapPointRef = useRef<((clientX: number, clientY: number) => { time: any; price: number; snapType?: 'high' | 'low' | 'none' } | null) | null>(null);
  
  // Handler to place the edited point (next click on chart)
  const handleEditPointPlace = useCallback((clientX: number, clientY: number) => {
    console.log('🎯 Placing edited point:', { clientX, clientY, activeEdit: activeEditRef.current });
    const edit = activeEditRef.current;
    if (!edit) return;
    
    // Check cooldown - prevent placement within 1 second of pickup
    const timeSincePickup = Date.now() - pointPickupTimeRef.current;
    if (timeSincePickup < EDIT_PLACEMENT_COOLDOWN_MS) {
      console.log('🎯 Placement blocked - cooldown active:', { timeSincePickup, required: EDIT_PLACEMENT_COOLDOWN_MS });
      return;
    }
    
    if (!chartRef.current || !candleSeriesRef.current || !chartContainerRef.current) {
      setActiveEdit(null);
      return;
    }
    
    // Skip gesture controller snap during edit - use free placement instead
    // The gesture snap restricts to candle high/low, but during edit we want free Y placement
    
    // Fallback: manual coordinate conversion if no snap found
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const container = chartContainerRef.current;
    const rect = container.getBoundingClientRect();
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const logicalX = chart.timeScale().coordinateToLogical(x);
    if (logicalX === null) {
      setActiveEdit(null);
      return;
    }
    
    const candleIndex = Math.round(logicalX);
    const allCandles = candlesRef.current;
    
    let price = candleSeries.coordinateToPrice(y);
    if (price === null) {
      setActiveEdit(null);
      return;
    }
    
    let finalTime: number;
    let snapType: 'high' | 'low' | 'none' = 'none';
    
    // During edit mode: snap time to candle, but keep free Y placement (no price snap)
    // This allows users to place points anywhere on the Y axis
    if (candleIndex >= allCandles.length) {
      const lastCandle = allCandles[allCandles.length - 1];
      const secondLastCandle = allCandles.length > 1 ? allCandles[allCandles.length - 2] : null;
      const timeInterval = secondLastCandle ? (lastCandle.time - secondLastCandle.time) : 3600;
      const barsAhead = candleIndex - (allCandles.length - 1);
      finalTime = (lastCandle.time as number) + (barsAhead * (timeInterval as number));
      // Free Y placement - no price snapping in edit mode
    } else if (candleIndex < 0) {
      const candle = allCandles[0];
      finalTime = candle.time as number;
      // Free Y placement - no price snapping in edit mode
    } else {
      const candle = allCandles[candleIndex];
      finalTime = candle.time as number;
      // Free Y placement - no price snapping in edit mode
    }
    
    // Create updated points array from original
    const newPoints = [...edit.originalDrawing.points];
    newPoints[edit.pointIndex] = { time: finalTime, price, snapType };
    
    // Optimistically update local state
    setDrawings(prev => prev.map(d => 
      d.id === edit.drawingId ? { ...d, points: newPoints } : d
    ));
    
    // Update via mutation
    if (updateDrawingMutationRef.current) {
      updateDrawingMutationRef.current.mutate({
        id: edit.drawingId,
        coordinates: { points: newPoints },
      });
    }
    
    setActiveEdit(null);
  }, [autoSnapEnabled]);
  
  // Ref for tracking crosshair info for UI display
  const lastCrosshairParamRef = useRef<{ time: number; price: number; logicalX?: number; pointX?: number } | null>(null);
  
  // Fetch saved drawings from database
  // Drawings data from persistence hook
  const savedDrawings = drawingsPersistence.drawings;
  const refetchDrawings = drawingsPersistence.refetchDrawings;
  
  // Load saved drawings into state when data changes
  useEffect(() => {
    // Always sync state with database, even for empty arrays
    if (savedDrawings) {
      setDrawings(savedDrawings.map(d => ({
        id: d.id,
        type: d.drawing_type || d.drawingType,
        points: d.coordinates?.points || [],
        style: d.style || { color: '#3b82f6', lineWidth: 2 },
      })).filter(d => d.points.length > 0)); // Only keep drawings with valid points
    }
  }, [savedDrawings]);
  
  // Attach/detach native primitives for high-performance rendering
  useEffect(() => {
    if (!chartControls.chartReady || !candleSeriesRef.current) return;
    
    const candleSeries = candleSeriesRef.current;
    const currentPrimitives = drawingPrimitivesRef.current;
    const currentDrawingIds = new Set(drawings.map(d => d.id));
    
    // If drawings are hidden, detach all primitives
    if (!drawingsVisible) {
      currentPrimitives.forEach((primitive) => {
        try {
          candleSeries.detachPrimitive(primitive);
        } catch (e) {
          // Already detached
        }
      });
      currentPrimitives.clear();
      return;
    }
    
    // Remove primitives for deleted drawings OR drawings being edited
    currentPrimitives.forEach((primitive, id) => {
      const isBeingEdited = activeEdit && activeEdit.drawingId === id;
      if (!currentDrawingIds.has(id) || isBeingEdited) {
        try {
          candleSeries.detachPrimitive(primitive);
        } catch (e) {
          // Already detached
        }
        currentPrimitives.delete(id);
      }
    });
    
    // Add or update primitives for current drawings (skip if being edited)
    // Compute last candle time for autoTrack injection
    const lastCandleTime = candles && candles.length > 0
      ? Number(candles[candles.length - 1].time)
      : undefined;

    drawings.forEach(drawing => {
      const isBeingEdited = activeEdit && activeEdit.drawingId === drawing.id;
      if (isBeingEdited) return; // Don't render primitive while editing
      
      const existingPrimitive = currentPrimitives.get(drawing.id);

      // For fib drawings with autoTrack, inject the latest candle time at render time
      const isFibDrawing = drawing.type === 'fib_retracement' || drawing.type === 'trend_fib';
      const effectiveStyle = (isFibDrawing && (drawing.style?.autoTrack ?? true) && lastCandleTime !== undefined)
        ? { ...drawing.style, _trackToTime: lastCandleTime }
        : drawing.style;
      
      if (existingPrimitive) {
        // Update existing primitive
        existingPrimitive.setSelected(selectedDrawingId === drawing.id);
        
        // Update points if they changed
        if ('updatePoints' in existingPrimitive) {
          (existingPrimitive as TrendLinePrimitive | RectanglePrimitive | FibRetracementPrimitive | ChannelPrimitive).updatePoints(drawing.points);
        } else if ('updatePoint' in existingPrimitive) {
          (existingPrimitive as HorizontalLinePrimitive).updatePoint(drawing.points[0]);
        }
        
        // Update style
        existingPrimitive.updateStyle(effectiveStyle);
      } else {
        // Create and attach new primitive
        const primitive = createDrawingPrimitive(
          drawing.id,
          drawing.type,
          drawing.points,
          effectiveStyle
        );
        
        if (primitive) {
          try {
            candleSeries.attachPrimitive(primitive);
            currentPrimitives.set(drawing.id, primitive);
          } catch (e) {
            console.error('Failed to attach primitive:', e);
          }
        }
      }
    });
    
    // Cleanup on unmount
    return () => {
      currentPrimitives.forEach((primitive) => {
        try {
          candleSeries.detachPrimitive(primitive);
        } catch (e) {
          // Already detached or chart disposed
        }
      });
      currentPrimitives.clear();
    };
  }, [chartControls.chartReady, drawings, selectedDrawingId, activeEdit, drawingsVisible, candles]);
  
  // Save drawing mutation
  // Drawing mutation wrappers - hook handles refetching and toasts
  const saveDrawing = useCallback((drawing: any) => {
    // Add to local state immediately for instant feedback
    // Note: The hook will refetch after save, which syncs server-generated IDs back via the useEffect at line 678
    setDrawings(d => [...d, drawing]);
    
    // Save to database via hook (handles refetch automatically)
    drawingsPersistence.saveDrawing({
      symbol,
      interval,
      tool: drawing.type,
      points: drawing.points,
      style: drawing.style,
    });
  }, [symbol, interval, drawingsPersistence]);
  
  const deleteDrawing = useCallback((drawingId: string) => {
    setDrawings(prev => prev.filter(d => d.id !== drawingId));
    setSelectedDrawingId(null);
    
    // Delete from database via hook
    // Note: If this fails, the refetch from the hook will restore the correct state
    drawingsPersistence.deleteDrawing(drawingId);
  }, [drawingsPersistence]);
  
  const clearDrawings = useCallback(() => {
    // Clear local state
    setDrawings([]);
    
    // Clear from database via hook (handles refetch automatically)
    drawingsPersistence.clearDrawings();
  }, [drawingsPersistence]);
  
  const updateDrawing = useCallback(({ id, style, coordinates }: { id: string; style?: any; coordinates?: any }) => {
    const updates: any = {};
    if (style) updates.style = style;
    if (coordinates) updates.coordinates = coordinates;

    // Optimistic local state update for immediate visual feedback
    setDrawings(prev => prev.map(d =>
      d.id === id ? { ...d, ...(style && { style }), ...(coordinates && { coordinates }) } : d
    ));

    const primitive = drawingPrimitivesRef.current?.get(id);
    if (primitive && updates.style) {
      const existingStyle = (primitive as any).getStyle?.() ?? {};
      primitive.updateStyle({ ...existingStyle, ...updates.style });
    }

    // Update in database via hook (handles refetch automatically)
    drawingsPersistence.updateDrawing({ id, updates });
  }, [drawingsPersistence]);
  
  // Keep mutation ref in sync for point dragging (now using wrapper)
  useEffect(() => {
    updateDrawingMutationRef.current = { mutate: updateDrawing };
  }, [updateDrawing]);
  
   // Handle fullscreen chart interval change independently
  const handleFullscreenIntervalChange = useCallback(async (newInterval: string) => {
    console.log('🔄 Fullscreen interval change:', newInterval);
    setFullscreenInterval(newInterval);
    
    try {
      if (isFalconTicker(fullscreenSymbol)) {
        if (!isFalconCandleTimeframe(newInterval)) return;
        const response = await fetch(`/api/crypto/falcon/candles?pair=${encodeURIComponent(fullscreenSymbol)}&timeframe=${encodeURIComponent(newInterval)}&limit=500`);
        if (response.ok) {
          const data = await response.json();
          const list = Array.isArray(data.candles) ? data.candles : [];
          setFullscreenCandles(list.map((c: any) => ({
            time: Number(c.time),
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: Number(c.volume ?? 0),
          })));
        }
        return;
      }
      const response = await fetch(`/api/binance/klines?symbol=${fullscreenSymbol}&interval=${newInterval}&limit=500`);
      if (response.ok) {
        const data = await response.json();
        setFullscreenCandles(binanceToCandleData(data));
        console.log('✅ Fullscreen candles loaded:', data.length);
      }
    } catch (error) {
      console.error('❌ Failed to fetch fullscreen candles:', error);
    }
  }, [fullscreenSymbol]);
  
  // Handle point commit from gesture controller
  const handlePointCommit = useCallback((point: GesturePoint) => {
    const currentTool = activeToolRef.current;
    if (chartControls.drawingMode !== 'draw' || !currentTool) return;
    
    // Elliott Wave tool: delegate point placement to the hook
    if (currentTool === 'elliott_wave') {
      if (elliottWave.isDrawing) {
        elliottWave.placePoint(point.time as number, point.price);
      }
      return;
    }
    
    setTempDrawing(prev => {
      if (!prev) return { points: [{ time: point.time as number, price: point.price, snapType: point.snapType }] };
      
      const newPoints = [...prev.points, { time: point.time as number, price: point.price, snapType: point.snapType }];
      const requiredPoints = currentTool === 'horizontal' ? 1 : currentTool === 'trend_fib' ? 3 : 2;
      
      // If we have enough points, save the drawing
      if (newPoints.length >= requiredPoints) {
        // Determine color based on auto-color setting and snap types
        const color = autoColorEnabledRef.current ? getAutoColor(newPoints, candles) : '#3b82f6';
        
        // Load saved defaults for fib and channel tools
        let savedDefaults: any = {};
        if (currentTool === 'fib_retracement' || currentTool === 'trend_fib' || currentTool === 'channel') {
          try {
            const defaultKey = currentTool === 'channel' ? 'channelDefaults' : `fibDefaults_${currentTool}`;
            const stored = localStorage.getItem(defaultKey);
            if (stored) savedDefaults = JSON.parse(stored);
          } catch (e) {}
        }
        
        // For channels, set autoColor based on global setting and default extendRight to true
        const channelStyle = currentTool === 'channel' 
          ? { autoColor: autoColorEnabledRef.current, labelPosition: 'right' as const, extendRight: true }
          : {};
        // For fib drawings, default autoTrack to true; respect explicit false saved in defaults
        const fibStyle = (currentTool === 'fib_retracement' || currentTool === 'trend_fib')
          ? { autoTrack: savedDefaults.autoTrack ?? true }
          : {};
        
        const newDrawing = {
          id: `drawing-${Date.now()}`,
          type: currentTool,
          points: newPoints,
          style: { color, lineWidth: 2, ...savedDefaults, ...fibStyle, ...channelStyle }
        };
        
        // Save to database (wrapper adds to local state for instant feedback and handles persistence)
        saveDrawing(newDrawing);
        // Toast notification is shown by the hook
        
        // Reset for next drawing
        return { points: [] };
      }
      
      return { points: newPoints };
    });
  }, [chartControls.drawingMode, saveDrawing, elliottWave.placePoint]);
  
  // Gesture controller hook for touch/click handling
  const gestureController = useChartGestures({
    enabled: chartControls.drawingMode === 'draw' && activeTool !== null,
    data: candles as unknown as { time: Time; open: number; high: number; low: number; close: number }[],
    onPointCommit: handlePointCommit,
    onCrosshairModeChange: setCrosshairModeActive,
    autoSnapEnabled,
  });
  
  // Cancel crosshair when draw mode is turned off or tool is deselected
  useEffect(() => {
    if (chartControls.drawingMode !== 'draw' || activeTool === null) {
      gestureController.cancelCrosshairMode();
      setCrosshairModeActive(false);
    }
  }, [chartControls.drawingMode, activeTool]);
  
  // Fullscreen mode: resize chart on window resize.
  // Resize dimensions only — fitContent() is NOT called here to preserve user zoom.
  useEffect(() => {
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        chartRef.current.applyOptions({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    if (isFullscreen) {
      window.addEventListener('resize', handleResize);
      // Trigger resize immediately when entering fullscreen
      setTimeout(handleResize, 50);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [isFullscreen]);
  
  // Connect findSnapPoint function to the ref for edit mode
  useEffect(() => {
    findSnapPointRef.current = gestureController.findSnapPoint;
  }, [gestureController.findSnapPoint]);

  // Series refs for chart rendering (not part of state hook)
  const bbRef = useRef<HTMLDivElement>(null);
  const oscillatorChartsRef = useRef<Map<string, IChartApi>>(new Map());
  const emaSeriesRefs = useRef<Record<string, ISeriesApi<'Line'> | null>>({});
  const emaHTFDataCache = useRef<Record<string, CandleData[]>>({});
  const smaSeriesRefs = useRef<Record<string, ISeriesApi<'Line'> | null>>({});
  const smaHTFDataCache = useRef<Record<string, CandleData[]>>({});
  const supertrendSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapBandsUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapBandsLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sessionVWAPAsiaRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sessionVWAPLondonRef = useRef<ISeriesApi<'Line'> | null>(null);
  const sessionVWAPNYRef = useRef<ISeriesApi<'Line'> | null>(null);
  // NOTE: orderBlocksRefs removed - now managed by OrderBlockOverlay component
  const smaFastRef = useRef<ISeriesApi<'Line'> | null>(null);
  const smaSlowRef = useRef<ISeriesApi<'Line'> | null>(null);
  const parabolicSARRef = useRef<ISeriesApi<'Line'> | null>(null);
  
  // ========== OSCILLATOR TIER ACCESS CONTROL ==========
  // Count currently active oscillators for free tier limit
  const getActiveOscillatorCount = () => {
    return [indicators.rsi.show, indicators.macd.show, indicators.stochRSI.show, indicators.obv.show, indicators.mfi.show, indicators.williamsR.show, indicators.cci.show, indicators.adx.show].filter(Boolean).length;
  };
  
  // ========== DIVERGENCE DETECTION ==========
  // Divergence state: -3 to +3 scale (-3 = strong bearish, +3 = strong bullish)
  const [divergenceStrength, setDivergenceStrength] = useState(0);
  const [divergenceType, setDivergenceType] = useState<'bullish' | 'bearish' | 'none'>('none');
  
  // Detect divergence between price and indicator
  // Returns consecutive count: positive for bullish, negative for bearish




  
  // Chart callbacks for ChartContainer component
  const handleVisibleRangeChange = useCallback((count: number) => {
    chartControls.setVisibleCandleCount(count);
  }, []);

  const handleCrosshairMove = useCallback((param: any) => {
    if (param.time && param.point && candleSeriesRef.current) {
      const time = param.time as number;
      const price = candleSeriesRef.current.coordinateToPrice(param.point.y);
      
      chartControls.setCrosshairInfo({
        time,
        x: param.point.x,
        y: param.point.y
      });
      
      lastCrosshairParamRef.current = {
        time,
        price: price !== null ? price : 0,
        pointX: param.point.x,
        logicalX: undefined
      };
    } else {
      chartControls.setCrosshairInfo(null);
    }
  }, []);

  const handleChartReady = useCallback((chart: any, candleSeries: any) => {
    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    chartControls.setChartReady(true);
  }, []);

  const futureWhitespaceConfig = useMemo(() => ({
    enabled: !isFalconTicker(symbol),
    getFutureBarCount,
    getInitialVisibleFutureBarCount,
    generateFutureWhitespace
  }), [getFutureBarCount, getInitialVisibleFutureBarCount, generateFutureWhitespace]);
  
  // Handler for oscillator toggles with tier restrictions
  const handleOscillatorToggle = (
    oscillatorName: string,
    currentValue: boolean,
    setter: (value: boolean) => void
  ) => {
    // If turning off, always allow
    if (currentValue) {
      setter(false);
      return;
    }
    
    // Paid tier: allow all oscillators, no limit
    if (isPaidTier) {
      setter(true);
      return;
    }
    
    // Free tier restrictions
    const isFreeAllowed = FREE_OSCILLATORS.includes(oscillatorName);
    if (!isFreeAllowed) {
      toast({
        title: 'Upgrade Required',
        description: `${oscillatorName} is available for paid subscribers only. Upgrade to access all oscillators.`,
        variant: 'destructive'
      });
      return;
    }
    
    // Check max active limit for free tier
    const activeCount = getActiveOscillatorCount();
    if (activeCount >= MAX_FREE_OSCILLATORS) {
      toast({
        title: 'Free Tier Limit',
        description: 'Free users can only have 1 oscillator active at a time. Turn off the current one first, or upgrade for unlimited access.',
        variant: 'destructive'
      });
      return;
    }
    
    setter(true);
  };
  
  // Handler for trend tool toggles with tier restrictions
  // Free tier: only EMA and SMA allowed
  const FREE_TREND_TOOLS = ['EMA', 'SMA'];
  const handleTrendToolToggle = (
    toolName: string,
    currentValue: boolean,
    setter: (value: boolean) => void
  ) => {
    // If turning off, always allow
    if (currentValue) {
      setter(false);
      return;
    }
    
    // Paid tier: allow all trend tools
    if (isPaidTier) {
      setter(true);
      return;
    }
    
    // Free tier restrictions
    const isFreeAllowed = FREE_TREND_TOOLS.includes(toolName);
    if (!isFreeAllowed) {
      toast({
        title: 'Upgrade Required',
        description: `${toolName} is available for paid subscribers only. Upgrade to access all trend tools.`,
        variant: 'destructive'
      });
      return;
    }
    
    setter(true);
  };
  
  // Handler for SMC tool toggles - all require paid tier
  const handleSMCToolToggle = (
    toolName: string,
    currentValue: boolean,
    setter: (value: boolean) => void
  ) => {
    // If turning off, always allow
    if (currentValue) {
      setter(false);
      return;
    }
    
    // Paid tier: allow all SMC tools
    if (isPaidTier) {
      setter(true);
      return;
    }
    
    // Free tier: no SMC tools allowed
    toast({
      title: 'Upgrade Required',
      description: `${toolName} is a Smart Money Concept tool available for paid subscribers only.`,
      variant: 'destructive'
    });
  };
  
  // ========== CHART DISPLAY SETTINGS (independent from strategy settings) ==========
  // BOS swing length: 5 for tighter swing detection, CHoCH swing length: 20 for broader trend changes
  // Chart settings moved to useChartSettings hook (Phase 2)
  
  const [bias, setBias] = useState<'bullish' | 'bearish' | null>(null);
  const [structureTrend, setStructureTrend] = useState<'uptrend' | 'downtrend' | 'ranging' | null>(null);
  
  // Phase 2: State Management Hooks
  const replayMode = useReplayMode();
  const chartSettings = useChartSettings();
  
  
  const [cvdBullishThreshold, setCvdBullishThreshold] = useState(200); // % of average bullish delta
  const [cvdBullishThresholdInput, setCvdBullishThresholdInput] = useState('200');
  const [cvdBearishThreshold, setCvdBearishThreshold] = useState(200); // % of average bearish delta
  const [cvdBearishThresholdInput, setCvdBearishThresholdInput] = useState('200');

  const [marketAlerts, setMarketAlerts] = useState<MarketAlert[]>([]);
  const [alertFilterMode, setAlertFilterMode] = useState<'all' | 'active'>('all');
  
  // Alert type to indicator mapping - defines which alerts belong to which indicators
  // CRITICAL: These strings MUST match the MarketAlert['type'] values exactly
  const alertTypeToIndicator: Record<string, string | string[]> = {
    // SMC Alerts
    'BOS': 'smc',
    'CHoCH': 'smc',
    'FVG': 'smc',
    'FVG Entry': 'smc',
    'Liquidity Sweep': 'smc',
    // VWAP Alerts
    'VWAP Bounce': 'vwap',
    'VWAP Cross': 'vwap',
    // Trendline Alerts
    'Trendline Breakout': 'trendlines',
    'Trendline Rejection': 'trendlines',
    // Oscillator Alerts (can come from RSI, MACD, or MFI)
    'Oscillator Divergence': ['rsi', 'macd', 'mfi'],
    'Oscillator Crossover': ['rsi', 'macd', 'mfi'],
    // CVD & Volume Alerts
    'CVD Spike': 'cvd',
    'Volume Spike': 'cvd',
    'Level 2 Spike': 'cvd',
    // OBV Alerts
    'OBV Divergence': 'obv',
    'OBV Trend': 'obv',
    'OBV Spike': 'obv',
    // Bollinger Bands Alerts
    'BB Upper Touch': 'bollinger',
    'BB Lower Touch': 'bollinger',
    'BB Breakout': 'bollinger',
    'BB Middle Cross': 'bollinger',
  };
  
  // Multi-exchange orderflow additional state
  const [multiExchangeData, setMultiExchangeData] = useState<any>(null);
  const [multiExchangeLoading, setMultiExchangeLoading] = useState(false);
  
  // Refs to ensure auto-refresh always uses current values
  const symbolRef = useRef(symbol);
  const intervalRef = useRef(interval);
  
  useEffect(() => {
    symbolRef.current = symbol;
    intervalRef.current = interval;
  }, [symbol, interval]);
  
  // Detect market status changes for video player
  useEffect(() => {
    const isBullish = bias === 'bullish' && structureTrend === 'uptrend';
    const newState = isBullish ? 'bullish' : 'bearish';
    
    // Update target state
    if (newState !== targetMarketState) {
      setTargetMarketState(newState);
      
      // Mark that we've detected the initial state
      if (isInitialLoad) {
        setIsInitialLoad(false);
      }
    }
  }, [bias, structureTrend, targetMarketState, isInitialLoad]);
  
  // ========== STRATEGY SETTINGS (Moved to useStrategySettings hook - Phase 2) ==========
  // All strategy state declarations moved to hooks (lines saved: ~300)

  // ========== REPLAY MODE SETTINGS (Moved to useReplayMode hook - Phase 2) ==========
  // Replay mode state moved to hook

  // VWAP series refs
  const vwapSeriesRefs = useRef<{
    session?: ISeriesApi<'Line'>;
    daily?: ISeriesApi<'Line'>;
    weekly?: ISeriesApi<'Line'>;
    monthly?: ISeriesApi<'Line'>;
    rolling10?: ISeriesApi<'Line'>;
    rolling20?: ISeriesApi<'Line'>;
    rolling50?: ISeriesApi<'Line'>;
  }>({});

  // Bollinger Bands series refs
  const bbSeriesRefs = useRef<{
    upper?: ISeriesApi<'Line'>;
    middle?: ISeriesApi<'Line'>;
    lower?: ISeriesApi<'Line'>;
  }>({});

  // NOTE: fvgSeriesRefs removed - now managed by FVGOverlay component
  // NOTE: bosSeriesRefs and chochSeriesRefs removed - now managed by BOSCHoCHMarkers component
  // NOTE: structureLabelsRef removed - label rendering removed in Phase 4G-3
  const swingPivotSeriesRefs = useRef<Array<ISeriesApi<'Line'>>>([]);
  const trendlineSeriesRefs = useRef<Array<ISeriesApi<'Line'>>>([]);
  const tradeMarkerRefs = useRef<Array<any>>([]);

  useEffect(() => {
    const val = parseInt(indicators.bb.periodInput);
    if (!isNaN(val) && val >= 5 && val <= 100) {
      indicators.bb.setPeriod(val);
    }
  }, [indicators.bb.periodInput]);

  useEffect(() => {
    const val = parseFloat(indicators.bb.stdDevInput);
    if (!isNaN(val) && val >= 0.5 && val <= 4) {
      indicators.bb.setStdDev(val);
    }
  }, [indicators.bb.stdDevInput]);

  // Fetch multi-exchange orderflow data
  // Fetch AI Market Analysis
  const fetchAIAnalysis = useCallback(async (force = false) => {
    if (aiAnalysisState.loading || candles.length < 100) return;
    
    // Check 60-minute cooldown
    const now = Date.now();
    const cooldownMs = 60 * 60 * 1000; // 1 hour
    const timeSinceLastCheck = aiAnalysisState.lastCheck ? now - aiAnalysisState.lastCheck : cooldownMs + 1;
    
    if (timeSinceLastCheck < cooldownMs) {
      // User tried to refresh within the cooldown period
      if (force) {
        const remainingMs = cooldownMs - timeSinceLastCheck;
        const remainingMins = Math.ceil(remainingMs / 60000);
        toast({
          title: "Analysis is up to date",
          description: `This analysis was refreshed recently. Next refresh available in ${remainingMins} minute${remainingMins !== 1 ? 's' : ''}.`,
          duration: 4000,
        });
      }
      return;
    }
    
    aiAnalysisState.setLoading(true);
    aiAnalysisState.setLastCheck(now);
    
    try {
      const token = await getToken();
      if (!token) {
        toast({
          title: "Authentication required",
          description: "Please sign in to use AI analysis.",
          duration: 5000,
        });
        aiAnalysisState.setLoading(false);
        return;
      }
      
      const response = await fetch('/api/crypto/market-analysis', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          candles: candles.slice(-200),
          symbol: symbol.replace('USDT', '/USD'),
          timeframe: interval
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Analysis failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      aiAnalysisState.setAnalysis(data.analysis);
      aiAnalysisState.setTimestamp(now);
      aiAnalysisState.setCost(data.estimatedCost || 0);
      
      console.log('🤖 AI Analysis received', {
        cached: data.cached,
        cost: data.estimatedCost,
        tokens: data.tokens
      });
    } catch (error: any) {
      console.error('❌ Error fetching AI analysis:', error);
      aiAnalysisState.setAnalysis(`Error: ${error.message}`);
    } finally {
      aiAnalysisState.setLoading(false);
    }
  }, [candles, symbol, interval, aiAnalysisState.loading, aiAnalysisState.lastCheck, toast]);

  // Hourly AI Market Analysis auto-refresh
  useEffect(() => {
    if (candles.length < 100) return;
    
    // Fetch on mount when chart data is available
    if (!aiAnalysisState.analysis) {
      fetchAIAnalysis(false);
    }
    
    // Set up hourly refresh
    const intervalId = setInterval(() => {
      console.log('⏰ Hourly AI analysis refresh triggered');
      fetchAIAnalysis(false);
    }, 60 * 60 * 1000); // Every hour
    
    return () => clearInterval(intervalId);
  }, [candles.length, aiAnalysisState.analysis, fetchAIAnalysis]);

  const fetchMultiExchangeData = useCallback(async () => {
    if (!useMultiExchange || isFalconTicker(symbol)) return;
    
    // Capture current generation to check if response is still relevant
    const currentGeneration = fetchGenerationRef.current;
    
    setMultiExchangeLoading(true);
    try {
      const binanceSymbol = removeUSDTSuffix(symbol);
      const multiUrl = `/api/crypto/multi-exchange-orderflow?symbol=${binanceSymbol}USDT&period=1mo&interval=${interval}`;
      
      console.log('🌐 Fetching multi-exchange orderflow data...');
      const response = await fetch(multiUrl, { 
        signal: abortControllerRef.current?.signal 
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Check if this response is still relevant
        if (currentGeneration !== fetchGenerationRef.current) {
          console.log('🚫 Ignoring stale multi-exchange response');
          setMultiExchangeLoading(false);
          return;
        }
        
        setMultiExchangeData(data);
        
        // Use orderflowTable directly - it's separate from the chart
        if (data.orderflowTable && data.orderflowTable.length > 0) {
          console.log('📊 Raw orderflowTable data:', data.orderflowTable);
          
          let runningCVD = 0;
          const history = data.orderflowTable.map((row: any) => {
            runningCVD += row.delta;
            // API returns timestamps in milliseconds, chart uses seconds
            const timestampSeconds = row.time > 9999999999 ? Math.floor(row.time / 1000) : row.time;
            return {
              time: formatTimeOnly(timestampSeconds),
              date: formatDateOnly(timestampSeconds),
              timestamp: timestampSeconds,
              delta: row.delta,
              cumDelta: runningCVD,
              isBull: row.delta >= 0,
              volume: row.volume,
              exchanges: row.exchanges,
              bullishExchanges: row.bullishExchanges || 0,
              bearishExchanges: row.bearishExchanges || 0,
              confidence: row.confidence,
              divergence: row.divergence || false,
              highValueDivergence: row.highValueDivergence || false,
              volumeMultiple: row.volumeMultiple || 0
            };
          });
          
          setDeltaHistory(history);
          setCumDelta(runningCVD);
          
          console.log('✅ Multi-exchange table loaded:', {
            rows: history.length,
            exchanges: data.metadata?.exchanges?.filter((e: any) => e.success).length || 0,
            successRate: `${(data.metadata?.success_rate * 100 || 0).toFixed(0)}%`,
            avgConfidence: `${(history.reduce((sum: number, h: any) => sum + h.confidence, 0) / history.length * 100).toFixed(0)}%`,
            sampleRow: history[0]
          });
        }
      } else {
        console.error('Failed to fetch multi-exchange data:', response.statusText);
      }
    } catch (error) {
      // Ignore abort errors (user changed timeframe)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('🚫 Multi-exchange fetch aborted');
        return;
      }
      console.error('Error fetching multi-exchange data:', error);
    } finally {
      setMultiExchangeLoading(false);
    }
  }, [useMultiExchange, symbol, interval]);

  // Effect to fetch multi-exchange data when toggle changes
  useEffect(() => {
    if (useMultiExchange && candles.length > 0) {
      fetchMultiExchangeData();
    }
  }, [useMultiExchange, fetchMultiExchangeData, candles.length]);

  // Auto-refresh multi-exchange data every 60 seconds (matches minimum 1m candle timeframe)
  useEffect(() => {
    if (!useMultiExchange || candles.length === 0) return;

    console.log('🔄 Auto-refresh started for multi-exchange data (every 60s)');
    
    const refreshInterval = setInterval(() => {
      console.log('⏰ Auto-refresh tick - fetching multi-exchange data...');
      fetchMultiExchangeData();
    }, 60000);

    return () => {
      console.log('🛑 Auto-refresh stopped');
      clearInterval(refreshInterval);
    };
  }, [useMultiExchange, candles.length, fetchMultiExchangeData]);

  // Calculate rolling VWAP


  // Oscillator calculation functions



  const calculateStochRSI = useCallback((bars: CandleData[], period: number = 14) => {
    // Use the existing calculateStochasticRSI from indicators lib and return %K line
    const stochData = calculateStochasticRSI(bars, period, period);
    return stochData.map(d => ({ time: d.time, value: d.k }));
  }, [calculateStochasticRSI]);
  

  // *** Helper functions removed - using imported versions from @/lib/strategies ***

  // ==================== WRAPPER CALLBACKS FOR IMPORTED CALCULATION FUNCTIONS ====================
  
  // Wrap determineBias to set state
  const determineBias = useCallback((data: CandleData[]) => {
    const newBias = determineBiasCalc(data, indicators.ema.fastPeriod, indicators.ema.slowPeriod);
    setBias(newBias);
  }, [indicators.ema.fastPeriod, indicators.ema.slowPeriod]);

  // Wrap determineStructureTrend to set state
  const determineStructureTrend = useCallback((data: CandleData[]) => {
    const trend = determineStructureTrendCalc(data, chartSettings.bos.swingLength);
    setStructureTrend(trend);
    return trend;
  }, [chartSettings.bos.swingLength]);

  // Wrap calculateFVGs with footprintData dependency
  const calculateFVGsWrapper = useCallback((data: CandleData[], useAtrFilter: boolean = true, atrFactor: number = 0.5): FVG[] => {
    return calculateFVGs(data, footprintData, useAtrFilter, atrFactor, chartSettings.legacy.fvgVolumeThreshold);
  }, [footprintData, chartSettings.legacy.fvgVolumeThreshold]);

  // Wrap getOscillatorDivergence with config
  const getOscillatorDivergenceWrapper = useCallback((indicator: string) => {
    return getOscillatorDivergence(indicator, candles, {
      rsiPeriod: indicators.rsi.period,
      macdFast: indicators.macd.fast,
      macdSlow: indicators.macd.slow,
      macdSignal: indicators.macd.signal,
      stochRSIPeriod: indicators.stochRSI.period,
      mfiPeriod: indicators.mfi.period,
      williamsRPeriod: indicators.williamsR.period,
      cciPeriod: indicators.cci.period,
      adxPeriod: indicators.adx.period,
    });
  }, [candles, indicators.rsi.period, indicators.macd.fast, indicators.macd.slow, indicators.macd.signal, indicators.stochRSI.period, indicators.mfi.period, indicators.williamsR.period, indicators.cci.period, indicators.adx.period]);

  // Wrap detectDivergences with config
  const detectDivergencesWrapper = useCallback((candles: CandleData[]) => {
    return detectDivergences(candles, {
      rsiPeriod: indicators.rsi.period,
      macdFast: indicators.macd.fast,
      macdSlow: indicators.macd.slow,
      macdSignal: indicators.macd.signal,
      mfiPeriod: indicators.mfi.period,
    });
  }, [indicators.rsi.period, indicators.macd.fast, indicators.macd.slow, indicators.macd.signal, indicators.mfi.period]);

  // Wrap getClosestVWAP with config
  const getClosestVWAP = useCallback((currentPrice: number): number | null => {
    if (!chartRef.current) return null;
    return getClosestVWAPHelper(currentPrice, candles, {
      showDaily: indicators.vwap.showDaily,
      showWeekly: indicators.vwap.showWeekly,
      showRolling: indicators.vwap.showRolling,
      rollingPeriod: indicators.vwap.rollingPeriod,
    });
  }, [candles, indicators.vwap.showDaily, indicators.vwap.showWeekly, indicators.vwap.showRolling, indicators.vwap.rollingPeriod]);

  // ====================================================================================

  // Detect market structure events and populate alerts
  const detectMarketAlerts = useCallback(() => {
    if (candles.length < 50) return;
    
    const { bos, choch } = calculateBOSandCHoCH(candles, chartSettings.bos.swingLength);
    
    const newAlerts: MarketAlert[] = [];
    
    // Add BOS alerts
    bos.forEach(bosEvent => {
      const alertType = bosEvent.isLiquidityGrab ? 'Liquidity Sweep' : 'BOS';
      const description = bosEvent.isLiquidityGrab 
        ? `${bosEvent.type === 'bullish' ? 'Bullish' : 'Bearish'} liquidity sweep at ${bosEvent.swingPrice.toFixed(4)}`
        : `${bosEvent.type === 'bullish' ? 'Bullish' : 'Bearish'} BOS at ${bosEvent.swingPrice.toFixed(4)}`;
      
      newAlerts.push({
        id: `alert_${bosEvent.breakTime}_${alertType}`,
        time: bosEvent.breakTime,
        type: alertType,
        direction: bosEvent.type,
        price: bosEvent.swingPrice,
        description,
      });
    });
    
    // Add CHoCH alerts
    choch.forEach(chochEvent => {
      const alertType = chochEvent.isLiquidityGrab ? 'Liquidity Sweep' : 'CHoCH';
      const description = chochEvent.isLiquidityGrab
        ? `${chochEvent.type === 'bullish' ? 'Bullish' : 'Bearish'} liquidity sweep at ${chochEvent.swingPrice.toFixed(4)}`
        : `${chochEvent.type === 'bullish' ? 'Bullish' : 'Bearish'} CHoCH at ${chochEvent.swingPrice.toFixed(4)}`;
      
      newAlerts.push({
        id: `alert_${chochEvent.breakTime}_${alertType}`,
        time: chochEvent.breakTime,
        type: alertType,
        direction: chochEvent.type,
        price: chochEvent.swingPrice,
        description,
      });
    });
    
    // Add high-value FVG alerts
    const fvgs = calculateFVGsWrapper(candles, true);
    fvgs.forEach(fvg => {
      if (fvg.isHighValue && isActiveFVG(fvg, candles)) {
        newAlerts.push({
          id: `alert_${fvg.time}_FVG`,
          time: fvg.time,
          type: 'FVG',
          direction: fvg.type,
          price: (fvg.upper + fvg.lower) / 2,
          description: `${fvg.type === 'bullish' ? 'Bullish' : 'Bearish'} high-value FVG at ${((fvg.upper + fvg.lower) / 2).toFixed(4)}`,
        });
      }
    });
    
    // Add FVG Entry alerts (price entering FVG zones)
    // Calculate 1-week lookback limit (7 days in seconds)
    const oneWeekSeconds = 7 * 24 * 60 * 60;
    const currentTime = candles[candles.length - 1].time;
    const cutoffTime = currentTime - oneWeekSeconds;
    
    // For each active FVG, check if price entered it
    fvgs.forEach(fvg => {
      if (!isActiveFVG(fvg, candles)) return; // Skip filled FVGs
      
      const fvgIdx = candles.findIndex(c => c.time === fvg.time);
      if (fvgIdx === -1) return;
      
      // Check candles after FVG was created
      for (let i = fvgIdx + 1; i < candles.length; i++) {
        const candle = candles[i];
        const prevCandle = candles[i - 1];
        
        // Only alert on recent entries (within 1 week)
        if (candle.time < cutoffTime) continue;
        
        // Check if price entered the FVG zone on this candle
        // Bullish FVG entry: price moves DOWN into bullish FVG
        if (fvg.type === 'bullish') {
          const wasAboveFVG = prevCandle.low > fvg.upper;
          const enteredFVG = candle.low <= fvg.upper && candle.low >= fvg.lower;
          
          if (wasAboveFVG && enteredFVG) {
            newAlerts.push({
              id: `alert_${candle.time}_FVG_ENTRY_BULL_${fvg.time}`,
              time: candle.time,
              type: 'FVG Entry',
              direction: 'bullish',
              price: candle.low,
              description: `Bullish FVG entry at ${candle.low.toFixed(4)} (zone: ${fvg.lower.toFixed(4)}-${fvg.upper.toFixed(4)})`,
            });
            break; // Only alert once per FVG
          }
        }
        
        // Bearish FVG entry: price moves UP into bearish FVG
        if (fvg.type === 'bearish') {
          const wasBelowFVG = prevCandle.high < fvg.lower;
          const enteredFVG = candle.high >= fvg.lower && candle.high <= fvg.upper;
          
          if (wasBelowFVG && enteredFVG) {
            newAlerts.push({
              id: `alert_${candle.time}_FVG_ENTRY_BEAR_${fvg.time}`,
              time: candle.time,
              type: 'FVG Entry',
              direction: 'bearish',
              price: candle.high,
              description: `Bearish FVG entry at ${candle.high.toFixed(4)} (zone: ${fvg.lower.toFixed(4)}-${fvg.upper.toFixed(4)})`,
            });
            break; // Only alert once per FVG
          }
        }
      }
    });
    
    // Add VWAP rejection and cross alerts using HISTORICAL weekly VWAP values with 1-week lookback
    const weeklyVWAP = calculatePeriodicVWAP(candles, 'weekly', true);
    if (weeklyVWAP.length > 0 && candles.length > 1) {
      // Calculate 1-week lookback limit (7 days in seconds)
      const oneWeekSeconds = 7 * 24 * 60 * 60;
      const currentTime = candles[candles.length - 1].time;
      const cutoffTime = currentTime - oneWeekSeconds;
      
      console.log(`📊 VWAP Alert Detection - Using historical VWAP values, 1-week lookback from ${new Date(cutoffTime * 1000).toLocaleString()}`);
      
      // Create a map for fast VWAP value lookup by timestamp
      const vwapMap = new Map<number, number>();
      weeklyVWAP.forEach(v => vwapMap.set(v.time, v.value));
      
      // Check candles within 1-week lookback window
      for (let i = 1; i < candles.length; i++) {
        const candle = candles[i];
        const prevCandle = candles[i - 1];
        
        // Skip candles older than 1 week
        if (candle.time < cutoffTime) continue;
        
        // Get historical VWAP value for this candle's timestamp
        const vwapValue = vwapMap.get(candle.time);
        const prevVwapValue = vwapMap.get(prevCandle.time);
        
        // Skip if we don't have VWAP data for this candle
        if (vwapValue === undefined || prevVwapValue === undefined) continue;
        
        // Check for VWAP Crosses first (takes priority over rejections)
        // Bullish cross: previous close below VWAP, current close above VWAP
        const isBullishCross = prevCandle.close < prevVwapValue && candle.close > vwapValue;
        // Bearish cross: previous close above VWAP, current close below VWAP
        const isBearishCross = prevCandle.close > prevVwapValue && candle.close < vwapValue;
        
        if (isBullishCross) {
          console.log(`🟢 VWAP Bullish Cross at ${new Date(candle.time * 1000).toLocaleString()}, VWAP: ${vwapValue.toFixed(4)}`);
          newAlerts.push({
            id: `alert_${candle.time}_VWAP_CROSS_BULL`,
            time: candle.time,
            type: 'VWAP Cross',
            direction: 'bullish',
            price: vwapValue,
            description: `Bullish VWAP cross at ${vwapValue.toFixed(4)}`,
          });
        } else if (isBearishCross) {
          console.log(`🔴 VWAP Bearish Cross at ${new Date(candle.time * 1000).toLocaleString()}, VWAP: ${vwapValue.toFixed(4)}`);
          newAlerts.push({
            id: `alert_${candle.time}_VWAP_CROSS_BEAR`,
            time: candle.time,
            type: 'VWAP Cross',
            direction: 'bearish',
            price: vwapValue,
            description: `Bearish VWAP cross at ${vwapValue.toFixed(4)}`,
          });
        } else {
          // Only check for bounces if it's NOT a cross
          // VWAP Bounces: enters VWAP zone, close stays on same side (AND previous close was same side)
          const vwapThreshold = 0.3; // 0.3% zone around VWAP for bounce detection
          const vwapZone = vwapValue * (vwapThreshold / 100);
          
          // Bullish bounce: wick enters VWAP zone from below, close above zone, previous close above zone
          const enteredZoneFromBelow = candle.low <= vwapValue + vwapZone && candle.low >= vwapValue - vwapZone;
          const closedAboveZone = candle.close > vwapValue + vwapZone;
          const prevClosedAboveZone = prevCandle.close > prevVwapValue + (prevVwapValue * (vwapThreshold / 100));
          
          if (enteredZoneFromBelow && closedAboveZone && prevClosedAboveZone) {
            console.log(`🟢 VWAP Bullish Bounce at ${new Date(candle.time * 1000).toLocaleString()}, VWAP: ${vwapValue.toFixed(4)}, Zone: ±${vwapThreshold}%`);
            newAlerts.push({
              id: `alert_${candle.time}_VWAP_BOUNCE_BULL`,
              time: candle.time,
              type: 'VWAP Bounce',
              direction: 'bullish',
              price: vwapValue,
              description: `Bullish VWAP bounce at ${vwapValue.toFixed(4)}`,
            });
          }
          
          // Bearish bounce: wick enters VWAP zone from above, close below zone, previous close below zone
          const enteredZoneFromAbove = candle.high >= vwapValue - vwapZone && candle.high <= vwapValue + vwapZone;
          const closedBelowZone = candle.close < vwapValue - vwapZone;
          const prevClosedBelowZone = prevCandle.close < prevVwapValue - (prevVwapValue * (vwapThreshold / 100));
          
          if (enteredZoneFromAbove && closedBelowZone && prevClosedBelowZone) {
            console.log(`🔴 VWAP Bearish Bounce at ${new Date(candle.time * 1000).toLocaleString()}, VWAP: ${vwapValue.toFixed(4)}, Zone: ±${vwapThreshold}%`);
            newAlerts.push({
              id: `alert_${candle.time}_VWAP_BOUNCE_BEAR`,
              time: candle.time,
              type: 'VWAP Bounce',
              direction: 'bearish',
              price: vwapValue,
              description: `Bearish VWAP bounce at ${vwapValue.toFixed(4)}`,
            });
          }
        }
      }
    }
    
    // Add Trendline Breakout and Rejection alerts with 1-week lookback
    if (candles.length > 100) {
      // Get effective pivot length (adaptive or user-set)
      const adaptivePivotLength = candles.length > 1000 ? 20 : candles.length > 500 ? 15 : 10;
      const effectivePivotLength = indicators.smc.trendlinePivotLength || adaptivePivotLength;
      
      // Detect current trendlines
      const trendlines = detectTrendlines(candles, indicators.smc.trendlineMinTouches, indicators.smc.trendlineTolerance, effectivePivotLength);
      
      if (trendlines.length > 0) {
        // 1-week lookback
        const oneWeekSeconds = 7 * 24 * 60 * 60;
        const currentTime = candles[candles.length - 1].time;
        const cutoffTime = currentTime - oneWeekSeconds;
        
        trendlines.forEach(line => {
          // Check candles within 1-week window
          for (let i = 1; i < candles.length; i++) {
            const candle = candles[i];
            const prevCandle = candles[i - 1];
            
            // Skip old candles
            if (candle.time < cutoffTime) continue;
            
            // Calculate trendline price at this candle index
            const linePrice = line.slope * i + line.intercept;
            const prevLinePrice = line.slope * (i - 1) + line.intercept;
            const tolerance = linePrice * 0.003; // 0.3% tolerance zone
            
            if (line.type === 'resistance') {
              // BULLISH BREAKOUT: previous close below line, current close above line
              const wasBelowLine = prevCandle.close < prevLinePrice;
              const closedAboveLine = candle.close > linePrice;
              
              if (wasBelowLine && closedAboveLine) {
                newAlerts.push({
                  id: `alert_${candle.time}_TRENDLINE_BREAK_BULL`,
                  time: candle.time,
                  type: 'Trendline Breakout',
                  direction: 'bullish',
                  price: linePrice,
                  description: `Bullish breakout through resistance at ${linePrice.toFixed(4)}`,
                });
              }
              
              // BEARISH REJECTION: wick touches/penetrates line from below, but close stays below
              const wickTouchedLine = candle.high >= linePrice - tolerance && candle.high <= linePrice + tolerance;
              const closedBelowLine = candle.close < linePrice - tolerance;
              const prevClosedBelowLine = prevCandle.close < prevLinePrice - tolerance;
              
              if (wickTouchedLine && closedBelowLine && prevClosedBelowLine) {
                newAlerts.push({
                  id: `alert_${candle.time}_TRENDLINE_REJ_BEAR`,
                  time: candle.time,
                  type: 'Trendline Rejection',
                  direction: 'bearish',
                  price: linePrice,
                  description: `Bearish rejection at resistance ${linePrice.toFixed(4)}`,
                });
              }
            } else {
              // Support line
              // BEARISH BREAKOUT: previous close above line, current close below line
              const wasAboveLine = prevCandle.close > prevLinePrice;
              const closedBelowLine = candle.close < linePrice;
              
              if (wasAboveLine && closedBelowLine) {
                newAlerts.push({
                  id: `alert_${candle.time}_TRENDLINE_BREAK_BEAR`,
                  time: candle.time,
                  type: 'Trendline Breakout',
                  direction: 'bearish',
                  price: linePrice,
                  description: `Bearish breakdown through support at ${linePrice.toFixed(4)}`,
                });
              }
              
              // BULLISH REJECTION: wick touches/penetrates line from above, but close stays above
              const wickTouchedLine = candle.low <= linePrice + tolerance && candle.low >= linePrice - tolerance;
              const closedAboveLine = candle.close > linePrice + tolerance;
              const prevClosedAboveLine = prevCandle.close > prevLinePrice + tolerance;
              
              if (wickTouchedLine && closedAboveLine && prevClosedAboveLine) {
                newAlerts.push({
                  id: `alert_${candle.time}_TRENDLINE_REJ_BULL`,
                  time: candle.time,
                  type: 'Trendline Rejection',
                  direction: 'bullish',
                  price: linePrice,
                  description: `Bullish rejection at support ${linePrice.toFixed(4)}`,
                });
              }
            }
          }
        });
      }
    }
    
    // Add divergence alerts (skip - replaced with enhanced multi-indicator divergence detection below)
    
    // Add CVD/Delta Spike alerts with exchange consensus color grading
    if (cvdSettings.enabled && deltaHistory.length >= 10) {
      // Calculate separate averages for bullish and bearish deltas
      const bullishDeltas = deltaHistory.filter(h => h.delta > 0);
      const bearishDeltas = deltaHistory.filter(h => h.delta < 0);
      
      const avgBullishDelta = bullishDeltas.length > 0 
        ? bullishDeltas.reduce((sum, h) => sum + h.delta, 0) / bullishDeltas.length 
        : 0;
      const avgBearishDelta = bearishDeltas.length > 0 
        ? bearishDeltas.reduce((sum, h) => sum + Math.abs(h.delta), 0) / bearishDeltas.length 
        : 0;
      
      // Check last 5 bars for spikes
      const recentBars = deltaHistory.slice(-5);
      
      recentBars.forEach((bar, idx) => {
        // Find corresponding candle for timestamp
        const candle = candles.find(c => new Date(c.time * 1000).toLocaleTimeString() === bar.time);
        if (!candle) return;
        
        // Get exchange consensus for color coding
        const bullishExchanges = bar.bullishExchanges || 0;
        const bearishExchanges = bar.bearishExchanges || 0;
        
        // Bullish spike detection with configurable thresholds
        const level1Mult = cvdSettings.level1 / 100;
        const level2Mult = cvdSettings.level2 / 100;
        const level3Mult = cvdSettings.level3 / 100;
        
        if (bar.delta > 0 && avgBullishDelta > 0) {
          const multiple = bar.delta / avgBullishDelta;
          if (multiple >= level1Mult) {
            // Determine grade symbol based on multiple and exchange consensus
            // Color code: 5-6 exchanges = 🟢, 3-4 = 🔵, 1-2 = ⚪
            let consensusEmoji = '🟢'; // 5-6 exchanges (strong)
            if (bullishExchanges <= 2) {
              consensusEmoji = '⚪'; // 1-2 exchanges (weak)
            } else if (bullishExchanges <= 4) {
              consensusEmoji = '🔵'; // 3-4 exchanges (moderate)
            }
            
            let gradeLabel = `${cvdSettings.level1}%`;
            let gradeEmoji = '▲';
            if (multiple >= level3Mult) {
              gradeLabel = `${cvdSettings.level3}%`;
              gradeEmoji = '▲³';
            } else if (multiple >= level2Mult) {
              gradeLabel = `${cvdSettings.level2}%`;
              gradeEmoji = '▲²';
            }
            
            newAlerts.push({
              id: `alert_${candle.time}_CVD_SPIKE_BULL`,
              time: candle.time,
              type: 'CVD Spike',
              direction: 'bullish',
              price: candle.close,
              description: `${consensusEmoji} ${gradeEmoji} ${gradeLabel} Bullish (${bullishExchanges}/6 exchanges)`,
            });
          }
        }
        
        // Bearish spike detection with configurable thresholds
        if (bar.delta < 0 && avgBearishDelta > 0) {
          const multiple = Math.abs(bar.delta) / avgBearishDelta;
          if (multiple >= level1Mult) {
            // Determine grade symbol based on multiple and exchange consensus
            // Color code: 5-6 exchanges = 🔴, 3-4 = 🟡, 1-2 = ⚪
            let consensusEmoji = '🔴'; // 5-6 exchanges (strong)
            if (bearishExchanges <= 2) {
              consensusEmoji = '⚪'; // 1-2 exchanges (weak)
            } else if (bearishExchanges <= 4) {
              consensusEmoji = '🟡'; // 3-4 exchanges (moderate)
            }
            
            let gradeLabel = `${cvdSettings.level1}%`;
            let gradeEmoji = '▼';
            if (multiple >= level3Mult) {
              gradeLabel = `${cvdSettings.level3}%`;
              gradeEmoji = '▼³';
            } else if (multiple >= level2Mult) {
              gradeLabel = `${cvdSettings.level2}%`;
              gradeEmoji = '▼²';
            }
            
            newAlerts.push({
              id: `alert_${candle.time}_CVD_SPIKE_BEAR`,
              time: candle.time,
              type: 'CVD Spike',
              direction: 'bearish',
              price: candle.close,
              description: `${consensusEmoji} ${gradeEmoji} ${gradeLabel} Bearish (${bearishExchanges}/6 exchanges)`,
            });
          }
        }
      });
    }
    
    // Volume Spike alerts from footprint/orderflow data
    if (footprintData && footprintData.length > 10) {
      const volumes = footprintData.map(f => f.bidVol.reduce((sum, v) => sum + v, 0) + f.askVol.reduce((sum, v) => sum + v, 0));
      const avgVolume = volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
      const volumeThreshold = 150; // 150% of average
      
      footprintData.slice(-5).forEach(bar => {
        const candle = candles.find(c => c.time === bar.time);
        if (!candle) return;
        
        const totalVolume = bar.bidVol.reduce((sum, v) => sum + v, 0) + bar.askVol.reduce((sum, v) => sum + v, 0);
        const percentOfAvg = (totalVolume / avgVolume) * 100;
        
        if (percentOfAvg >= volumeThreshold) {
          newAlerts.push({
            id: `alert_${bar.time}_VOL_SPIKE`,
            time: bar.time,
            type: 'Volume Spike',
            direction: bar.delta > 0 ? 'bullish' : 'bearish',
            price: candle.close,
            description: `Volume spike: ${totalVolume.toFixed(0)} (${percentOfAvg.toFixed(0)}% of avg)`,
          });
        }
      });
    }
    
    // Level 2 Spike: Volume spike with absorption (delta/CVD divergence)
    if (deltaHistory.length >= 10) {
      const recentBars = deltaHistory.slice(-5);
      let cumulativeDelta = 0;
      
      recentBars.forEach((bar, idx) => {
        const candle = candles.find(c => new Date(c.time * 1000).toLocaleTimeString() === bar.time);
        if (!candle) return;
        
        cumulativeDelta += bar.delta;
        
        // Check for divergence: delta direction vs CVD direction
        const deltaDirection = bar.delta > 0 ? 'bullish' : 'bearish';
        const cvdDirection = cumulativeDelta > 0 ? 'bullish' : 'bearish';
        
        // If high volume AND divergence between delta and CVD
        if (Math.abs(bar.delta) > 10000 && deltaDirection !== cvdDirection) {
          const absorptionType = deltaDirection === 'bullish' ? 'sell-side absorption' : 'buy-side absorption';
          newAlerts.push({
            id: `alert_${candle.time}_LEVEL2_SPIKE`,
            time: candle.time,
            type: 'Level 2 Spike',
            direction: cvdDirection,
            price: candle.close,
            description: `Level 2: Volume spike with ${absorptionType} (Delta: ${bar.delta.toFixed(0)}, CVD trend: ${cvdDirection})`,
            level: 2,
          });
        }
      });
    }
    
    // Multi-timeframe oscillator divergence detection (5m, 15m, 1h, 4h)
    // For now, using single timeframe with enhanced multi-indicator detection
    const rsiData = calculateRSI(candles, indicators.rsi.period);
    const macdData = calculateMACD(candles, indicators.macd.fast, indicators.macd.slow, indicators.macd.signal).macd;
    const mfiData = calculateMFI(candles, indicators.mfi.period);
    const obvData = calculateOBV(candles);
    
    // Look for divergences in recent candles
    for (let i = candles.length - 20; i < candles.length - 1; i++) {
      if (i < 10) continue;
      
      const indicatorsDiverging: string[] = [];
      
      // Check for bullish divergence (price lower low, indicators higher low)
      const priceLowerLow = candles[i].low < candles[i-5].low && candles[i].low < candles[i-10].low;
      
      if (priceLowerLow) {
        // RSI bullish divergence
        const rsiIdx = rsiData.findIndex(r => r.time === candles[i].time);
        if (rsiIdx > 10 && rsiData[rsiIdx].value > rsiData[rsiIdx-5].value) {
          indicatorsDiverging.push('RSI');
        }
        
        // MACD bullish divergence
        const macdIdx = macdData.findIndex(m => m.time === candles[i].time);
        if (macdIdx > 10 && macdData[macdIdx].value > macdData[macdIdx-5].value) {
          indicatorsDiverging.push('MACD');
        }
        
        // MFI bullish divergence
        const mfiIdx = mfiData.findIndex(m => m.time === candles[i].time);
        if (mfiIdx > 10 && mfiData[mfiIdx].value > mfiData[mfiIdx-5].value) {
          indicatorsDiverging.push('MFI');
        }
        
        // OBV bullish divergence
        const obvIdx = obvData.findIndex(o => o.time === candles[i].time);
        if (obvIdx > 10 && obvData[obvIdx].value > obvData[obvIdx-5].value) {
          indicatorsDiverging.push('OBV');
        }
        
        if (indicatorsDiverging.length > 0) {
          newAlerts.push({
            id: `alert_${candles[i].time}_OSC_DIV_BULL`,
            time: candles[i].time,
            type: 'Oscillator Divergence',
            direction: 'bullish',
            price: candles[i].close,
            description: `Level ${indicatorsDiverging.length} bullish divergence (${indicatorsDiverging.join(', ')})`,
            level: indicatorsDiverging.length,
            indicators: indicatorsDiverging,
          });
        }
      }
      
      // Check for bearish divergence (price higher high, indicators lower high)
      const priceHigherHigh = candles[i].high > candles[i-5].high && candles[i].high > candles[i-10].high;
      
      if (priceHigherHigh) {
        indicatorsDiverging.length = 0;
        
        // RSI bearish divergence
        const rsiIdx = rsiData.findIndex(r => r.time === candles[i].time);
        if (rsiIdx > 10 && rsiData[rsiIdx].value < rsiData[rsiIdx-5].value) {
          indicatorsDiverging.push('RSI');
        }
        
        // MACD bearish divergence
        const macdIdx = macdData.findIndex(m => m.time === candles[i].time);
        if (macdIdx > 10 && macdData[macdIdx].value < macdData[macdIdx-5].value) {
          indicatorsDiverging.push('MACD');
        }
        
        // MFI bearish divergence
        const mfiIdx = mfiData.findIndex(m => m.time === candles[i].time);
        if (mfiIdx > 10 && mfiData[mfiIdx].value < mfiData[mfiIdx-5].value) {
          indicatorsDiverging.push('MFI');
        }
        
        // OBV bearish divergence
        const obvIdx = obvData.findIndex(o => o.time === candles[i].time);
        if (obvIdx > 10 && obvData[obvIdx].value < obvData[obvIdx-5].value) {
          indicatorsDiverging.push('OBV');
        }
        
        if (indicatorsDiverging.length > 0) {
          newAlerts.push({
            id: `alert_${candles[i].time}_OSC_DIV_BEAR`,
            time: candles[i].time,
            type: 'Oscillator Divergence',
            direction: 'bearish',
            price: candles[i].close,
            description: `Level ${indicatorsDiverging.length} bearish divergence (${indicatorsDiverging.join(', ')})`,
            level: indicatorsDiverging.length,
            indicators: indicatorsDiverging,
          });
        }
      }
    }
    
    // Oscillator Crossover Alerts
    const macdFull = calculateMACD(candles, indicators.macd.fast, indicators.macd.slow, indicators.macd.signal);
    
    // MACD crossovers
    if (macdFull.macd.length > 1) {
      const latest = macdFull.macd[macdFull.macd.length - 1];
      const prev = macdFull.macd[macdFull.macd.length - 2];
      const latestSignal = macdFull.signal[macdFull.signal.length - 1];
      const prevSignal = macdFull.signal[macdFull.signal.length - 2];
      
      if (prev.value < prevSignal.value && latest.value > latestSignal.value) {
        newAlerts.push({
          id: `alert_${latest.time}_MACD_CROSS_BULL`,
          time: latest.time,
          type: 'Oscillator Crossover',
          direction: 'bullish',
          price: candles[candles.length - 1].close,
          description: 'Bullish MACD crossover',
          indicators: ['MACD'],
        });
      } else if (prev.value > prevSignal.value && latest.value < latestSignal.value) {
        newAlerts.push({
          id: `alert_${latest.time}_MACD_CROSS_BEAR`,
          time: latest.time,
          type: 'Oscillator Crossover',
          direction: 'bearish',
          price: candles[candles.length - 1].close,
          description: 'Bearish MACD crossover',
          indicators: ['MACD'],
        });
      }
    }
    
    // RSI level crossovers
    if (rsiData.length > 1) {
      const latest = rsiData[rsiData.length - 1];
      const prev = rsiData[rsiData.length - 2];
      
      if (prev.value < 30 && latest.value > 30) {
        newAlerts.push({
          id: `alert_${latest.time}_RSI_CROSS_BULL`,
          time: latest.time,
          type: 'Oscillator Crossover',
          direction: 'bullish',
          price: candles[candles.length - 1].close,
          description: 'RSI crossed above 30 (oversold exit)',
          indicators: ['RSI'],
        });
      } else if (prev.value > 70 && latest.value < 70) {
        newAlerts.push({
          id: `alert_${latest.time}_RSI_CROSS_BEAR`,
          time: latest.time,
          type: 'Oscillator Crossover',
          direction: 'bearish',
          price: candles[candles.length - 1].close,
          description: 'RSI crossed below 70 (overbought exit)',
          indicators: ['RSI'],
        });
      }
    }
    
    // MFI level crossovers
    if (mfiData.length > 1) {
      const latest = mfiData[mfiData.length - 1];
      const prev = mfiData[mfiData.length - 2];
      
      if (prev.value < 20 && latest.value > 20) {
        newAlerts.push({
          id: `alert_${latest.time}_MFI_CROSS_BULL`,
          time: latest.time,
          type: 'Oscillator Crossover',
          direction: 'bullish',
          price: candles[candles.length - 1].close,
          description: 'MFI crossed above 20 (oversold exit)',
          indicators: ['MFI'],
        });
      } else if (prev.value > 80 && latest.value < 80) {
        newAlerts.push({
          id: `alert_${latest.time}_MFI_CROSS_BEAR`,
          time: latest.time,
          type: 'Oscillator Crossover',
          direction: 'bearish',
          price: candles[candles.length - 1].close,
          description: 'MFI crossed below 80 (overbought exit)',
          indicators: ['MFI'],
        });
      }
    }
    
    // OBV-specific alerts
    if (obvData.length > 20) {
      // OBV Breakout Divergence
      for (let i = obvData.length - 20; i < obvData.length - 1; i++) {
        if (i < 10) continue;
        
        const priceNewHigh = candles[i].high > Math.max(...candles.slice(Math.max(0, i-20), i).map(c => c.high));
        const obvNotConfirming = obvData[i].value < Math.max(...obvData.slice(Math.max(0, i-20), i).map(o => o.value));
        
        if (priceNewHigh && obvNotConfirming) {
          newAlerts.push({
            id: `alert_${candles[i].time}_OBV_DIV_BEAR`,
            time: candles[i].time,
            type: 'OBV Divergence',
            direction: 'bearish',
            price: candles[i].high,
            description: 'Bearish OBV divergence: Price new high but OBV declining (distribution)',
          });
        }
        
        const priceNewLow = candles[i].low < Math.min(...candles.slice(Math.max(0, i-20), i).map(c => c.low));
        const obvRising = obvData[i].value > Math.min(...obvData.slice(Math.max(0, i-20), i).map(o => o.value));
        
        if (priceNewLow && obvRising) {
          newAlerts.push({
            id: `alert_${candles[i].time}_OBV_DIV_BULL`,
            time: candles[i].time,
            type: 'OBV Divergence',
            direction: 'bullish',
            price: candles[i].low,
            description: 'Bullish OBV divergence: Price new low but OBV rising (accumulation)',
          });
        }
      }
      
      // OBV Momentum Spike (steep slope change)
      for (let i = 5; i < obvData.length; i++) {
        const obvChange = obvData[i].value - obvData[i-5].value;
        const avgChange = Math.abs(obvData.slice(Math.max(0, i-20), i).reduce((sum, o, idx, arr) => {
          if (idx === 0) return 0;
          return sum + Math.abs(o.value - arr[idx-1].value);
        }, 0) / 20);
        
        if (Math.abs(obvChange) > avgChange * 3) {
          newAlerts.push({
            id: `alert_${obvData[i].time}_OBV_SPIKE`,
            time: obvData[i].time,
            type: 'OBV Spike',
            direction: obvChange > 0 ? 'bullish' : 'bearish',
            price: candles.find(c => c.time === obvData[i].time)?.close || 0,
            description: `OBV momentum spike: ${obvChange > 0 ? 'Strong buying' : 'Strong selling'} pressure`,
          });
        }
      }
    }
    
    // Add Bollinger Bands alerts (if enabled)
    if (indicators.bb.show && candles.length > indicators.bb.period) {
      const bbData = calculateBollingerBands(candles, indicators.bb.period, indicators.bb.stdDev);
      
      // 1-week lookback
      const oneWeekSeconds = 7 * 24 * 60 * 60;
      const currentTime = candles[candles.length - 1].time;
      const cutoffTime = currentTime - oneWeekSeconds;
      
      // Check recent candles for BB touches and breakouts
      for (let i = indicators.bb.period; i < candles.length; i++) {
        const candle = candles[i];
        
        // Skip old candles
        if (candle.time < cutoffTime) continue;
        
        const bbIdx = i - indicators.bb.period + 1;
        if (bbIdx < 0 || bbIdx >= bbData.upper.length) continue;
        
        const upperBand = bbData.upper[bbIdx].value;
        const middleBand = bbData.middle[bbIdx].value;
        const lowerBand = bbData.lower[bbIdx].value;
        
        // Upper Band Touch (wick touches but closes below)
        if (candle.high >= upperBand * 0.998 && candle.close < upperBand) {
          newAlerts.push({
            id: `alert_${candle.time}_BB_UPPER_TOUCH`,
            time: candle.time,
            type: 'BB Upper Touch',
            direction: 'bearish',
            price: upperBand,
            description: `Price touched upper Bollinger Band at ${upperBand.toFixed(4)} (potential reversal)`,
          });
        }
        
        // Lower Band Touch (wick touches but closes above)
        if (candle.low <= lowerBand * 1.002 && candle.close > lowerBand) {
          newAlerts.push({
            id: `alert_${candle.time}_BB_LOWER_TOUCH`,
            time: candle.time,
            type: 'BB Lower Touch',
            direction: 'bullish',
            price: lowerBand,
            description: `Price touched lower Bollinger Band at ${lowerBand.toFixed(4)} (potential reversal)`,
          });
        }
        
        // Upper Band Breakout (close above upper band)
        if (candle.close > upperBand) {
          newAlerts.push({
            id: `alert_${candle.time}_BB_UPPER_BREAKOUT`,
            time: candle.time,
            type: 'BB Breakout',
            direction: 'bullish',
            price: candle.close,
            description: `Price broke above upper Bollinger Band (strong momentum)`,
          });
        }
        
        // Lower Band Breakout (close below lower band)
        if (candle.close < lowerBand) {
          newAlerts.push({
            id: `alert_${candle.time}_BB_LOWER_BREAKOUT`,
            time: candle.time,
            type: 'BB Breakout',
            direction: 'bearish',
            price: candle.close,
            description: `Price broke below lower Bollinger Band (strong selling)`,
          });
        }
        
        // Middle Band Cross (price crosses SMA)
        if (i > 0) {
          const prevCandle = candles[i - 1];
          const prevBbIdx = i - indicators.bb.period;
          if (prevBbIdx >= 0 && prevBbIdx < bbData.middle.length) {
            const prevMiddleBand = bbData.middle[prevBbIdx].value;
            
            // Bullish cross (price crosses above middle band)
            if (prevCandle.close < prevMiddleBand && candle.close > middleBand) {
              newAlerts.push({
                id: `alert_${candle.time}_BB_MIDDLE_CROSS_BULL`,
                time: candle.time,
                type: 'BB Middle Cross',
                direction: 'bullish',
                price: middleBand,
                description: `Price crossed above BB middle band (SMA${indicators.bb.period})`,
              });
            }
            
            // Bearish cross (price crosses below middle band)
            if (prevCandle.close > prevMiddleBand && candle.close < middleBand) {
              newAlerts.push({
                id: `alert_${candle.time}_BB_MIDDLE_CROSS_BEAR`,
                time: candle.time,
                type: 'BB Middle Cross',
                direction: 'bearish',
                price: middleBand,
                description: `Price crossed below BB middle band (SMA${indicators.bb.period})`,
              });
            }
          }
        }
      }
    }
    
    // Sort by time descending (most recent first) and keep last 20
    const sortedAlerts = newAlerts.sort((a, b) => b.time - a.time).slice(0, 20);
    setMarketAlerts(sortedAlerts);
  }, [candles, chartSettings.bos.swingLength, calculateBOSandCHoCH, calculateFVGsWrapper, isActiveFVG, calculatePeriodicVWAP, detectTrendlines, indicators.smc.trendlineMinTouches, indicators.smc.trendlineTolerance, indicators.smc.trendlinePivotLength, detectDivergencesWrapper, cvdSettings.enabled, cvdBullishThreshold, cvdBearishThreshold, deltaHistory, indicators.bb.show, indicators.bb.period, indicators.bb.stdDev]);

  // Save indicator defaults to localStorage (for current timeframe only)
  const saveToTimeframe = useCallback(() => {
    const indicatorDefaults = {
      indicators: {
        ema: {
          show: indicators.ema.show,
          fastPeriod: indicators.ema.fastPeriod,
          slowPeriod: indicators.ema.slowPeriod,
          configs: indicators.ema.configs,
        },
        sma: {
          show: indicators.sma.show,
          configs: indicators.sma.configs,
        },
        rsi: {
          show: indicators.rsi.show,
          period: indicators.rsi.period,
        },
        macd: {
          show: indicators.macd.show,
          fast: indicators.macd.fast,
          slow: indicators.macd.slow,
          signal: indicators.macd.signal,
        },
        obv: {
          show: indicators.obv.show,
        },
        mfi: {
          show: indicators.mfi.show,
          period: indicators.mfi.period,
        },
        stochRSI: {
          show: indicators.stochRSI.show,
          period: indicators.stochRSI.period,
        },
        williamsR: {
          show: indicators.williamsR.show,
          period: indicators.williamsR.period,
        },
        cci: {
          show: indicators.cci.show,
          period: indicators.cci.period,
        },
        adx: {
          show: indicators.adx.show,
          period: indicators.adx.period,
        },
        bb: {
          show: indicators.bb.show,
          period: indicators.bb.period,
          stdDev: indicators.bb.stdDev,
        },
        vwap: {
          showSession: indicators.vwap.showSession,
          showDaily: indicators.vwap.showDaily,
          showWeekly: indicators.vwap.showWeekly,
          showMonthly: indicators.vwap.showMonthly,
          showRolling: indicators.vwap.showRolling,
          rollingPeriod: indicators.vwap.rollingPeriod,
        },
        vwapTools: {
          showBands: indicators.vwapTools.showBands,
          showSession: indicators.vwapTools.showSession,
        },
        smc: {
          showFVG: indicators.smc.showFVG,
          showBOS: indicators.smc.showBOS,
          showCHoCH: indicators.smc.showCHoCH,
          showSwingPivots: indicators.smc.showSwingPivots,
          showOrderBlocks: indicators.smc.showOrderBlocks,
          obSwingLength: indicators.smc.obSwingLength,
          orderBlockLength: indicators.smc.orderBlockLength,
          showAutoTrendlines: indicators.smc.showAutoTrendlines,
          showHighValueOnly: indicators.smc.showHighValueOnly,
          showChartLabels: indicators.smc.showChartLabels,
        },
        supertrend: {
          show: indicators.supertrend.show,
          period: indicators.supertrend.period,
          multiplier: indicators.supertrend.multiplier,
        },
        parabolicSAR: {
          show: indicators.parabolicSAR.show,
          step: indicators.parabolicSAR.step,
          max: indicators.parabolicSAR.max,
        },
      },
      alertFilterMode,
      cvdSpikeEnabled: cvdSettings.enabled,
      cvdSpikeLevel1: cvdSettings.level1,
      cvdSpikeLevel2: cvdSettings.level2,
      cvdSpikeLevel3: cvdSettings.level3,
    };
    
    const storageKey = `indicatorDefaults_${userId}_${symbol}_${interval}`;
    localStorage.setItem(storageKey, JSON.stringify(indicatorDefaults));
    
    toast({
      title: "💾 Saved to Timeframe",
      description: `Indicator settings saved for ${symbol} on ${interval}`,
      duration: 3000,
    });
    
    console.log(`💾 Saved indicator defaults for ${userId}_${symbol}_${interval}:`, indicatorDefaults);
  }, [userId, symbol, interval, indicators.ema.show, indicators.ema.fastPeriod, indicators.ema.slowPeriod, indicators.ema.configs, indicators.sma.show, indicators.sma.configs, indicators.rsi.show, indicators.rsi.period, indicators.macd.show, indicators.macd.fast, indicators.macd.slow, indicators.macd.signal, indicators.obv.show, indicators.mfi.show, indicators.mfi.period, indicators.stochRSI.show, indicators.stochRSI.period, indicators.williamsR.show, indicators.williamsR.period, indicators.cci.show, indicators.cci.period, indicators.adx.show, indicators.adx.period, indicators.bb.show, indicators.bb.period, indicators.bb.stdDev, indicators.vwap.showSession, indicators.vwap.showDaily, indicators.vwap.showWeekly, indicators.vwap.showMonthly, indicators.vwap.showRolling, indicators.vwap.rollingPeriod, indicators.vwapTools.showBands, indicators.vwapTools.showSession, indicators.smc.showFVG, indicators.smc.showBOS, indicators.smc.showCHoCH, indicators.smc.showSwingPivots, indicators.smc.showOrderBlocks, indicators.smc.obSwingLength, indicators.smc.orderBlockLength, indicators.supertrend.show, indicators.supertrend.period, indicators.supertrend.multiplier, indicators.parabolicSAR.show, indicators.parabolicSAR.step, indicators.parabolicSAR.max, indicators.smc.showAutoTrendlines, indicators.smc.showHighValueOnly, indicators.smc.showChartLabels, alertFilterMode, cvdSettings.enabled, cvdSettings.level1, cvdSettings.level2, cvdSettings.level3, toast]);

  // Set current timeframe as the default for this symbol on page load
  const makeTimeframeDefault = useCallback(() => {
    const timeframeKey = `defaultTimeframe_${symbol}`;
    localStorage.setItem(timeframeKey, interval);
    
    toast({
      title: "⭐ Default Timeframe Set",
      description: `${interval} will load by default for ${symbol}`,
      duration: 3000,
    });
    
    console.log(`⭐ Set default timeframe for ${symbol}: ${interval}`);
  }, [symbol, interval, toast]);

  // Legacy function for backward compatibility - saves both
  const saveIndicatorDefaults = useCallback(() => {
    saveToTimeframe();
    makeTimeframeDefault();
  }, [saveToTimeframe, makeTimeframeDefault]);

  // Reset all indicators to OFF (used when no saved config exists for timeframe)
  const resetAllIndicators = useCallback(() => {
    // EMAs
    indicators.ema.setShow(false);
    indicators.ema.setConfigs([]);
    indicators.ema.setInputs({});
    // SMAs
    indicators.sma.setShow(false);
    indicators.sma.setConfigs([]);
    // Oscillators
    indicators.rsi.setShow(false);
    indicators.macd.setShow(false);
    indicators.obv.setShow(false);
    indicators.mfi.setShow(false);
    indicators.stochRSI.setShow(false);
    indicators.williamsR.setShow(false);
    indicators.cci.setShow(false);
    indicators.adx.setShow(false);
    // Bollinger Bands
    indicators.bb.setShow(false);
    // VWAPs
    indicators.vwap.setShowSession(false);
    indicators.vwap.setShowDaily(false);
    indicators.vwap.setShowWeekly(false);
    indicators.vwap.setShowMonthly(false);
    indicators.vwap.setShowRolling(false);
    indicators.vwapTools.setShowBands(false);
    indicators.vwapTools.setShowSession(false);
    // SMC Indicators
    indicators.smc.setShowFVG(false);
    indicators.smc.setShowBOS(false);
    indicators.smc.setShowCHoCH(false);
    indicators.smc.setShowSwingPivots(false);
    indicators.smc.setShowOrderBlocks(false);
    // Trend Indicators
    indicators.supertrend.setShow(false);
    indicators.parabolicSAR.setShow(false);
    indicators.smc.setShowAutoTrendlines(false);
    // Display options
    indicators.smc.setShowHighValueOnly(false);
    indicators.smc.setShowChartLabels(false);
    // CVD Spike settings - reset to defaults (disabled by default)
    cvdSettings.setEnabled(false);
    cvdSettings.setLevel1(175);
    cvdSettings.setLevel1Input('175');
    cvdSettings.setLevel2(250);
    cvdSettings.setLevel2Input('250');
    cvdSettings.setLevel3(400);
    cvdSettings.setLevel3Input('400');
    
    console.log(`🔄 Reset all indicators to OFF for ${symbol}_${interval} (no saved config)`);
  }, [symbol, interval]);

  // Load indicator defaults from localStorage
  const loadIndicatorDefaults = useCallback(() => {
    try {
      const storageKey = `indicatorDefaults_${userId}_${symbol}_${interval}`;
      const saved = localStorage.getItem(storageKey);
      
      if (!saved) {
        // No saved config for this timeframe - reset all indicators to OFF
        resetAllIndicators();
        return false;
      }
      
      const defaults = JSON.parse(saved);
      
      // EMAs
      if (defaults.indicators.ema.show !== undefined) indicators.ema.setShow(defaults.indicators.ema.show);
      if (defaults.indicators.ema.fastPeriod !== undefined) {
        indicators.ema.setFastInput(defaults.indicators.ema.fastPeriod.toString());
      }
      if (defaults.indicators.ema.slowPeriod !== undefined) {
        indicators.ema.setSlowInput(defaults.indicators.ema.slowPeriod.toString());
      }
      if (defaults.indicators.ema.configs && Array.isArray(defaults.indicators.ema.configs)) {
        indicators.ema.setConfigs(defaults.indicators.ema.configs);
        const inputs: Record<string, string> = {};
        defaults.indicators.ema.configs.forEach((c: any) => {
          inputs[c.id] = String(c.period);
        });
        indicators.ema.setInputs(inputs);
      }
      
      // SMAs
      if (defaults.indicators.sma.show !== undefined) indicators.sma.setShow(defaults.indicators.sma.show);
      if (defaults.indicators.sma.configs && Array.isArray(defaults.indicators.sma.configs)) {
        indicators.sma.setConfigs(defaults.indicators.sma.configs);
      }
      
      // Oscillators
      if (defaults.indicators.rsi.show !== undefined) indicators.rsi.setShow(defaults.indicators.rsi.show);
      if (defaults.indicators.rsi.period !== undefined) {
        indicators.rsi.setPeriod(defaults.indicators.rsi.period);
        indicators.rsi.setPeriodInput(defaults.indicators.rsi.period.toString());
      }
      if (defaults.indicators.macd.show !== undefined) indicators.macd.setShow(defaults.indicators.macd.show);
      if (defaults.indicators.macd.fast !== undefined) {
        indicators.macd.setFast(defaults.indicators.macd.fast);
        indicators.macd.setFastInput(defaults.indicators.macd.fast.toString());
      }
      if (defaults.indicators.macd.slow !== undefined) {
        indicators.macd.setSlow(defaults.indicators.macd.slow);
        indicators.macd.setSlowInput(defaults.indicators.macd.slow.toString());
      }
      if (defaults.indicators.macd.signal !== undefined) {
        indicators.macd.setSignal(defaults.indicators.macd.signal);
        indicators.macd.setSignalInput(defaults.indicators.macd.signal.toString());
      }
      if (defaults.indicators.obv.show !== undefined) indicators.obv.setShow(defaults.indicators.obv.show);
      if (defaults.indicators.mfi.show !== undefined) indicators.mfi.setShow(defaults.indicators.mfi.show);
      if (defaults.indicators.mfi.period !== undefined) {
        indicators.mfi.setPeriod(defaults.indicators.mfi.period);
        indicators.mfi.setPeriodInput(defaults.indicators.mfi.period.toString());
      }
      if (defaults.indicators.stochRSI.show !== undefined) indicators.stochRSI.setShow(defaults.indicators.stochRSI.show);
      if (defaults.indicators.stochRSI.period !== undefined) {
        indicators.stochRSI.setPeriod(defaults.indicators.stochRSI.period);
        indicators.stochRSI.setPeriodInput(defaults.indicators.stochRSI.period.toString());
      }
      if (defaults.indicators.williamsR.show !== undefined) indicators.williamsR.setShow(defaults.indicators.williamsR.show);
      if (defaults.indicators.williamsR.period !== undefined) {
        indicators.williamsR.setPeriod(defaults.indicators.williamsR.period);
        indicators.williamsR.setPeriodInput(defaults.indicators.williamsR.period.toString());
      }
      if (defaults.indicators.cci.show !== undefined) indicators.cci.setShow(defaults.indicators.cci.show);
      if (defaults.indicators.cci.period !== undefined) {
        indicators.cci.setPeriod(defaults.indicators.cci.period);
        indicators.cci.setPeriodInput(defaults.indicators.cci.period.toString());
      }
      if (defaults.indicators.adx.show !== undefined) indicators.adx.setShow(defaults.indicators.adx.show);
      if (defaults.indicators.adx.period !== undefined) {
        indicators.adx.setPeriod(defaults.indicators.adx.period);
        indicators.adx.setPeriodInput(defaults.indicators.adx.period.toString());
      }
      
      // Bollinger Bands
      if (defaults.indicators.bb.show !== undefined) indicators.bb.setShow(defaults.indicators.bb.show);
      if (defaults.indicators.bb.period !== undefined) {
        indicators.bb.setPeriod(defaults.indicators.bb.period);
        indicators.bb.setPeriodInput(defaults.indicators.bb.period.toString());
      }
      if (defaults.indicators.bb.stdDev !== undefined) {
        indicators.bb.setStdDev(defaults.indicators.bb.stdDev);
        indicators.bb.setStdDevInput(defaults.indicators.bb.stdDev.toString());
      }
      
      // VWAPs
      if (defaults.indicators.vwap.showSession !== undefined) indicators.vwap.setShowSession(defaults.indicators.vwap.showSession);
      if (defaults.indicators.vwap.showDaily !== undefined) indicators.vwap.setShowDaily(defaults.indicators.vwap.showDaily);
      if (defaults.indicators.vwap.showWeekly !== undefined) indicators.vwap.setShowWeekly(defaults.indicators.vwap.showWeekly);
      if (defaults.indicators.vwap.showMonthly !== undefined) indicators.vwap.setShowMonthly(defaults.indicators.vwap.showMonthly);
      if (defaults.indicators.vwap.showRolling !== undefined) indicators.vwap.setShowRolling(defaults.indicators.vwap.showRolling);
      if (defaults.indicators.vwap.rollingPeriod !== undefined) {
        indicators.vwap.setRollingPeriod(defaults.indicators.vwap.rollingPeriod);
        indicators.vwap.setRollingPeriodInput(defaults.indicators.vwap.rollingPeriod.toString());
      }
      if (defaults.indicators.vwapTools.showBands !== undefined) indicators.vwapTools.setShowBands(defaults.indicators.vwapTools.showBands);
      if (defaults.indicators.vwapTools.showSession !== undefined) indicators.vwapTools.setShowSession(defaults.indicators.vwapTools.showSession);
      
      // SMC Indicators
      if (defaults.indicators.smc.showFVG !== undefined) indicators.smc.setShowFVG(defaults.indicators.smc.showFVG);
      if (defaults.indicators.smc.showBOS !== undefined) indicators.smc.setShowBOS(defaults.indicators.smc.showBOS);
      if (defaults.indicators.smc.showCHoCH !== undefined) indicators.smc.setShowCHoCH(defaults.indicators.smc.showCHoCH);
      if (defaults.indicators.smc.showSwingPivots !== undefined) indicators.smc.setShowSwingPivots(defaults.indicators.smc.showSwingPivots);
      if (defaults.indicators.smc.showOrderBlocks !== undefined) indicators.smc.setShowOrderBlocks(defaults.indicators.smc.showOrderBlocks);
      if (defaults.indicators.smc.obSwingLength !== undefined) {
        indicators.smc.setObSwingLength(defaults.indicators.smc.obSwingLength);
        indicators.smc.setObSwingLengthInput(defaults.indicators.smc.obSwingLength.toString());
      }
      if (defaults.indicators.smc.orderBlockLength !== undefined) {
        indicators.smc.setOrderBlockLength(defaults.indicators.smc.orderBlockLength);
        indicators.smc.setOrderBlockLengthInput(defaults.indicators.smc.orderBlockLength.toString());
      }
      
      // Trend Indicators
      if (defaults.indicators.supertrend.show !== undefined) indicators.supertrend.setShow(defaults.indicators.supertrend.show);
      if (defaults.indicators.supertrend.period !== undefined) {
        indicators.supertrend.setPeriod(defaults.indicators.supertrend.period);
        indicators.supertrend.setPeriodInput(defaults.indicators.supertrend.period.toString());
      }
      if (defaults.indicators.supertrend.multiplier !== undefined) {
        indicators.supertrend.setMultiplier(defaults.indicators.supertrend.multiplier);
        indicators.supertrend.setMultiplierInput(defaults.indicators.supertrend.multiplier.toString());
      }
      if (defaults.indicators.parabolicSAR.show !== undefined) indicators.parabolicSAR.setShow(defaults.indicators.parabolicSAR.show);
      if (defaults.indicators.parabolicSAR.step !== undefined) {
        indicators.parabolicSAR.setStep(defaults.indicators.parabolicSAR.step);
        indicators.parabolicSAR.setStepInput(defaults.indicators.parabolicSAR.step.toString());
      }
      if (defaults.indicators.parabolicSAR.max !== undefined) {
        indicators.parabolicSAR.setMax(defaults.indicators.parabolicSAR.max);
        indicators.parabolicSAR.setMaxInput(defaults.indicators.parabolicSAR.max.toString());
      }
      if (defaults.indicators.smc.showAutoTrendlines !== undefined) indicators.smc.setShowAutoTrendlines(defaults.indicators.smc.showAutoTrendlines);
      
      // Display options
      if (defaults.indicators.smc.showHighValueOnly !== undefined) indicators.smc.setShowHighValueOnly(defaults.indicators.smc.showHighValueOnly);
      if (defaults.indicators.smc.showChartLabels !== undefined) indicators.smc.setShowChartLabels(defaults.indicators.smc.showChartLabels);
      if (defaults.alertFilterMode !== undefined) setAlertFilterMode(defaults.alertFilterMode);
      
      // CVD Spike settings
      if (defaults.cvdSpikeEnabled !== undefined) cvdSettings.setEnabled(defaults.cvdSpikeEnabled);
      if (defaults.cvdSpikeLevel1 !== undefined) {
        cvdSettings.setLevel1(defaults.cvdSpikeLevel1);
        cvdSettings.setLevel1Input(defaults.cvdSpikeLevel1.toString());
      }
      if (defaults.cvdSpikeLevel2 !== undefined) {
        cvdSettings.setLevel2(defaults.cvdSpikeLevel2);
        cvdSettings.setLevel2Input(defaults.cvdSpikeLevel2.toString());
      }
      if (defaults.cvdSpikeLevel3 !== undefined) {
        cvdSettings.setLevel3(defaults.cvdSpikeLevel3);
        cvdSettings.setLevel3Input(defaults.cvdSpikeLevel3.toString());
      }
      
      toast({
        title: "📂 Indicators Loaded",
        description: `Settings restored for ${symbol} on ${interval}`,
        duration: 2000,
      });
      
      console.log(`📂 Loaded indicator defaults for ${symbol}_${interval}`);
      return true;
    } catch (error) {
      console.error('Failed to load indicator defaults:', error);
      resetAllIndicators();
    }
    return false;
  }, [userId, symbol, interval, toast, resetAllIndicators]);

  // Load indicator defaults when symbol or interval changes
  useEffect(() => {
    loadIndicatorDefaults();
  }, [symbol, interval, loadIndicatorDefaults]);

  // Click outside to deselect tab and collapse controls
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (chartControls.chartControlsRef.current && !chartControls.chartControlsRef.current.contains(event.target as Node)) {
        chartControls.setActiveTab(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Determine which indicators are currently active
  const activeIndicators = useMemo(() => {
    const active = new Set<string>();
    
    // SMC indicators
    if (indicators.smc.showBOS || indicators.smc.showCHoCH || indicators.smc.showFVG || indicators.smc.showSwingPivots) {
      active.add('smc');
    }
    
    // VWAP indicators
    if (indicators.vwap.showDaily || indicators.vwap.showWeekly || indicators.vwap.showMonthly || indicators.vwap.showRolling) {
      active.add('vwap');
    }
    
    // Trendlines
    if (showOwnerOnlyTools && indicators.smc.showAutoTrendlines) {
      active.add('trendlines');
    }
    
    // Oscillators
    if (indicators.rsi.show) active.add('rsi');
    if (indicators.macd.show) active.add('macd');
    if (indicators.mfi.show) active.add('mfi');
    if (indicators.obv.show) active.add('obv');
    
    // Bollinger Bands
    if (indicators.bb.show) active.add('bollinger');
    
    // CVD is always active for orderflow
    if (cvdSettings.enabled) active.add('cvd');
    
    return active;
  }, [showOwnerOnlyTools, indicators.smc.showBOS, indicators.smc.showCHoCH, indicators.smc.showFVG, indicators.smc.showSwingPivots, indicators.vwap.showDaily, indicators.vwap.showWeekly, indicators.vwap.showMonthly, indicators.vwap.showRolling, indicators.smc.showAutoTrendlines, indicators.rsi.show, indicators.macd.show, indicators.mfi.show, indicators.obv.show, indicators.bb.show, cvdSettings.enabled]);

  // Run backtest on historical data
  // Handle strategy generation
  // Fix chart when navigating back to page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && chartRef.current && chartContainerRef.current) {
        setTimeout(() => {
          if (chartRef.current && chartContainerRef.current) {
            chartRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
              height: 600,
            });
            chartRef.current.timeScale().fitContent();
          }
        }, 100);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

// Chart initialization is now handled by ChartContainer component
  
  // Attach gesture controller to chart when ready
  useEffect(() => {
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const container = chartContainerRef.current;
    
    console.log('[GestureAttach] Effect running:', { chart: !!chart, candleSeries: !!candleSeries, container: !!container, chartReady: chartControls.chartReady });
    
    if (!chart || !candleSeries || !container || !chartControls.chartReady) return;
    
    console.log('[GestureAttach] Calling attachToChart...');
    // Attach the gesture controller to handle touch/click for drawing tools
    gestureController.attachToChart(chart, candleSeries, container);
    console.log('[GestureAttach] attachToChart complete');
    
    return () => {
      console.log('[GestureAttach] Cleanup: detaching');
      gestureController.detachFromChart();
    };
  }, [chartControls.chartReady, gestureController]);
  
  // Render drawings on chart using price lines
  const drawingLinesRef = useRef<any[]>([]);
  
  useEffect(() => {
    const candleSeries = candleSeriesRef.current;
    if (!candleSeries || !chartControls.chartReady) return;
    
    // Clear existing drawing lines
    drawingLinesRef.current.forEach(line => {
      try { candleSeries.removePriceLine(line); } catch (e) { /* ignore */ }
    });
    drawingLinesRef.current = [];
    
    // Render each drawing
    drawings.forEach(drawing => {
      if (drawing.type === 'horizontal' && drawing.points.length >= 1) {
        // Skip rendering price line if this drawing's point is being edited
        if (activeEdit && activeEdit.drawingId === drawing.id) {
          return; // Don't create price line while editing
        }
        // Use custom label if set, otherwise default to "H-Line"
        const customLabel = drawing.style?.label || 'H-Line';
        // Add alert icon using utility function
        const alertPrefix = getAlertPrefix('horizontal', drawing.style);
        const editPrefix = drawing.id === selectedDrawingId ? '✎ ' : '';
        // Only show label if showLabel is not explicitly false
        const showLabel = drawing.style?.showLabel !== false;
        const displayLabel = showLabel ? `${alertPrefix}${editPrefix}${customLabel}` : '';
        const line = candleSeries.createPriceLine({
          price: drawing.points[0].price,
          color: drawing.style?.color || '#3b82f6',
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: displayLabel,
        });
        if (line) drawingLinesRef.current.push(line);
      }
      // For trendlines and other drawings, we'll use the overlay canvas later
    });
  }, [drawings, chartControls.chartReady, selectedDrawingId, activeEdit]);

  // Update VWAPs
  useEffect(() => {
    if (!chartControls.chartReady || !chartRef.current || candles.length === 0) return;

    const chart = chartRef.current;
    
    // Extra safety check - ensure chart hasn't been disposed
    try {
      chart.timeScale();
    } catch (e) {
      return; // Chart is disposed, skip this update
    }
    
    const refs = vwapSeriesRefs.current;

    // Helper to manage VWAP series
    const manageVWAP = (
      key: keyof typeof refs,
      show: boolean,
      data: VWAPData[],
      color: string,
      title: string
    ) => {
      if (show && data.length > 0) {
        if (!refs[key]) {
          try {
            refs[key] = chart.addSeries(LineSeries, {
              color,
              lineWidth: 2,
              priceLineVisible: false,
              lastValueVisible: true,
              title,
            });
          } catch (e) {
            // Chart might be disposed
            return;
          }
        }
        try {
          refs[key]!.setData(data as any);
          // Update title in case period changed
          refs[key]!.applyOptions({ title });
        } catch (e) {
          // Series might be disposed
        }
      } else if (!show && refs[key]) {
        try {
          chart.removeSeries(refs[key]!);
        } catch (e) {
          // Series might already be disposed
        }
        delete refs[key];
      }
    };

    manageVWAP('session', indicators.vwap.showSession, calculatePeriodicVWAP(candles, 'daily', true), '#a78bfa', 'Session VWAP');
    manageVWAP('daily', indicators.vwap.showDaily, calculatePeriodicVWAP(candles, 'daily', true), '#fb923c', 'Daily VWAP');
    manageVWAP('weekly', indicators.vwap.showWeekly, calculatePeriodicVWAP(candles, 'weekly', true), '#10b981', 'Weekly VWAP');
    manageVWAP('monthly', indicators.vwap.showMonthly, calculatePeriodicVWAP(candles, 'monthly', true), '#3b82f6', 'Monthly VWAP');
    const rollingKey = indicators.vwap.rollingPeriod === 10 ? 'rolling10' : indicators.vwap.rollingPeriod === 50 ? 'rolling50' : 'rolling20';
    manageVWAP(rollingKey, indicators.vwap.showRolling, calculateRollingVWAP(candles, indicators.vwap.rollingPeriod), '#ec4899', `rVWAP(${indicators.vwap.rollingPeriod})`);
  }, [chartControls.chartReady, candles, indicators.vwap.showSession, indicators.vwap.showDaily, indicators.vwap.showWeekly, indicators.vwap.showMonthly, indicators.vwap.showRolling, indicators.vwap.rollingPeriod, calculatePeriodicVWAP, calculateRollingVWAP]);


  // Clear HTF caches and load saved timeframe when symbol changes
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      emaHTFDataCache.current = {};
      smaHTFDataCache.current = {};
      prevSymbolRef.current = symbol;
      
      // Load saved default timeframe for the new symbol
      const savedTimeframe = localStorage.getItem(`defaultTimeframe_${symbol}`);
      if (savedTimeframe) {
        setTimeframeInterval(
          isFalconTicker(symbol) ? falconSafeTimeframe(savedTimeframe) : savedTimeframe,
        );
        console.log(`📂 Loaded saved timeframe for ${symbol}: ${savedTimeframe}`);
      }
    }
  }, [symbol]);

  // Fetch higher timeframe data for EMA calculations
  useEffect(() => {
    const fetchHTFData = async () => {
      const htfTimeframes = indicators.ema.configs
        .filter(c => c.timeframe !== 'current' && c.timeframe !== interval)
        .map(c => c.timeframe);
      
      const uniqueTimeframes = [...new Set(htfTimeframes)];
      
      for (const tf of uniqueTimeframes) {
        const cacheKey = `${symbol}_${tf}`;
        if (emaHTFDataCache.current[cacheKey]) continue; // Already cached
        
        try {
          if (isFalconTicker(symbol)) continue;
          const response = await fetch(`/api/binance/klines?symbol=${symbol}&interval=${tf}&limit=500`);
          if (response.ok) {
            const data = await response.json();
            emaHTFDataCache.current[cacheKey] = binanceToCandleData(data);
          }
        } catch (e) {
          console.error(`Failed to fetch ${tf} data for EMA:`, e);
        }
      }
    };
    
    if (indicators.ema.show && symbol) {
      fetchHTFData();
    }
  }, [indicators.ema.show, indicators.ema.configs, symbol, interval]);


  // Manage Bollinger Bands on main chart

  // ========== BATCH 1 INDICATORS ==========
  
  // Supertrend Indicator
  
  // VWAP Bands
  
  // Session VWAP
  
  // ========== BATCH 3 INDICATORS ==========
  
  // Fetch higher timeframe data for SMA calculations
  useEffect(() => {
    const fetchHTFData = async () => {
      const htfTimeframes = indicators.sma.configs
        .filter(c => c.timeframe !== 'current' && c.timeframe !== interval)
        .map(c => c.timeframe);
      
      const uniqueTimeframes = [...new Set(htfTimeframes)];
      
      for (const tf of uniqueTimeframes) {
        const cacheKey = `${symbol}_${tf}`;
        if (smaHTFDataCache.current[cacheKey]) continue;
        
        try {
          if (isFalconTicker(symbol)) continue;
          const response = await fetch(`/api/binance/klines?symbol=${symbol}&interval=${tf}&limit=500`);
          if (response.ok) {
            const data = await response.json();
            smaHTFDataCache.current[cacheKey] = binanceToCandleData(data);
          }
        } catch (e) {
          console.error(`Failed to fetch ${tf} data for SMA:`, e);
        }
      }
    };
    
    if (indicators.sma.show && symbol) {
      fetchHTFData();
    }
  }, [indicators.sma.show, indicators.sma.configs, symbol, interval]);

  // SMA (Simple Moving Average) - Dynamic config list
  useEffect(() => {
    if (!chartControls.chartReady || !chartRef.current || candles.length === 0) return;
    
    const chart = chartRef.current;
    const refs = smaSeriesRefs.current;

    // Remove old SMA series that are no longer in configs
    const currentIds = new Set(indicators.sma.configs.map(c => c.id));
    Object.keys(refs).forEach(key => {
      if (!currentIds.has(key) && refs[key]) {
        try { chart.removeSeries(refs[key]!); } catch (e) {}
        delete refs[key];
      }
    });

    if (!indicators.sma.show) {
      // Remove all SMA series when disabled
      Object.keys(refs).forEach(key => {
        if (refs[key]) {
          try { chart.removeSeries(refs[key]!); } catch (e) {}
          delete refs[key];
        }
      });
      return;
    }

    // Render each SMA config
    for (const config of indicators.sma.configs) {
      let smaData: { time: any; value: number }[] = [];
      
      const isCurrentTimeframe = config.timeframe === 'current' || config.timeframe === interval;
      
      if (isCurrentTimeframe) {
        const closes = candles.map(c => c.close);
        const smaValues = calculateSMA(closes, config.period);
        if (smaValues.length === 0) continue;
        
        smaData = smaValues.map((value, i) => ({
          time: candles[i + config.period - 1].time as any,
          value
        }));
      } else {
        // Use higher timeframe data
        const cacheKey = `${symbol}_${config.timeframe}`;
        const htfCandles = smaHTFDataCache.current[cacheKey];
        
        if (htfCandles && htfCandles.length > 0) {
          const htfCloses = htfCandles.map(c => c.close);
          const htfSmaValues = calculateSMA(htfCloses, config.period);
          
          // Map higher TF SMA values to current chart
          const htfSmaMap: { time: number; value: number }[] = htfSmaValues.map((value, i) => ({
            time: htfCandles[i + config.period - 1].time,
            value
          }));
          
          // For each current candle, find the corresponding HTF SMA value
          smaData = candles.map(c => {
            let htfValue: number | undefined;
            for (let i = htfSmaMap.length - 1; i >= 0; i--) {
              if (htfSmaMap[i].time <= c.time) {
                htfValue = htfSmaMap[i].value;
                break;
              }
            }
            return {
              time: c.time as any,
              value: htfValue!
            };
          }).filter(d => d.value !== undefined);
        }
      }

      if (smaData.length === 0) continue;

      // Format label: 21, 100D, 21W, 100h4, etc.
      const label = formatMALabel(config.period, config.timeframe);

      if (!refs[config.id]) {
        try {
          refs[config.id] = chart.addSeries(LineSeries, {
            color: config.color,
            lineWidth: 2,
            priceLineVisible: false,
            lastValueVisible: true,
            title: label,
          });
        } catch (e) { continue; }
      } else {
        try {
          refs[config.id]!.applyOptions({ title: label });
        } catch (e) {}
      }
      
      try {
        refs[config.id]!.setData(smaData);
      } catch (e) {}
    }
  }, [chartControls.chartReady, candles, indicators.sma.show, indicators.sma.configs, symbol, interval]);
  
  // Parabolic SAR


  // Draw white lines for swing pivots (visual-only indicator)
  useEffect(() => {
    if (!chartControls.chartReady || !chartRef.current || candles.length === 0) {
      return;
    }

    const chart = chartRef.current;
    
    // Extra safety check - ensure chart hasn't been disposed
    try {
      chart.timeScale();
    } catch (e) {
      return; // Chart is disposed, skip this update
    }

    // Remove old swing pivot lines
    if (swingPivotSeriesRefs.current.length > 0) {
      swingPivotSeriesRefs.current.forEach(series => {
        try {
          if (series && chart) {
            chart.removeSeries(series);
          }
        } catch (e) {
          // Series already disposed, ignore
        }
      });
      swingPivotSeriesRefs.current = [];
    }
    
    if (!indicators.smc.showSwingPivots) return;

    try {
      // Calculate swings at the user-specified swing length
      const swings = calculateSwings(candles, indicators.smc.swingPivotLength);
      
      console.log(`🎯 Drawing ${swings.length} swing pivot markers (length: ${indicators.smc.swingPivotLength})`);
      
      // Draw a white line for each swing pivot spanning 3 candles
      swings.forEach((swing) => {
        try {
          const pivotSeries = chart.addSeries(LineSeries, {
            color: '#FFFFFF', // White
            lineWidth: 2,
            lineStyle: 0, // Solid
            priceLineVisible: false,
            lastValueVisible: false,
          });
          
          // Find the candle index for this swing
          const swingIndex = candles.findIndex(c => c.time === swing.time);
          if (swingIndex === -1) return;
          
          // Calculate 3-candle span: 1 candle before, the pivot, 1 candle after
          const startIndex = Math.max(0, swingIndex - 1);
          const endIndex = Math.min(candles.length - 1, swingIndex + 1);
          
          const startTime = candles[startIndex].time;
          const endTime = candles[endIndex].time;
          
          // Draw horizontal line at swing price spanning 3 candles
          const lineData = [
            { time: startTime as any, value: swing.value },
            { time: endTime as any, value: swing.value },
          ];
          
          pivotSeries.setData(lineData);
          swingPivotSeriesRefs.current.push(pivotSeries);
        } catch (lineErr) {
          console.error(`❌ Failed to draw swing pivot line:`, lineErr, swing);
        }
      });
    } catch (e) {
      console.error('Error updating swing pivot markers:', e);
    }
  }, [chartControls.chartReady, candles, indicators.smc.showSwingPivots, indicators.smc.swingPivotLength, calculateSwings]);

  // Draw auto trendlines on chart
  useEffect(() => {
    if (!chartControls.chartReady || !chartRef.current || candles.length < 50) {
      return;
    }

    const chart = chartRef.current;
    
    // Clean up old trendline series
    if (trendlineSeriesRefs.current.length > 0) {
      trendlineSeriesRefs.current.forEach(series => {
        try {
          if (series && chart) {
            chart.removeSeries(series);
          }
        } catch (e) {
          // Series might already be removed
        }
      });
      trendlineSeriesRefs.current = [];
    }
    
    if (!showOwnerOnlyTools || !indicators.smc.showAutoTrendlines) return;

    try {
      // Adaptive pivot length based on number of visible candles
      const adaptivePivotLength = (() => {
        const candleCount = candles.length;
        if (candleCount < 100) return 2;      // Very sensitive for short timeframes
        if (candleCount < 300) return 5;      // Balanced for medium timeframes
        if (candleCount < 500) return 8;      // Medium sensitivity
        return 10;                              // Major swings only for long timeframes
      })();
      
      // Use user-set pivot length if available, otherwise use adaptive
      const effectivePivotLength = indicators.smc.trendlinePivotLength || adaptivePivotLength;
      
      const trendlines = detectTrendlines(candles, indicators.smc.trendlineMinTouches, indicators.smc.trendlineTolerance, effectivePivotLength);
      
      trendlines.forEach(trendline => {
        const color = trendline.type === 'support' ? '#10b981' : '#ef4444'; // Green for support, red for resistance
        const lineWidth = trendline.strength >= 4 ? 2 : 1; // Thicker for stronger trendlines
        
        // Get first and last point
        const firstPoint = trendline.points[0];
        const lastPoint = trendline.points[trendline.points.length - 1];
        
        // Extend the line to the current price mark (latest candle)
        const currentIndex = candles.length - 1;
        const currentPrice = trendline.slope * currentIndex + trendline.intercept;
        const currentTime = candles[currentIndex].time;
        
        // Create line series
        const trendlineSeries = chart.addSeries(LineSeries, {
          color,
          lineWidth,
          lineStyle: 2, // Dashed line
          priceLineVisible: false,
          lastValueVisible: false,
        });
        
        try {
          // Set data from first touch to current price mark
          trendlineSeries.setData([
            { time: firstPoint.time as any, value: firstPoint.price },
            { time: currentTime as any, value: currentPrice },
          ]);
          
          trendlineSeriesRefs.current.push(trendlineSeries);
        } catch (e) {
          // Series might be disposed
        }
      });
    } catch (e) {
      console.error('Error drawing auto trendlines:', e);
    }
  }, [chartControls.chartReady, candles, showOwnerOnlyTools, indicators.smc.showAutoTrendlines, indicators.smc.trendlineMinTouches, indicators.smc.trendlineTolerance, indicators.smc.trendlinePivotLength, detectTrendlines]);

  // NOTE: BOS/CHoCH text labels have been removed in Phase 4G-3
  // The BOSCHoCHMarkers component currently handles only horizontal lines
  // The "Chart Labels" toggle (indicators.smc.showChartLabels) is now non-functional
  // Future enhancement: Add label support to BOSCHoCHMarkers component or create separate LabelOverlay component


  // Chart Liquidity Sweep Settings (separate from bot strategy)
  useEffect(() => {
    const timer = setTimeout(() => {
      const num = parseInt(chartSettings.liquiditySweep.swingLengthInput);
      if (!isNaN(num) && num >= 5 && num <= 50) {
        chartSettings.liquiditySweep.setSwingLength(num);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [chartSettings.liquiditySweep.swingLengthInput]);

  // Legacy debounce effects (deprecated - keeping for backward compatibility)
  useEffect(() => {
    const timer = setTimeout(() => {
      const num = parseInt(chartSettings.legacy.swingLengthInput);
      if (!isNaN(num) && num >= 5 && num <= 20) {
        chartSettings.legacy.setSwingLength(num);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [chartSettings.legacy.swingLengthInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const num = parseInt(chartSettings.legacy.liqGrabInput);
      if (!isNaN(num) && num >= 1 && num <= 5) {
        chartSettings.legacy.setLiqGrabCandles(num);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [chartSettings.legacy.liqGrabInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const num = parseInt(chartSettings.legacy.wickRatioInput);
      if (!isNaN(num) && num >= 50 && num <= 500) {
        chartSettings.legacy.setWickToBodyRatio(num);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [chartSettings.legacy.wickRatioInput]);

  // Determine bias when candles change
  useEffect(() => {
    if (candles.length > 0) {
      determineBias(candles);
      determineStructureTrend(candles);
    }
  }, [candles, determineBias, determineStructureTrend]);

  // Refresh market alerts when candles update
  useEffect(() => {
    if (candles.length > 0) {
      detectMarketAlerts();
    }
  }, [candles, detectMarketAlerts]);

  // Fetch initial data on mount
  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // WebSocket hook - manages real-time updates
  useWebSocketConnection({
    symbol,
    interval,
    enabled: true,
    candlesLength: candles.length,
    onKlineUpdate: useCallback((bar: CandleData, isClosed: boolean) => {
      // Update chart only if bar time is >= last bar time
      if (candleSeriesRef.current) {
        try {
          const lastData = candleSeriesRef.current.data();
          if (lastData.length === 0 || bar.time >= (lastData[lastData.length - 1] as any).time) {
            candleSeriesRef.current.update(bar as any);
          }
        } catch (err) {
          // Silently ignore update errors for out-of-order data
        }
      }

      setCandles(prev => {
        const newCandles = [...prev];
        if (isClosed) { // Candle closed
          if (bar.time > newCandles[newCandles.length - 1].time) {
            newCandles.push(bar);
            // Save delta for this closed candle
            setDeltaHistory(prevHist => {
              const delta = realDeltaData.get(bar.time) || currentDelta;
              const timestampSeconds = bar.time > 9999999999 ? Math.floor(bar.time / 1000) : bar.time;
              const newHist = [...prevHist, {
                time: new Date(timestampSeconds * 1000).toLocaleTimeString(),
                timestamp: timestampSeconds,
                delta,
                cumDelta: cumDelta,
                isBull: bar.close >= bar.open,
                volume: bar.volume
              }];
              return newHist.slice(-20);
            });
            setCurrentDelta(0);
          } else {
            newCandles[newCandles.length - 1] = bar;
          }
        } else {
          // Update last candle in real-time
          if (bar.time === newCandles[newCandles.length - 1].time) {
            newCandles[newCandles.length - 1] = bar;
          } else {
            newCandles.push(bar);
          }
        }
        return newCandles;
      });
    }, [realDeltaData, currentDelta, cumDelta]),
    onTradeUpdate: useCallback((delta: number) => {
      setCurrentDelta(prev => prev + delta);
      setCumDelta(prev => prev + delta);
    }, [])
  });

  // Update candles when in replay mode
  useEffect(() => {
    if (replayMode.isReplayMode && replayMode.fullCandleData.length > 0) {
      // Store current visible range before updating candles
      let savedRange: any = null;
      if (chartRef.current) {
        try {
          savedRange = chartRef.current.timeScale().getVisibleRange();
        } catch (e) {
          // Chart might not be ready
        }
      }
      
      const replayCandles = replayMode.fullCandleData.slice(0, replayMode.replayIndex);
      setCandles(replayCandles);
      
      // Restore visible range after candles update (in next tick)
      if (savedRange) {
        setTimeout(() => {
          if (chartRef.current) {
            try {
              chartRef.current.timeScale().setVisibleRange(savedRange);
            } catch (e) {
              // Chart might be updating
            }
          }
        }, 50);
      }
    }
  }, [replayMode.isReplayMode, replayMode.replayIndex, replayMode.fullCandleData]);

  // Store full candle data when new data is fetched (not in replay mode)
  useEffect(() => {
    if (!replayMode.isReplayMode && candles.length > 0) {
      // Always update replayMode.fullCandleData with latest candles when not in replay mode
      replayMode.setFullCandleData([...candles]);
    }
  }, [candles.length, replayMode.isReplayMode]);

  // Helper callback for oscillator panels to register their charts
  const handleOscillatorChartCreated = useCallback((name: string, chart: IChartApi) => {
    oscillatorChartsRef.current.set(name, chart);
  }, []);

  // Get main chart visible range for oscillator sync
  const getMainChartVisibleRange = useCallback(() => {
    if (indicators.syncOscillatorScale && chartRef.current) {
      try {
        return chartRef.current.timeScale().getVisibleRange();
      } catch (e) {
        return null;
      }
    }
    return null;
  }, [indicators.syncOscillatorScale]);

  // ========== OSCILLATOR TIME SCALE SYNC ==========
  // Sync oscillator chart time scales with main chart when enabled
  useEffect(() => {
    if (!indicators.syncOscillatorScale || !chartRef.current) return;
    
    const mainChart = chartRef.current;
    const timeScale = mainChart.timeScale();
    
    // Use requestAnimationFrame for smooth sync without lag
    let rafId: number | null = null;
    const syncVisibleRange = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      rafId = requestAnimationFrame(() => {
        try {
          const visibleRange = timeScale.getVisibleRange();
          if (!visibleRange) return;
          
          oscillatorChartsRef.current.forEach((oscChart) => {
            try {
              oscChart.timeScale().setVisibleRange(visibleRange);
            } catch (e) {
              // Chart might not have data in this range
            }
          });
        } catch (e) {
          // Main chart might not be ready
        }
        rafId = null;
      });
    };
    
    // Subscribe to time scale changes
    timeScale.subscribeVisibleTimeRangeChange(syncVisibleRange);
    
    // Initial sync
    syncVisibleRange();
    
    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      timeScale.unsubscribeVisibleTimeRangeChange(syncVisibleRange);
    };
  }, [indicators.syncOscillatorScale]);

  // ========== DIVERGENCE CALCULATION ==========
  // Calculate divergence from active oscillators
  useEffect(() => {
    if (candles.length < 50) {
      setDivergenceStrength(0);
      setDivergenceType('none');
      return;
    }
    
    const priceData = candles.map(c => c.close);
    let totalDivergence = 0;
    let oscillatorCount = 0;
    
    // Check RSI divergence
    if (indicators.rsi.show) {
      const rsiData = calculateRSI(candles, indicators.rsi.period);
      const rsiValues = rsiData.map(d => d.value);
      if (rsiValues.length > 0) {
        totalDivergence += detectDivergence(priceData.slice(-rsiValues.length), rsiValues);
        oscillatorCount++;
      }
    }
    
    // Check MACD divergence (using histogram)
    if (indicators.macd.show) {
      const { hist } = calculateMACD(candles, indicators.macd.fast, indicators.macd.slow, indicators.macd.signal);
      const histValues = hist.map(d => d.value);
      if (histValues.length > 0) {
        totalDivergence += detectDivergence(priceData.slice(-histValues.length), histValues);
        oscillatorCount++;
      }
    }
    
    // Check OBV divergence
    if (indicators.obv.show) {
      const obvData = calculateOBV(candles);
      const obvValues = obvData.map(d => d.value);
      if (obvValues.length > 0) {
        totalDivergence += detectDivergence(priceData.slice(-obvValues.length), obvValues);
        oscillatorCount++;
      }
    }
    
    // Check Stoch RSI divergence
    if (indicators.stochRSI.show) {
      const stochData = calculateStochasticRSI(candles, indicators.stochRSI.period);
      const kValues = stochData.map(d => d.k);
      if (kValues.length > 0) {
        totalDivergence += detectDivergence(priceData.slice(-kValues.length), kValues);
        oscillatorCount++;
      }
    }
    
    // Average divergence across active oscillators - clamp to [-3, 3]
    const avgDivergence = oscillatorCount > 0 ? Math.round(totalDivergence / oscillatorCount) : 0;
    const clampedStrength = Math.max(-3, Math.min(3, avgDivergence));
    setDivergenceStrength(clampedStrength);
    setDivergenceType(clampedStrength > 0 ? 'bullish' : clampedStrength < 0 ? 'bearish' : 'none');
    
  }, [candles, indicators.rsi.show, indicators.macd.show, indicators.obv.show, indicators.stochRSI.show, indicators.rsi.period, indicators.macd.fast, indicators.macd.slow, indicators.macd.signal, indicators.stochRSI.period, calculateRSI, calculateMACD, calculateOBV, calculateStochasticRSI, detectDivergence]);

  // ========== ELLIOTT WAVE MARKERS ==========
  // Render placed Elliott Wave points as chart markers
  useEffect(() => {
    if (!candleSeriesRef.current || !elliottWave.isActive) {
      return;
    }
    const points = elliottWave.points;
    if (points.length === 0) return;

    if (!seriesMarkersRef.current) {
      seriesMarkersRef.current = createSeriesMarkers(candleSeriesRef.current, []);
    }

    const markers = points.map(point => ({
      time: point.time as Time,
      position: 'aboveBar' as 'aboveBar' | 'belowBar',
      color: '#00CED1',
      shape: 'circle' as const,
      text: point.label,
      size: 2,
    }));

    seriesMarkersRef.current.setMarkers(markers);

    return () => {
      seriesMarkersRef.current?.setMarkers([]);
    };
  }, [elliottWave.points, elliottWave.isActive]);

  // ========== INDICATOR REPORTS (coach readout under each oscillator) ==========
  const getIndicatorReport = useCallback((
    indicator: string
  ): { text: string; color: string; headline?: string; meaning?: string; lookFor?: string } => {
    if (candles.length < 8) return { text: '', color: '' };

    const empty = { text: '', color: '' };
    const div = getOscillatorDivergenceWrapper(indicator);
    const key = indicator.replace(/[^a-zA-Z]/g, '');

    const values: Record<string, number | undefined> = {};
    try {
      switch (key) {
        case 'RSI': {
          const rsiData = calculateRSI(candles, indicators.rsi.period);
          if (rsiData.length < 5) return { text: 'Insufficient data', color: 'text-gray-400' };
          const lastRSI = rsiData[rsiData.length - 1]?.value;
          const recent = rsiData.slice(-5).map((d) => d.value);
          values.value = lastRSI;
          values.slope = recent.length >= 2 ? recent[recent.length - 1] - recent[0] : 0;
          break;
        }
        case 'StochRSI': {
          const stochData = calculateStochasticRSI(candles, indicators.stochRSI.period);
          if (stochData.length < 5) return { text: 'Insufficient data', color: 'text-gray-400' };
          const recent = stochData.slice(-5).map((d) => d.k);
          values.k = stochData[stochData.length - 1]?.k;
          values.slope = recent.length >= 2 ? recent[recent.length - 1] - recent[0] : 0;
          break;
        }
        case 'MACD': {
          const { macd, signal, hist } = calculateMACD(
            candles,
            indicators.macd.fast,
            indicators.macd.slow,
            indicators.macd.signal,
          );
          if (macd.length < 5) return { text: 'Insufficient data', color: 'text-gray-400' };
          const lastMACD = macd[macd.length - 1]?.value;
          const lastSignal = signal[signal.length - 1]?.value;
          const prevMACD = macd[macd.length - 2]?.value;
          const prevSignal = signal[signal.length - 2]?.value;
          values.macd = lastMACD;
          values.signal = lastSignal;
          values.hist = hist[hist.length - 1]?.value;
          values.crossedUp = prevMACD < prevSignal && lastMACD > lastSignal ? 1 : 0;
          values.crossedDown = prevMACD > prevSignal && lastMACD < lastSignal ? 1 : 0;
          break;
        }
        case 'OBV': {
          const obvData = calculateOBV(candles);
          if (obvData.length < 6) return { text: 'Insufficient data', color: 'text-gray-400' };
          const recent = obvData.slice(-5).map((d) => d.value);
          values.slope = recent[recent.length - 1] - recent[0];
          break;
        }
        case 'MFI': {
          const mfiData = calculateMFI(candles, indicators.mfi.period);
          if (mfiData.length < 5) return { text: 'Insufficient data', color: 'text-gray-400' };
          const recent = mfiData.slice(-5).map((d) => d.value);
          values.value = mfiData[mfiData.length - 1]?.value;
          values.slope = recent.length >= 2 ? recent[recent.length - 1] - recent[0] : 0;
          break;
        }
        case 'WilliamsR': {
          const wrData = calculateWilliamsR(candles, indicators.williamsR.period);
          if (wrData.length < 5) return { text: 'Insufficient data', color: 'text-gray-400' };
          const recent = wrData.slice(-5).map((d) => d.value);
          values.value = wrData[wrData.length - 1]?.value;
          values.slope = recent.length >= 2 ? recent[recent.length - 1] - recent[0] : 0;
          break;
        }
        case 'CCI': {
          const cciData = calculateCCI(candles, indicators.cci.period);
          if (cciData.length < 5) return { text: 'Insufficient data', color: 'text-gray-400' };
          const recent = cciData.slice(-5).map((d) => d.value);
          values.value = cciData[cciData.length - 1]?.value;
          values.slope = recent.length >= 2 ? recent[recent.length - 1] - recent[0] : 0;
          break;
        }
        case 'ADX': {
          const adxData = calculateADX(candles, indicators.adx.period);
          if (adxData.length < 5) return { text: 'Insufficient data', color: 'text-gray-400' };
          const lastADX = adxData[adxData.length - 1];
          const recent = adxData.slice(-5).map((d) => d.adx);
          values.adx = lastADX?.adx;
          values.plusDI = lastADX?.plusDI;
          values.minusDI = lastADX?.minusDI;
          values.slope = recent.length >= 2 ? recent[recent.length - 1] - recent[0] : 0;
          break;
        }
        default:
          return empty;
      }
    } catch {
      return empty;
    }

    const coach = buildIndicatorCoach({
      indicator: key,
      candles,
      divergence: div,
      values,
    });
    if (!coach) return empty;
    return coach;
  }, [candles, indicators.rsi.period, indicators.macd.fast, indicators.macd.slow, indicators.macd.signal, indicators.adx.period, indicators.stochRSI.period, indicators.mfi.period, indicators.williamsR.period, indicators.cci.period, calculateRSI, calculateMACD, calculateOBV, calculateADX, calculateStochasticRSI, calculateMFI, calculateWilliamsR, calculateCCI, getOscillatorDivergenceWrapper]);

  // Get per-oscillator divergence (legacy comments)

  // Mini divergence meter component for each oscillator

  // Compute overlay data for components
  const fvgsData = useMemo(() => calculateFVGsWrapper(candles, true), [candles, calculateFVGsWrapper]);
  const orderBlocksData = useMemo(() => 
    calculateOrderBlocks(candles, indicators.smc.obSwingLength, indicators.smc.orderBlockLength),
    [candles, indicators.smc.obSwingLength, indicators.smc.orderBlockLength]
  );
  const bosChochData = useMemo(() => 
    calculateBOSandCHoCH(candles, chartSettings.bos.swingLength),
    [candles, chartSettings.bos.swingLength, calculateBOSandCHoCH]
  );
  const supertrendData = useMemo(() => 
    calculateSupertrend(candles, indicators.supertrend.period, indicators.supertrend.multiplier),
    [candles, indicators.supertrend.period, indicators.supertrend.multiplier]
  );
  const vwapData = useMemo(() => calculateVWAPBands(candles), [candles]);
  
  // Indicator calculations hook - replaces inline useMemo calculations
  const { sessionVWAP: sessionVWAPData, parabolicSAR: psarData, bollingerBands: bbData } = useIndicatorCalculations({
    candles,
    bbPeriod: indicators.bb.period,
    bbStdDev: indicators.bb.stdDev,
  });

  // Allow page to render for all users - unauthenticated get free tier
  // Sign in button in header handles authentication

  return (
    <>
      <Helmet>
        <title>Crypto Indicators & Oscillators | BearTec</title>
        <meta name="description" content="Beginner-friendly crypto charts with multiple oscillators, indicators, and educational AI technical scenarios. Not financial advice." />
        <meta property="og:title" content="Crypto Indicators & Oscillators | BearTec" />
        <meta property="og:description" content="Beginner-friendly crypto charts with multiple oscillators, indicators, and educational AI technical scenarios. Not financial advice." />
        <meta property="og:type" content="website" />
      </Helmet>
      <div className="min-h-screen bg-[#0e0e0e] p-4 pb-20">
        <div className="max-w-[1800px] mx-auto space-y-4">
          {/* Header */}
        <div className="relative flex flex-col items-center mb-4 pt-4">
          {/* BearTec Logo - Centered on mobile, left on desktop */}
          <div className="mb-4 md:absolute md:left-0 md:top-[80px] md:mb-0">
            <button
              onClick={() => setLocation('/cryptoindicators')}
              className="cursor-pointer"
              aria-label="Go to indicators"
            >
              <img 
                src={bearTecLogoNew} 
                alt="BearTec Logo" 
                className="h-[100px] md:h-[140px] w-auto object-contain"
              />
            </button>
          </div>
          
          {/* Dynamic Market Status Animation - Top Center */}
          <VideoSequencePlayer
            targetMarketState={targetMarketState}
            isInitialLoad={isInitialLoad}
            onInitialComplete={() => setIsInitialLoad(false)}
          />
        </div>

        {/* Spacer to prevent content overlap with animation */}
        <div className="h-[260px]"></div>

        {/* NEW: Search Bar for adding tickers */}
        <div className="flex justify-center mb-6">
          <TickerSearch onAddTicker={handleAddTicker} existingTickers={watchlistTickers} />
        </div>

        {/* NEW: Watchlist Table */}
        <div className="mb-6">
          <TickerTable
            tickers={watchlistTickers}
            onRemoveTicker={handleRemoveTicker}
            onSelectTicker={handleSelectTicker}
            selectedTicker={symbol}
            timeframe={tableTimeframe}
            onTimeframeChange={setTableTimeframe}
          />
        </div>
        
        {/* Additional Action Buttons */}
        <ActionButtonsToolbar
          onOpenSettings={() => modals.openModal('settings-dialog')}
          onOpenAlertSettings={() => modals.openModal('alert-settings')}
          feedbackUrl="/crypto/feedback"
        />

        {/* Replay Mode Controls */}
        <ReplayModeControls
          isReplayMode={replayMode.isReplayMode}
          replayIndex={replayMode.replayIndex}
          replaySpeed={replayMode.replaySpeed}
          isReplayPlaying={replayMode.isReplayPlaying}
          maxCandles={replayMode.fullCandleData.length}
          onToggleReplayMode={() => {
            const checked = !replayMode.isReplayMode;
            replayMode.setIsReplayMode(checked);
            if (checked) {
              // Entering replay mode
              const currentCandles = [...candles];
              replayMode.setFullCandleData(currentCandles);
              replayMode.setReplayIndex(100);
              replayMode.setIsReplayPlaying(false);
            } else {
              // Exiting replay mode - restore all candles
              replayMode.setIsReplayPlaying(false);
              // Restore full candles
              if (replayMode.fullCandleData.length > 0) {
                setCandles([...replayMode.fullCandleData]);
              }
            }
          }}
          onSetReplayIndex={replayMode.setReplayIndex}
          onSetReplaySpeed={replayMode.setReplaySpeed}
          onTogglePlayback={() => replayMode.setIsReplayPlaying(!replayMode.isReplayPlaying)}
          onStepBackward={(steps) => replayMode.setReplayIndex(Math.max(100, replayMode.replayIndex - steps))}
          onStepForward={(steps) => replayMode.setReplayIndex(Math.min(replayMode.fullCandleData.length, replayMode.replayIndex + steps))}
          onReset={() => replayMode.setReplayIndex(100)}
        />

        {/* Chart Control Bar */}
        <ChartControlBar
          symbol={symbol}
          interval={interval}
          period={chartPeriod}
          onSymbolChange={setSymbol}
          onIntervalChange={setTimeframeInterval}
          onPeriodChange={setChartPeriod}
          onRefresh={fetchInitialData}
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(!isFullscreen)}
        />

        {/* Main Chart */}
<Card 
  className={`bg-slate-800 border-slate-700 transition-all duration-300 ${
    isFullscreen 
      ? 'fixed inset-0 z-50 rounded-none border-0' 
      : ''
  }`}
  tabIndex={isFullscreen ? 0 : -1}
>
  <CardContent className={`p-4 bg-slate-800 ${isFullscreen ? 'h-full' : ''}`}>
    {loading ? (
      <div className={`${isFullscreen ? 'h-full' : 'h-[600px]'} flex items-center justify-center bg-slate-800`}>
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    ) : (
      <div className={`relative ${isFullscreen ? 'h-full' : ''}`}>
        {isFalconTicker(falconStatusSymbol) && !isFullscreen && (
          <FalconChartStatusBanner
            className="mb-2"
            pair={falconStatusSymbol}
            candleCount={falconStatus.candles.length}
            isLoading={falconStatus.isLoading}
            error={falconStatus.error}
            meta={falconStatus.falconMeta}
          />
        )}
        {/* Chart container with layered overlay structure */} 
 <div 
  className={`relative w-full bg-[#0f172a] overflow-hidden ${
    isFullscreen 
      ? 'h-screen' 
      : 'h-[600px] group'
  }`}
  style={{ 
    minHeight: isFullscreen ? '100vh' : '600px', 
    background: '#0f172a' 
  }}
>
  {/* Chart canvas rendered by ChartContainer component */}
  <ChartContainer
    ref={chartContainerRef}
    data={isFullscreen ? fullscreenCandles : candles}
    height={isFullscreen ? window.innerHeight : 600}
    isFullscreen={isFullscreen}
    loading={loading}
    interval={interval}
    onVisibleRangeChange={handleVisibleRangeChange}
    onCrosshairMove={handleCrosshairMove}
    onChartReady={handleChartReady}
    futureWhitespace={futureWhitespaceConfig}
  />
          
          {/* Clickable overlay - positioned ABOVE the canvas */}
          {!isFullscreen && (
            <div
              onClick={() => {
                setIsFullscreen(true);
                setTimeout(() => {
                  if (chartRef.current && chartContainerRef.current) {
                    chartRef.current.applyOptions({
                      width: chartContainerRef.current.clientWidth,
                      height: chartContainerRef.current.clientHeight
                    });
                  }
                }, 100);
              }}
              className="absolute inset-0 z-10 cursor-pointer hover:ring-2 hover:ring-cyan-500/50 transition-all"
              title="Click to expand fullscreen"
            />
          )}
          
          {/* Hover hint overlay - shows expand message on hover */}
          {!isFullscreen && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/95 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
              <div className="text-center space-y-2">
                <svg className="h-8 w-8 mx-auto text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <p className="text-sm text-cyan-400 font-medium">Click to expand fullscreen</p>
              </div>
            </div>
          )}
        </div>

        {/* Custom Crosshair Time Tooltip for Future Whitespace Area */}
        {chartControls.crosshairInfo && chartControls.crosshairInfo.time > 0 && (
          <div 
            className="absolute pointer-events-none z-20 bg-slate-900/90 text-white text-xs px-2 py-1 rounded border border-slate-600"
            style={{ 
              left: Math.min(chartControls.crosshairInfo.x, (chartContainerRef.current?.clientWidth || 800) - 120), 
              bottom: 10
            }}
          >
            {new Date(chartControls.crosshairInfo.time * 1000).toLocaleString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        )}
                
                {/* SVG Overlay for Selection Hit Areas & Edit Mode */}
                {/* Primitives handle visible rendering, SVG provides invisible hit areas for selection */}
                <svg 
                  className={`absolute top-0 left-0 ${(chartControls.drawingMode === 'select' || activeEdit) ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}`}
                  style={{ width: '100%', height: isFullscreen ? '100%' : '600px', zIndex: 10 }}
                  data-testid="drawing-overlay"
                  onClick={(e) => {
                    // If editing a point, place it here
                    if (activeEdit) {
                      handleEditPointPlace(e.clientX, e.clientY);
                      e.stopPropagation();
                      return;
                    }
                    if (chartControls.drawingMode === 'select') {
                      // If clicking on empty space, deselect
                      if ((e.target as Element).tagName === 'svg') {
                        setSelectedDrawingId(null);
                      }
                    }
                  }}
                >
                  {/* Render all drawings - invisible hit areas when not editing, visible when editing */}
                  {drawings.map(drawing => {
                    const isBeingEdited = activeEdit && activeEdit.drawingId === drawing.id;
                    const renderVisible = isBeingEdited; // Only show SVG graphics when editing this drawing
                    if (!chartRef.current || !chartControls.chartReady) return null;
                    
                    const chart = chartRef.current;
                    const timeScale = chart.timeScale();
                    const priceScale = candleSeriesRef.current?.priceScale();
                    
                    // Check if this drawing has a point being edited (should be hidden)
                    const isPointBeingEdited = (pointIndex: number) => {
                      return activeEdit && 
                             activeEdit.drawingId === drawing.id && 
                             activeEdit.pointIndex === pointIndex;
                    };
                    
                    // Convert time/price to pixel coordinates
                    const toPixel = (point: { time: number; price: number }, pointIndex?: number) => {
                      // Try to get coordinate for timestamp
                      let x: any = timeScale.timeToCoordinate(point.time as any);

                      // If off-chart (before or after visible range), extrapolate
                      if (x === null) {
                        const container = chartContainerRef.current;
                        if (container) {
                          const containerWidth = container.clientWidth;

                          // Get visible time range boundaries
                          const leftTime = timeScale.coordinateToTime(0);
                          const rightTime = timeScale.coordinateToTime(containerWidth);

                          if (leftTime !== null && rightTime !== null) {
                            // Calculate time-to-pixel ratio
                            const timeRange = (rightTime as number) - (leftTime as number);
                            const pixelsPerSecond = containerWidth / timeRange;

                            // Extrapolate x position based on time offset
                            const timeOffset = point.time - (leftTime as number);
                            x = timeOffset * pixelsPerSecond;
                          } else {
                            x = 0;
                          }
                        } else {
                          x = 0;
                        }
                      }

                      const y = candleSeriesRef.current?.priceToCoordinate(point.price);
                      return { x: x ?? 0, y: y ?? 0 };
                    };
                    
                    const color = drawing.style?.color || '#3b82f6';
                    const isSelected = drawing.id === selectedDrawingId;
                    
                    const handleClick = (e: React.MouseEvent) => {
                      e.stopPropagation();
                      if (chartControls.drawingMode === 'select') {
                        setSelectedDrawingId(drawing.id === selectedDrawingId ? null : drawing.id);
                      }
                    };
                    
                    if (drawing.type === 'trendline' && drawing.points.length >= 2) {
                      // If either point is being edited, hide the entire trendline until replaced
                      if (isPointBeingEdited(0) || isPointBeingEdited(1)) {
                        // Show only the remaining point as a marker
                        const remainingIndex = isPointBeingEdited(0) ? 1 : 0;
                        const remainingPoint = toPixel(drawing.points[remainingIndex], remainingIndex);
                        return (
                          <g key={drawing.id}>
                            <circle cx={remainingPoint.x} cy={remainingPoint.y} r={6} fill={color} stroke="#fff" strokeWidth={2} />
                            <text x={remainingPoint.x + 10} y={remainingPoint.y - 10} fill="#fff" fontSize="12">Click to place point</text>
                          </g>
                        );
                      }
                      const p1 = toPixel(drawing.points[0], 0);
                      const p2 = toPixel(drawing.points[1], 1);
                      if (p1.x === null || p2.x === null) return null;
                      const label = drawing.style?.label || '';
                      const labelRight = drawing.style?.labelPosition === 'right';
                      const extendLeft = drawing.style?.extendLeft || false;
                      const extendRight = drawing.style?.extendRight || false;
                      
                      const chartContainer = chartContainerRef.current;
                      const chartWidth = chartContainer?.clientWidth || 800;
                      const chartHeight = chartContainer?.clientHeight || 400;
                      
                      // Normalize points so pLeft is always the leftmost point
                      const pLeft = p1.x <= p2.x ? p1 : p2;
                      const pRight = p1.x <= p2.x ? p2 : p1;
                      
                      let lineX1 = pLeft.x;
                      let lineY1 = pLeft.y;
                      let lineX2 = pRight.x;
                      let lineY2 = pRight.y;
                      
                      if (extendLeft || extendRight) {
                        const dx = pRight.x - pLeft.x;
                        const dy = pRight.y - pLeft.y;
                        
                        const isVertical = Math.abs(dx) < 0.001;
                        const isHorizontal = Math.abs(dy) < 0.001;
                        
                        if (isVertical) {
                          // Vertical line: extend in Y direction only
                          const avgX = (pLeft.x + pRight.x) / 2;
                          lineX1 = avgX;
                          lineX2 = avgX;
                          if (extendLeft) lineY1 = 0;
                          if (extendRight) lineY2 = chartHeight;
                        } else if (isHorizontal) {
                          // Horizontal line: extend in X direction only
                          const avgY = (pLeft.y + pRight.y) / 2;
                          lineY1 = avgY;
                          lineY2 = avgY;
                          if (extendLeft) lineX1 = 0;
                          if (extendRight) lineX2 = chartWidth;
                        } else {
                          const slope = dy / dx;
                          const intercept = pLeft.y - slope * pLeft.x;
                          
                          const getYAtX = (x: number) => slope * x + intercept;
                          const getXAtY = (y: number) => (y - intercept) / slope;
                          
                          // Find intersection with left edge (toward smaller X)
                          if (extendLeft) {
                            // Extend beyond pLeft toward x=0
                            const yAtLeft = getYAtX(0);
                            if (yAtLeft >= 0 && yAtLeft <= chartHeight) {
                              lineX1 = 0;
                              lineY1 = yAtLeft;
                            } else if (yAtLeft < 0) {
                              // Line exits through top edge
                              const xAtTop = getXAtY(0);
                              lineX1 = Math.max(0, xAtTop);
                              lineY1 = 0;
                            } else {
                              // Line exits through bottom edge
                              const xAtBottom = getXAtY(chartHeight);
                              lineX1 = Math.max(0, xAtBottom);
                              lineY1 = chartHeight;
                            }
                          }
                          
                          // Find intersection with right edge (toward larger X)
                          if (extendRight) {
                            const yAtRight = getYAtX(chartWidth);
                            if (yAtRight >= 0 && yAtRight <= chartHeight) {
                              lineX2 = chartWidth;
                              lineY2 = yAtRight;
                            } else if (yAtRight < 0) {
                              // Line exits through top edge
                              const xAtTop = getXAtY(0);
                              lineX2 = Math.min(chartWidth, xAtTop);
                              lineY2 = 0;
                            } else {
                              // Line exits through bottom edge  
                              const xAtBottom = getXAtY(chartHeight);
                              lineX2 = Math.min(chartWidth, xAtBottom);
                              lineY2 = chartHeight;
                            }
                          }
                        }
                      }
                      
                      // Label position: use extended endpoints, clamp within viewport
                      const labelPadding = 10;
                      let labelX = labelRight ? lineX2 + 5 : lineX1 - 5;
                      let labelY = labelRight ? lineY2 : lineY1;
                      
                      // Clamp label X within chart bounds
                      labelX = Math.max(labelPadding, Math.min(chartWidth - labelPadding, labelX));
                      // Clamp label Y within chart bounds  
                      labelY = Math.max(15, Math.min(chartHeight - 5, labelY));
                      
                      // Dynamic text anchor: use 'start' near left edge, 'end' near right edge
                      // This prevents labels from extending off-screen
                      const effectiveAnchor = labelX < 60 ? 'start' : (labelX > chartWidth - 60 ? 'end' : (labelRight ? 'start' : 'end'));
                      
                      return (
                        <g key={drawing.id} onClick={handleClick} style={{ cursor: chartControls.drawingMode === 'select' ? 'pointer' : 'default' }}>
                          {/* Invisible hit area for selection - always present */}
                          <line 
                            x1={lineX1} y1={lineY1} x2={lineX2} y2={lineY2}
                            stroke="transparent"
                            strokeWidth={12}
                          />
                          {/* Visible line - only when editing (primitives render normally) */}
                          {renderVisible && (
                            <line 
                              x1={lineX1} y1={lineY1} x2={lineX2} y2={lineY2}
                              stroke={isSelected ? '#22c55e' : color}
                              strokeWidth={isSelected ? 3 : 2}
                            />
                          )}
                          {renderVisible && label && (
                            <text 
                              x={labelX}
                              y={labelY}
                              fill={isSelected ? '#22c55e' : color}
                              fontSize="11"
                              fontWeight="500"
                              textAnchor={effectiveAnchor}
                            >
                              {label}
                            </text>
                          )}
                          {/* Selection handles - show when selected */}
                          {isSelected && (
                            <>
                              <circle 
                                cx={p1.x} cy={p1.y} r={8} 
                                fill="#22c55e" 
                                stroke="#fff" 
                                strokeWidth={2}
                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                onMouseDown={(e) => handlePointPick(drawing.id, 0, e)}
                                onTouchStart={(e) => handlePointPick(drawing.id, 0, e)}
                              />
                              <circle 
                                cx={p2.x} cy={p2.y} r={8} 
                                fill="#22c55e" 
                                stroke="#fff" 
                                strokeWidth={2}
                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                onMouseDown={(e) => handlePointPick(drawing.id, 1, e)}
                                onTouchStart={(e) => handlePointPick(drawing.id, 1, e)}
                              />
                            </>
                          )}
                        </g>
                      );
                    }
                    
                    if (drawing.type === 'rectangle' && drawing.points.length >= 2) {
                      // If either point is being edited, hide the entire rectangle until replaced
                      if (isPointBeingEdited(0) || isPointBeingEdited(1)) {
                        const remainingIndex = isPointBeingEdited(0) ? 1 : 0;
                        const remainingPoint = toPixel(drawing.points[remainingIndex], remainingIndex);
                        return (
                          <g key={drawing.id}>
                            <circle cx={remainingPoint.x} cy={remainingPoint.y} r={6} fill={color} stroke="#fff" strokeWidth={2} />
                            <text x={remainingPoint.x + 10} y={remainingPoint.y - 10} fill="#fff" fontSize="12">Click to place point</text>
                          </g>
                        );
                      }
                      const p1 = toPixel(drawing.points[0], 0);
                      const p2 = toPixel(drawing.points[1], 1);
                      if (p1.x === null || p2.x === null) return null;
                      
                      const chartWidth = chartContainerRef.current?.clientWidth || 800;
                      const extendLeft = drawing.style?.extendLeft || false;
                      const extendRight = drawing.style?.extendRight || false;
                      
                      let x = Math.min(p1.x, p2.x);
                      let rectWidth = Math.abs(p2.x - p1.x);
                      const y = Math.min(p1.y, p2.y);
                      const h = Math.abs(p2.y - p1.y);
                      
                      if (extendLeft) {
                        rectWidth += x;
                        x = 0;
                      }
                      if (extendRight) {
                        rectWidth = chartWidth - x;
                      }
                      
                      const label = drawing.style?.label || '';
                      const labelRight = drawing.style?.labelPosition === 'right';
                      const labelX = labelRight ? Math.min(p1.x, p2.x) + Math.abs(p2.x - p1.x) - 5 : Math.min(p1.x, p2.x) + 5;
                      
                      return (
                        <g key={drawing.id} onClick={handleClick} style={{ cursor: chartControls.drawingMode === 'select' ? 'pointer' : 'default' }}>
                          {/* Invisible hit area for selection */}
                          <rect 
                            x={x} y={y} width={rectWidth} height={h}
                            fill="transparent"
                            stroke="transparent"
                            strokeWidth={8}
                          />
                          {/* Visible graphics only when editing */}
                          {renderVisible && (
                            <rect 
                              x={x} y={y} width={rectWidth} height={h}
                              fill={`${color}20`}
                              stroke={isSelected ? '#22c55e' : color}
                              strokeWidth={isSelected ? 3 : 2}
                            />
                          )}
                          {renderVisible && label && (
                            <text 
                              x={labelX}
                              y={y + 14}
                              fill={isSelected ? '#22c55e' : color}
                              fontSize="11"
                              fontWeight="500"
                              textAnchor={labelRight ? 'end' : 'start'}
                            >
                              {label}
                            </text>
                          )}
                          {isSelected && (
                            <>
                              <circle 
                                cx={p1.x} cy={p1.y} r={8} 
                                fill="#22c55e" 
                                stroke="#fff" 
                                strokeWidth={2}
                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                onMouseDown={(e) => handlePointPick(drawing.id, 0, e)}
                                onTouchStart={(e) => handlePointPick(drawing.id, 0, e)}
                              />
                              <circle 
                                cx={p2.x} cy={p2.y} r={8} 
                                fill="#22c55e" 
                                stroke="#fff" 
                                strokeWidth={2}
                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                onMouseDown={(e) => handlePointPick(drawing.id, 1, e)}
                                onTouchStart={(e) => handlePointPick(drawing.id, 1, e)}
                              />
                            </>
                          )}
                        </g>
                      );
                    }
                    
                    if (drawing.type === 'channel' && drawing.points.length >= 2) {
                      const p1 = toPixel(drawing.points[0], 0);
                      const p2 = toPixel(drawing.points[1], 1);
                      if (p1.x === null || p2.x === null) return null;
                      const chartWidth = chartContainerRef.current?.clientWidth || 800;
                      
                      const extendLeft = drawing.style?.extendLeft;
                      const extendRight = drawing.style?.extendRight !== false; // Default true
                      const baseStartX = Math.min(p1.x, p2.x);
                      const baseEndX = Math.max(p1.x, p2.x) + 100;
                      const lineStartX = extendLeft ? 0 : baseStartX;
                      const lineEndX = extendRight ? chartWidth : baseEndX;
                      
                      return (
                        <g key={drawing.id} onClick={handleClick} style={{ cursor: chartControls.drawingMode === 'select' ? 'pointer' : 'default' }}>
                          {/* Click target area for channel */}
                          <rect x={lineStartX} y={Math.min(p1.y, p2.y)} width={lineEndX - lineStartX} height={Math.abs(p2.y - p1.y)} fill="transparent" />
                          {/* Edit mode point handles */}
                          {renderVisible && (
                            <>
                              <circle 
                                cx={p1.x} cy={p1.y} r={8} 
                                fill="#22c55e" 
                                stroke="#fff" 
                                strokeWidth={2}
                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                onMouseDown={(e) => handlePointPick(drawing.id, 0, e)}
                                onTouchStart={(e) => handlePointPick(drawing.id, 0, e)}
                              />
                              <circle 
                                cx={p2.x} cy={p2.y} r={8} 
                                fill="#22c55e" 
                                stroke="#fff" 
                                strokeWidth={2}
                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                onMouseDown={(e) => handlePointPick(drawing.id, 1, e)}
                                onTouchStart={(e) => handlePointPick(drawing.id, 1, e)}
                              />
                            </>
                          )}
                        </g>
                      );
                    }
                    
                    if (drawing.type === 'fib_retracement' && drawing.points.length >= 2) {
                      const p1 = toPixel(drawing.points[0], 0);
                      const p2 = toPixel(drawing.points[1], 1);
                      if (p1.x === null || p2.x === null) return null;
                      const chartWidth = chartContainerRef.current?.clientWidth || 800;
                      
                      const extendLeft = drawing.style?.extendLeft;
                      const extendRight = drawing.style?.extendRight;
                      const baseStartX = Math.min(p1.x, p2.x);
                      const baseEndX = Math.max(p1.x, p2.x) + 100;
                      const lineStartX = extendLeft ? 0 : baseStartX;
                      const lineEndX = extendRight ? chartWidth : baseEndX;
                      
                      return (
                        <g key={drawing.id} onClick={handleClick} style={{ cursor: chartControls.drawingMode === 'select' ? 'pointer' : 'default' }}>
                          {/* Click target area - always present (fib lines/labels drawn by primitive) */}
                          <rect x={lineStartX} y={p1.y < p2.y ? p1.y : p2.y} width={lineEndX - lineStartX} height={Math.abs(p2.y - p1.y)} fill="transparent" />
                          {/* Edit mode point handles */}
                          {renderVisible && (
                            <>
                              <circle 
                                cx={p1.x} cy={p1.y} r={8} 
                                fill="#22c55e" 
                                stroke="#fff" 
                                strokeWidth={2}
                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                onMouseDown={(e) => handlePointPick(drawing.id, 0, e)}
                                onTouchStart={(e) => handlePointPick(drawing.id, 0, e)}
                              />
                              <circle 
                                cx={p2.x} cy={p2.y} r={8} 
                                fill="#22c55e" 
                                stroke="#fff" 
                                strokeWidth={2}
                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                onMouseDown={(e) => handlePointPick(drawing.id, 1, e)}
                                onTouchStart={(e) => handlePointPick(drawing.id, 1, e)}
                              />
                            </>
                          )}
                        </g>
                      );
                    }
                    
                    if (drawing.type === 'trend_fib' && drawing.points.length >= 3) {
                      const p1 = toPixel(drawing.points[0], 0);
                      const p2 = toPixel(drawing.points[1], 1);
                      const p3 = toPixel(drawing.points[2], 2);
                      if (p1.x === null || p2.x === null || p3.x === null) return null;
                      
                      const waveDiff = drawing.points[1].price - drawing.points[0].price;
                      const allFibLevels = [0.618, 1.0, 1.272, 1.618, 2.0, 2.618];
                      const chartWidth = chartContainerRef.current?.clientWidth || 800;
                      
                      const extendLeft = drawing.style?.extendLeft;
                      const extendRight = drawing.style?.extendRight;
                      const baseStartX = p3.x;
                      const baseEndX = p3.x + 200;
                      const lineStartX = extendLeft ? 0 : baseStartX;
                      const lineEndX = extendRight ? chartWidth : baseEndX;
                      
                      // Calculate hit area bounds
                      const minY = Math.min(...allFibLevels.map(level => {
                        const levelPrice = drawing.points[2].price + waveDiff * level;
                        return candleSeriesRef.current?.priceToCoordinate(levelPrice) ?? 0;
                      }));
                      const maxY = Math.max(...allFibLevels.map(level => {
                        const levelPrice = drawing.points[2].price + waveDiff * level;
                        return candleSeriesRef.current?.priceToCoordinate(levelPrice) ?? 0;
                      }));
                      
                      return (
                        <g key={drawing.id} onClick={handleClick} style={{ cursor: chartControls.drawingMode === 'select' ? 'pointer' : 'default' }}>
                          {/* Click target area (trend_fib lines/labels drawn by primitive) */}
                          <rect x={lineStartX} y={minY} width={lineEndX - lineStartX} height={maxY - minY} fill="transparent" />
                          {/* Wave measurement line - always visible for context */}
                          <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={isSelected ? '#22c55e' : '#888'} strokeWidth={isSelected ? 2 : 1} strokeDasharray="4,2" />
                          {/* Edit mode point handles */}
                          {renderVisible && (
                            <>
                              <circle 
                                cx={p1.x} cy={p1.y} r={8} 
                                fill="#22c55e" 
                                stroke="#fff" 
                                strokeWidth={2}
                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                onMouseDown={(e) => handlePointPick(drawing.id, 0, e)}
                                onTouchStart={(e) => handlePointPick(drawing.id, 0, e)}
                              />
                              <circle 
                                cx={p2.x} cy={p2.y} r={8} 
                                fill="#22c55e" 
                                stroke="#fff" 
                                strokeWidth={2}
                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                onMouseDown={(e) => handlePointPick(drawing.id, 1, e)}
                                onTouchStart={(e) => handlePointPick(drawing.id, 1, e)}
                              />
                              <circle 
                                cx={p3.x} cy={p3.y} r={8} 
                                fill="#22c55e" 
                                stroke="#fff" 
                                strokeWidth={2}
                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                onMouseDown={(e) => handlePointPick(drawing.id, 2, e)}
                                onTouchStart={(e) => handlePointPick(drawing.id, 2, e)}
                              />
                            </>
                          )}
                        </g>
                      );
                    }
                    
                    // Horizontal line - render SVG clickable overlay (label is shown on price axis via createPriceLine)
                    if (drawing.type === 'horizontal' && drawing.points.length >= 1) {
                      // If point is being edited, hide until replaced
                      if (isPointBeingEdited(0)) {
                        return (
                          <g key={drawing.id}>
                            <text x={50} y={300} fill="#fff" fontSize="12">Click to place horizontal line</text>
                          </g>
                        );
                      }
                      const y = candleSeriesRef.current?.priceToCoordinate(drawing.points[0].price) ?? 0;
                      const chartWidth = chartContainerRef.current?.clientWidth || 800;
                      
                      return (
                        <g key={drawing.id} onClick={handleClick} style={{ cursor: chartControls.drawingMode === 'select' ? 'pointer' : 'default' }}>
                          {/* Invisible thicker line for easier clicking */}
                          <line 
                            x1={0} y1={y} x2={chartWidth} y2={y}
                            stroke="transparent"
                            strokeWidth={12}
                          />
                          {/* Selection highlight overlay */}
                          {isSelected && (
                            <>
                              <line 
                                x1={0} y1={y} x2={chartWidth} y2={y}
                                stroke="#22c55e"
                                strokeWidth={3}
                                strokeDasharray="0"
                              />
                              {/* Drag handle for horizontal line */}
                              <circle 
                                cx={50} cy={y} r={8} 
                                fill="#22c55e" 
                                stroke="#fff" 
                                strokeWidth={2}
                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                onMouseDown={(e) => handlePointPick(drawing.id, 0, e)}
                                onTouchStart={(e) => handlePointPick(drawing.id, 0, e)}
                              />
                              <circle 
                                cx={chartWidth - 50} cy={y} r={8} 
                                fill="#22c55e" 
                                stroke="#fff" 
                                strokeWidth={2}
                                style={{ cursor: 'grab', pointerEvents: 'auto' }}
                                onMouseDown={(e) => handlePointPick(drawing.id, 0, e)}
                                onTouchStart={(e) => handlePointPick(drawing.id, 0, e)}
                              />
                            </>
                          )}
                        </g>
                      );
                    }
                    
                    return null;
                  })}
                  
                  {/* Temp drawing preview */}
                  {tempDrawing && tempDrawing.points.length > 0 && chartControls.chartReady && (
                    (() => {
                      const toPixel = (point: { time: number; price: number }) => {
                        const x = chartRef.current?.timeScale().timeToCoordinate(point.time as any);
                        const y = candleSeriesRef.current?.priceToCoordinate(point.price);
                        return { x: x ?? 0, y: y ?? 0 };
                      };
                      
                      return tempDrawing.points.map((point, i) => {
                        const p = toPixel(point);
                        return (
                          <circle 
                            key={i} 
                            cx={p.x} 
                            cy={p.y} 
                            r={6} 
                            fill="#3b82f6" 
                            stroke="#fff" 
                            strokeWidth={2}
                          />
                        );
                      });
                    })()
                  )}
                </svg>
                
                {/* Drawing Tools Overlay - Only show in fullscreen */}
                {isFullscreen && (
                  <div className="absolute top-2 left-2 z-20 flex gap-1">
                    {/* Pencil/Draw Button */}
                    <button
                      onClick={() => setShowToolPicker(prev => !prev)}
                    className={`p-2 rounded-lg transition-all ${
                      chartControls.drawingMode === 'draw' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-slate-800/90 text-gray-300 hover:bg-slate-700'
                    }`}
                    title="Drawing Tools"
                    data-testid="btn-drawing-tools"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  
                  {/* Select/Cursor Button */}
                  <button
                    onClick={() => {
                      chartControls.setDrawingMode(chartControls.drawingMode === 'select' ? 'off' : 'select');
                      if (activeTool === 'elliott_wave') elliottWave.deactivateMode();
                      setActiveTool(null);
                      setShowToolPicker(false);
                    }}
                    className={`p-2 rounded-lg transition-all ${
                      chartControls.drawingMode === 'select' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-slate-800/90 text-gray-300 hover:bg-slate-700'
                    }`}
                    title="Select/Edit Drawings"
                    data-testid="btn-select-drawings"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                  </button>
                  
                  {/* Deselect/Cancel Button */}
                  <button
                    onClick={() => {
                      chartControls.setDrawingMode('off');
                      if (activeTool === 'elliott_wave') elliottWave.deactivateMode();
                      setActiveTool(null);
                      setShowToolPicker(false);
                      setSelectedDrawingId(null);
                      setTempDrawing(null);
                    }}
                    className="p-2 rounded-lg bg-slate-800/90 text-gray-300 hover:bg-slate-700 transition-all"
                    title="Exit Drawing Mode"
                    data-testid="btn-deselect-drawing"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  
                  {/* Settings Button - only show when a drawing is selected */}
                  {selectedDrawingId && (
                    <button
                      onClick={() => modals.toggleModal('drawing-settings')}
                      className={`p-2 rounded-lg transition-all ${modals.isOpen('drawing-settings') ? 'bg-blue-500 text-white' : 'bg-slate-800/90 text-gray-300 hover:bg-slate-700'}`}
                      title="Drawing Settings"
                      data-testid="btn-drawing-settings"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Alert Settings Button - only show when a drawing is selected */}
                  {selectedDrawingId && (
                    <button
                      onClick={() => setAlertSettingsOpen(true)}
                      className={`p-2 rounded-lg transition-all ${alertSettingsOpen ? 'bg-amber-500 text-white' : 'bg-slate-800/90 text-gray-300 hover:bg-slate-700'}`}
                      title="Alert Settings"
                      data-testid="btn-alert-settings"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Delete Selected Button - only show when a drawing is selected */}
                  {selectedDrawingId && (
                    <button
                      onClick={() => {
                        deleteDrawing(selectedDrawingId);
                        modals.closeModal('drawing-settings');
                        // Toast will be shown by the hook
                      }}
                      className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all animate-pulse"
                      title="Delete Selected Drawing"
                      data-testid="btn-delete-selected"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                  
                  {/* Auto-Snap Toggle Button (Magnet Icon) */}
                  <button
                    onClick={() => {
                      setAutoSnapEnabled(prev => !prev);
                      toast({ 
                        title: autoSnapEnabled ? 'Auto-Snap Disabled' : 'Auto-Snap Enabled',
                        description: autoSnapEnabled ? 'Points will be placed exactly where you tap' : 'Points will snap to nearest high/low'
                      });
                    }}
                    className={`p-2 rounded-lg transition-all ${
                      autoSnapEnabled 
                        ? 'bg-yellow-500 text-white' 
                        : 'bg-slate-800/90 text-gray-300 hover:bg-slate-700'
                    }`}
                    title={autoSnapEnabled ? 'Auto-Snap: ON (click to disable)' : 'Auto-Snap: OFF (click to enable)'}
                    data-testid="btn-auto-snap"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M6 15V9a6 6 0 1 1 12 0v6" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M6 15a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M18 15a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M6 15v4" strokeLinecap="round"/>
                      <path d="M18 15v4" strokeLinecap="round"/>
                    </svg>
                  </button>
                  
                  {/* Fullscreen Toggle Button */}
<button
  onClick={() => {
    setIsFullscreen(prev => !prev);
    // Resize chart after a short delay to allow DOM to update
    setTimeout(() => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight
        });
        chartRef.current.timeScale().fitContent();
      }
    }, 100);
  }}
  className="p-2 rounded-lg bg-slate-800/90 text-gray-300 hover:bg-slate-700 transition-all"
  title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
>
                    {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                  </button>
                  
                  {/* Hide/Show Drawings Toggle Button */}
                  <button
                    onClick={() => {
                      setDrawingsVisible(prev => !prev);
                      toast({ 
                        title: drawingsVisible ? 'Drawings Hidden' : 'Drawings Visible',
                        description: drawingsVisible ? 'All drawings are now hidden' : 'All drawings are now visible'
                      });
                    }}
                    className={`p-2 rounded-lg transition-all ${
                      drawingsVisible 
                        ? 'bg-slate-800/90 text-gray-300 hover:bg-slate-700' 
                        : 'bg-orange-500 text-white'
                    }`}
                    title={drawingsVisible ? 'Hide Drawings' : 'Show Drawings'}
                    data-testid="btn-toggle-drawings"
                  >
                    {drawingsVisible ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    )}
                  </button>
                  
                  {/* Auto-Color Toggle Button (Palette Icon) */}
                  <button
                    onClick={() => {
                      setAutoColorEnabled(prev => !prev);
                      toast({ 
                        title: autoColorEnabled ? 'Auto-Color Disabled' : 'Auto-Color Enabled',
                        description: autoColorEnabled ? 'All drawings will be blue' : 'Green=support, Red=resistance, Blue=mixed'
                      });
                    }}
                    className={`p-2 rounded-lg transition-all ${
                      autoColorEnabled 
                        ? 'bg-gradient-to-r from-green-500 via-blue-500 to-red-500 text-white' 
                        : 'bg-slate-800/90 text-gray-300 hover:bg-slate-700'
                    }`}
                    title={autoColorEnabled ? 'Auto-Color: ON (click to disable)' : 'Auto-Color: OFF (click to enable)'}
                    data-testid="btn-auto-color"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="7.5" cy="11.5" r="1.5" fill="currentColor"/>
                      <circle cx="12" cy="7.5" r="1.5" fill="currentColor"/>
                      <circle cx="16.5" cy="11.5" r="1.5" fill="currentColor"/>
                    </svg>
                  </button>
                  
                  {/* Clear All Button */}
                  <button
                    onClick={() => {
                      if (drawings.length > 0 && confirm('Clear all drawings?')) {
                        clearDrawings();
                        setSelectedDrawingId(null);
                        // Toast will be shown by the hook
                      }
                    }}
                    className="p-2 rounded-lg bg-slate-800/90 text-gray-300 hover:bg-red-600 hover:text-white transition-all"
                    title="Clear All Drawings"
                    data-testid="btn-clear-drawings"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>

                </div>
              )}

                 {/* Fullscreen Header Bar - Ticker and Timeframe */}
              {isFullscreen && (
                <ChartControls
                  symbol={isFullscreen ? fullscreenSymbol : symbol}
                  interval={isFullscreen ? fullscreenInterval : interval}
                  onSymbolChange={isFullscreen ? setFullscreenSymbol : setSymbol}
                  onIntervalChange={isFullscreen ? handleFullscreenIntervalChange : setTimeframeInterval}
                  watchlistTickers={watchlistTickers}
                  isFullscreen={isFullscreen}
                />
              )}
                
                {/* Tool Picker Popup */}
                {isFullscreen && showToolPicker && (
                  <div className="absolute top-14 left-2 z-30 bg-slate-900 border border-slate-600 rounded-lg p-2 shadow-xl min-w-[180px]">
                    <div className="text-xs text-gray-400 mb-2 px-2">Select Drawing Tool</div>
                    {[
                      { id: 'trendline', name: 'Trend Line', icon: '📈' },
                      { id: 'horizontal', name: 'Horizontal Line', icon: '➖' },
                      { id: 'rectangle', name: 'Rectangle', icon: '⬜' },
                      { id: 'fib_retracement', name: 'Fib Retracement', icon: '📊' },
                      { id: 'trend_fib', name: 'Trend-Based Fib', icon: '📉' },
                      { id: 'channel', name: 'Channel', icon: '🐻‍❄️' },
                      { id: 'elliott_wave', name: 'Elliott Wave', icon: '〰️' },
                    ].map(tool => (
                      <button
                        key={tool.id}
                        onClick={() => {
                          if (tool.id === 'elliott_wave') {
                            if (activeTool === 'elliott_wave') {
                              setActiveTool(null);
                              elliottWave.deactivateMode();
                            } else {
                              setActiveTool('elliott_wave' as DrawingTool);
                              chartControls.setDrawingMode('draw');
                              elliottWave.activateMode();
                            }
                            setShowToolPicker(false);
                          } else {
                            setActiveTool(tool.id as DrawingTool);
                            chartControls.setDrawingMode('draw');
                            setShowToolPicker(false);
                            setTempDrawing({ points: [] });
                            toast({ title: `${tool.name} Selected`, description: 'Click on chart to place points' });
                          }
                        }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-700 transition-all text-left ${
                          activeTool === tool.id ? 'bg-blue-500/30 text-blue-300' : 'text-gray-300'
                        }`}
                        data-testid={`tool-${tool.id}`}
                      >
                        <span>{tool.icon}</span>
                        <span className="text-sm">{tool.name}</span>
                      </button>
                    ))}
                  </div>
                )}
                
                {/* Drawing Settings Panel (if any comes next) */}
                {modals.isOpen('drawing-settings') && selectedDrawingId && (
                <DrawingSettingsPanel
                  drawing={drawings.find(d => d.id === selectedDrawingId) || null}
                  onUpdate={(updates) => {
                    const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);
                    if (!selectedDrawing) return;
                    
                    const mergedStyle = { ...selectedDrawing.style, ...(updates.style || updates) };
                    // Update local state
                    setDrawings(prev => prev.map(d =>
                      d.id === selectedDrawingId
                      ? { ...d, style: mergedStyle }
                      : d
                    ));
                    // Update primitive for immediate visual feedback
                    const primitive = drawingPrimitivesRef.current.get(selectedDrawingId);
                    if (primitive && typeof primitive.updateStyle === 'function') {
                      primitive.updateStyle(mergedStyle);
                    }

                    // Save to database
                    updateDrawing({ id: selectedDrawingId, style: mergedStyle });
                  }}
                  onClose={() => {
                    modals.closeModal('drawing-settings');
                    setSelectedDrawingId(null);
                  }}
               />
            )}
                                   
                {/* Active Tool Indicator */}
                {activeTool && chartControls.drawingMode === 'draw' && (
                  <div className="absolute top-2 left-44 z-20 bg-blue-500/90 text-white px-3 py-1 rounded-lg text-xs font-medium">
                    Drawing: {activeTool.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    {tempDrawing && activeTool !== 'elliott_wave' && ` (${tempDrawing.points.length}/${activeTool === 'horizontal' ? 1 : 2} points)`}
                  </div>
                )}


              </div>
            )}
            
            {/* Chart Controls - Tabbed Interface */}
            {!loading && (
              <div ref={chartControls.chartControlsRef}>
                <SettingsPanel
                  isPaidTier={isPaidTier}
                  indicators={indicators}
                  handleSMCToolToggle={handleSMCToolToggle}
                  handleTrendToolToggle={handleTrendToolToggle}
                  handleOscillatorToggle={handleOscillatorToggle}
                  cvdSpikeEnabled={cvdSettings.enabled}
                  setCvdSpikeEnabled={cvdSettings.setEnabled}
                  cvdSpikeLevel1Input={cvdSettings.level1Input}
                  setCvdSpikeLevel1Input={cvdSettings.setLevel1Input}
                  cvdSpikeLevel1={cvdSettings.level1}
                  setCvdSpikeLevel1={cvdSettings.setLevel1}
                  cvdSpikeLevel2Input={cvdSettings.level2Input}
                  setCvdSpikeLevel2Input={cvdSettings.setLevel2Input}
                  cvdSpikeLevel2={cvdSettings.level2}
                  setCvdSpikeLevel2={cvdSettings.setLevel2}
                  cvdSpikeLevel3Input={cvdSettings.level3Input}
                  setCvdSpikeLevel3Input={cvdSettings.setLevel3Input}
                  cvdSpikeLevel3={cvdSettings.level3}
                  setCvdSpikeLevel3={cvdSettings.setLevel3}
                  fvgVolumeThreshold={chartSettings.legacy.fvgVolumeThreshold}
                  setFvgVolumeThreshold={chartSettings.legacy.setFvgVolumeThreshold}
                  chartBosSwingLengthInput={chartSettings.bos.swingLengthInput}
                  setChartBosSwingLengthInput={chartSettings.bos.setSwingLengthInput}
                  chartBosSwingLength={chartSettings.bos.swingLength}
                  setChartBosSwingLength={chartSettings.bos.setSwingLength}
                  chartChochSwingLengthInput={chartSettings.choch.swingLengthInput}
                  setChartChochSwingLengthInput={chartSettings.choch.setSwingLengthInput}
                  chartChochSwingLength={chartSettings.choch.swingLength}
                  setChartChochSwingLength={chartSettings.choch.setSwingLength}
                  chartLiquiditySweepSwingLengthInput={chartSettings.liquiditySweep.swingLengthInput}
                  setChartLiquiditySweepSwingLengthInput={chartSettings.liquiditySweep.setSwingLengthInput}
                  chartLiquiditySweepSwingLength={chartSettings.liquiditySweep.swingLength}
                  setChartLiquiditySweepSwingLength={chartSettings.liquiditySweep.setSwingLength}
                  setLocation={setLocation}
                  interval={interval}
                  saveToTimeframe={saveToTimeframe}
                  makeTimeframeDefault={makeTimeframeDefault}
                  loading={loading}
                  chartControlsTab={chartControls.activeTab || 'smc'}
                  setChartControlsTab={(tab: string) => chartControls.setActiveTab(tab as 'smc' | 'trend' | 'vwap' | 'oscillators')}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Control Button Bar - Always visible below chart */}
        {!isFullscreen && !loading && (
          <div className="flex items-center gap-2 py-3 bg-slate-900/50 rounded-lg px-4 mb-4">
            {/* Oscillator Panel Toggle Button */}
            <button
              onClick={() => {
                console.log('Oscillator button clicked, current state:', panels.oscillatorPanel);
                panels.togglePanel('oscillatorPanel');
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                panels.oscillatorPanel 
                  ? 'bg-purple-500 text-white' 
                  : 'bg-slate-800/90 text-gray-300 hover:bg-slate-700'
              }`}
              title="Toggle Oscillators Panel"
              data-testid="btn-oscillator-panel"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
              <span className="font-medium">Oscillators</span>
            </button>
          </div>
        )}

{/* Oscillator Charts - Conditionally rendered based on oscillator panel state and enabled oscillators */}
{!isFullscreen && panels.oscillatorPanel && (indicators.rsi.show || indicators.stochRSI.show || indicators.macd.show || indicators.obv.show || indicators.williamsR.show || indicators.mfi.show || indicators.cci.show || indicators.adx.show) && (
  <OscillatorContainer
    indicators={indicators}
    candles={candles}
    onOscillatorChartCreated={handleOscillatorChartCreated}
    getMainChartVisibleRange={getMainChartVisibleRange}
    isPaidTier={isPaidTier}
    getIndicatorReport={getIndicatorReport}
    getOscillatorDivergence={getOscillatorDivergenceWrapper}
  />
)}
                {/* Fullscreen Oscillator Panel Component */}
      <FullscreenOscillatorPanel
        isVisible={isFullscreen && panels.oscillatorPanel}
        onClose={() => panels.togglePanel('oscillatorPanel')}
        candles={candles}
        mainChartRef={chartRef}
        rsiPeriod={indicators.rsi.period}
        macdFast={indicators.macd.fast}
        macdSlow={indicators.macd.slow}
        macdSignal={indicators.macd.signal}
        stochRSIPeriod={indicators.stochRSI.period}
        cciPeriod={indicators.cci.period}
        williamsRPeriod={indicators.williamsR.period}
        calculateRSI={calculateRSI}
        calculateMACD={calculateMACD}
        calculateStochRSI={calculateStochRSI}
        calculateCCI={calculateCCI}
        calculateWilliamsR={calculateWilliamsR}
      />

        {/* 2x2 Grid on Desktop: Grok Summary, Alerts, Footprint, Indicators */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Market Summary */}
        <MarketSummaryCard
          tier={tier as 'free' | 'intermediate' | 'professional'}
          grokLogo={grokLogo}
          minimized={panels.marketSummary}
          onToggleMinimize={() => panels.togglePanel('marketSummary')}
          analysis={aiAnalysisState.analysis}
          loading={aiAnalysisState.loading}
          timestamp={aiAnalysisState.timestamp}
          candlesLength={candles.length}
          onRefresh={() => fetchAIAnalysis(true)}
          onUpgrade={() => window.location.href = '/cryptosubscribe'}
        />

        {/* Footprint Delta Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => panels.togglePanel('cvdTable')}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <span className={`transition-transform duration-200 ${panels.cvdTable ? '' : 'rotate-90'}`}>▶</span>
                <span className="text-lg">📊</span>
                Delta Vs CVD
              </CardTitle>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <ExchangeStatusPopover
                  multiExchangeData={multiExchangeData}
                  multiExchangeLoading={multiExchangeLoading}
                  useMultiExchange={useMultiExchange}
                />
                </div>
              </div>
              </CardHeader>
              {!panels.cvdTable && (
              <CardContent>
                <CVDTable
                  data={deltaHistory}
                  useMultiExchange={useMultiExchange}
                  cvdSpikeLevel1={cvdSettings.level1}
                  cvdSpikeLevel2={cvdSettings.level2}
                  cvdSpikeLevel3={cvdSettings.level3}
                  tableLimit={getTableRowLimit(interval)}
                />
              </CardContent>
              )}
        </Card>

        {/* Market Alerts */}
        {tier !== 'free' && (
          <MarketAlertsPanel
            alerts={marketAlerts}
            filterMode={alertFilterMode}
            onFilterModeChange={setAlertFilterMode}
            onSettingsClick={() => modals.openModal('alert-settings')}
            activeIndicators={activeIndicators}
            alertTypeToIndicator={alertTypeToIndicator}
          />
        )}

        </div>
        {/* End of 2x2 Grid */}

        {/* Unlock AI Analysis CTA */}
        <Card className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border-purple-500/30 p-4 text-center">
          <div className="max-w-2xl mx-auto space-y-2">
            <h2 className="text-xl font-bold text-white">AI technical scenarios</h2>
            <p className="text-gray-300 text-sm">
              Core, Pro and Elite plans add educational AI technical scenarios: cross-timeframe confluence readings, 
              notifications and custom filters. Automated analysis only, not financial advice.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
              <div className="flex items-center gap-1">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span>AI technical scenarios</span>
              </div>
              <div className="flex items-center gap-1">
                <Bell className="w-4 h-4 text-blue-400" />
                <span>Push Notifications</span>
              </div>
              <div className="flex items-center gap-1">
                <Activity className="w-4 h-4 text-green-400" />
                <span>Custom Filters</span>
              </div>
            </div>
            <Button
              onClick={() => window.location.href = '/cryptoai'}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 text-base font-semibold"
              data-testid="button-unlock-ai"
            >
              See AI plans - from £15/month
            </Button>
          </div>
        </Card>

        {/* AI Analysis Navigation Button */}
        <div className="flex items-center justify-center gap-4 pb-8">
          <button
            onClick={() => setLocation('/cryptoai')}
            className="group relative flex flex-col items-center justify-center transition-transform hover:scale-105"
            data-testid="button-navigate-ai-page"
          >
            <div className="w-32 h-32 rounded-full overflow-hidden shadow-2xl border-4 border-white/20 hover:border-white/40 transition-all">
              <video 
                src={aiButtonVideo}
                autoPlay 
                loop 
                muted 
                playsInline
                className="w-full h-full object-cover"
              />
            </div>
          </button>
        </div>

        {/* Disclaimer Section */}
        <div className="max-w-4xl mx-auto px-4 pb-6 text-center">
          <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-3">
              <strong className="text-gray-400">Disclaimer:</strong> This platform is for educational and informational purposes only. 
              We do not provide financial, investment, or trading advice. All trading involves risk, and you should conduct your own 
              research before making any investment decisions. Past performance does not guarantee future results.
            </p>
            <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
              <a 
                href="/privacy" 
                className="hover:text-blue-400 transition-colors"
                data-testid="link-privacy-policy"
              >
                Privacy Policy
              </a>
              <span className="text-gray-700">•</span>
              <a 
                href="/terms" 
                className="hover:text-blue-400 transition-colors"
                data-testid="link-terms-of-service"
              >
                Terms of Service
              </a>
              <span className="text-gray-700">•</span>
              <a 
                href="mailto:support@beartec.io" 
                className="hover:text-blue-400 transition-colors"
                data-testid="link-contact"
              >
                Contact Us
              </a>
            </div>
          </div>
        </div>

        {/* Alert Settings Dialog */}
        <AlertSettingsDialog
          open={modals.isOpen('alert-settings')}
          onOpenChange={(open) => open ? modals.openModal('alert-settings') : modals.closeModal('alert-settings')}
        />

        {/* Settings Dialog - Simplified for Phase 4G-7 */}
        <SettingsDialog
          open={modals.isOpen('settings-dialog')}
          onOpenChange={(open) => open ? modals.openModal('settings-dialog') : modals.closeModal('settings-dialog')}
          indicators={{
            rsi: { show: indicators.rsi.show, period: indicators.rsi.period },
            macd: { show: indicators.macd.show, fast: indicators.macd.fast, slow: indicators.macd.slow, signal: indicators.macd.signal },
            stochastic: { show: indicators.stochRSI.show, period: indicators.stochRSI.period },
            obv: { show: indicators.obv.show },
            mfi: { show: indicators.mfi.show, period: indicators.mfi.period },
            williamsR: { show: indicators.williamsR.show },
            cci: { show: indicators.cci.show },
            adx: { show: indicators.adx.show },
            bollingerBands: { show: indicators.bb.show, period: indicators.bb.period },
            atr: { show: false, period: 14 },
            fvg: { show: indicators.smc.showFVG, showHighValueOnly: indicators.smc.showHighValueOnly },
            bos: { show: indicators.smc.showBOS },
            choch: { show: indicators.smc.showCHoCH },
            orderBlocks: { show: indicators.smc.showOrderBlocks },
            ema: { show: indicators.ema.show, fastPeriod: indicators.ema.fastPeriod, slowPeriod: indicators.ema.slowPeriod },
            sma: { show: indicators.sma.show, period: indicators.sma.fastPeriod },
          }}
          onUpdateIndicator={(indicator, updates) => {
            // Simplified handler - logs for now, full implementation would map to setters
            console.log('Update indicator:', indicator, updates);
          }}
          chartTheme="dark"
          apiKeys={apiKeys}
          onUpdateApiKey={(provider, key) => {
            setApiKeys(prev => ({ ...prev, [provider]: key }));
            localStorage.setItem(`${provider}_api_key`, key);
          }}
        />

        {/* Confirmation Dialog */}
        <ConfirmationDialog
          isOpen={modalManager.isModalOpen('delete-drawing')}
          onClose={modalManager.closeModal}
          onConfirm={() => {
            const drawingId = modalManager.modalData?.id;
            if (drawingId) {
              setDrawings(prev => prev.filter(d => d.id !== drawingId));
              setSelectedDrawingId(null);
              toast({
                title: 'Drawing deleted',
                description: 'The drawing has been removed from the chart.'
              });
            }
            modalManager.closeModal();
          }}
          title="Delete Drawing"
          description="Are you sure you want to delete this drawing? This action cannot be undone."
          variant="destructive"
        />

        {/* Drawing Alert Settings Modal */}
        <DrawingAlertSettings
          isOpen={alertSettingsOpen}
          onClose={() => setAlertSettingsOpen(false)}
          drawing={selectedDrawingId ? {
            id: selectedDrawingId,
            drawingType: drawings.find(d => d.id === selectedDrawingId)?.type || 'horizontal',
            symbol: symbol,
            timeframe: interval,
            style: drawings.find(d => d.id === selectedDrawingId)?.style,
          } : null}
          onUpdate={(updates) => {
            const selectedDrawing = drawings.find(d => d.id === selectedDrawingId);
            if (!selectedDrawing || !selectedDrawingId) return;
            
            // Update local state
            setDrawings(prev => prev.map(d =>
              d.id === selectedDrawingId
              ? { ...d, style: updates.style }
              : d
            ));
            
            // Update primitive for immediate visual feedback
            const primitive = drawingPrimitivesRef.current.get(selectedDrawingId);
            if (primitive && typeof primitive.updateStyle === 'function') {
              primitive.updateStyle(updates.style);
            }

            // Save to database
            drawingsPersistence.updateDrawing({ id: selectedDrawingId, updates: { style: updates.style } });
            
            toast({
              title: 'Alert settings saved',
              description: 'Your alert configuration has been updated.',
            });
          }}
        />

      </div>
      
      {/* Chart Overlay Components - Render indicators and overlays */}
      <MovingAverages
        chart={chartRef.current}
        maConfigs={indicators.ema.configs}
        show={indicators.ema.show}
        candles={candles}
        calculateEMA={calculateEMA}
        emaHTFDataCache={emaHTFDataCache}
        symbol={symbol}
        interval={interval}
      />
      
      <FVGOverlay
        chart={chartRef.current}
        fvgs={fvgsData}
        show={indicators.smc.showFVG}
        candles={candles}
        activeTradeFVGTimes={new Set()} // Empty since trading features removed - only show unfilled FVGs
        isActiveFVG={isActiveFVG}
        getFVGFillTime={getFVGFillTime}
        showHighValueOnly={indicators.smc.showHighValueOnly}
      />
      
      <OrderBlockOverlay
        chart={chartRef.current}
        orderBlocks={orderBlocksData}
        show={indicators.smc.showOrderBlocks}
        candles={candles}
      />
      
      <BOSCHoCHMarkers
        chart={chartRef.current}
        bosEvents={bosChochData.bos}
        chochEvents={bosChochData.choch}
        showBOS={indicators.smc.showBOS}
        showCHoCH={indicators.smc.showCHoCH}
        candles={candles}
      />
      
      <SupertrendOverlay
        chart={chartRef.current}
        supertrendData={supertrendData}
        show={indicators.supertrend.show}
      />
      
      <VWAPOverlay
        chart={chartRef.current}
        vwapData={vwapData}
        show={indicators.vwapTools.showBands}
      />
      
      <SessionVWAPOverlay
        chart={chartRef.current}
        asiaVWAP={sessionVWAPData.asia}
        londonVWAP={sessionVWAPData.london}
        nyVWAP={sessionVWAPData.ny}
        show={indicators.vwapTools.showSession}
      />
      
      <ParabolicSAROverlay
        chart={chartRef.current}
        psarData={psarData}
        show={indicators.parabolicSAR.show}
      />
      
      <BollingerBandsOverlay
        chart={chartRef.current}
        bbData={bbData}
        show={indicators.bb.show}
      />
      
      {/* Bottom Navigation */}
      <CryptoNavigation />
      
      {/* Spacer for fixed navigation */}
      <div className="h-20"></div>
    </div>
    </>
  );
}
