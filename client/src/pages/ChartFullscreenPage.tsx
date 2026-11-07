// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Time, createSeriesMarkers, type ISeriesMarkersPluginApi } from 'lightweight-charts';
import { useToast } from '@/hooks/use-toast';
import { useDrawingHistory } from '@/hooks/useDrawingHistory';
import { useElliottWaveLabels } from '@/hooks/useElliottWaveLabels';
import { useWaveSelection } from '@/hooks/useWaveSelection';
import { useElliottWaveRendering } from '@/hooks/useElliottWaveRendering';
import { useElliottWaveKeyboardShortcuts } from '@/hooks/useElliottWaveKeyboardShortcuts';
import { useElliottWaveController } from '@/hooks/useElliottWaveController';
import { useFullscreenDrawingActions } from '@/hooks/useFullscreenDrawingActions';
import { useSaveDrawingWithUndo } from '@/hooks/useSaveDrawingWithUndo';
import { useFullscreenChartLifecycle } from '@/hooks/useFullscreenChartLifecycle';
import { useHydratedDrawings } from '@/hooks/useHydratedDrawings';
import { useFullscreenKeyboardShortcuts } from '@/hooks/useFullscreenKeyboardShortcuts';
import { useFullscreenModalHelpers } from '@/hooks/useFullscreenModalHelpers';

// New extraction hooks
import { useChartInstance } from '@/hooks/useChartInstance';
import { useDrawingInteraction } from '@/hooks/useDrawingInteraction';
import { useOscillatorPanel } from '@/hooks/useOscillatorPanel';
import { useDrawingPrimitives } from '@/hooks/useDrawingPrimitives';
import { useHTFDataCache } from '@/hooks/useHTFDataCache';

// Existing hooks
import { useCandleData } from '@/hooks/useCandleData';
import { falconSafeTimeframe, isFalconCandleTimeframe, isFalconTicker } from '@/lib/tickerUtils';
import { FalconChartStatusBanner } from '@/components/falcon/FalconChartStatusBanner';
import { useOscillatorData } from '@/hooks/useOscillatorData';
import { useDrawingsPersistence } from '@/hooks/useDrawingsPersistence';
import { useIndicatorState } from '@/hooks/useIndicatorState';
import { useChartGestures, type GesturePoint } from '@/hooks/useChartGestures';
import { useElliottWave } from '@/hooks/usePredictiveElliottWave';

// New extraction components
import { FullscreenChartToolbar } from '@/components/chart/FullscreenChartToolbar';
import { FullscreenChartActionToolbar } from '@/components/chart/FullscreenChartActionToolbar';
import { FullscreenChartIndicatorLayer } from '@/components/chart/FullscreenChartIndicatorLayer';
import { FullscreenChartModals } from '@/components/chart/FullscreenChartModals';
import { FullscreenChartViewportLayer } from '@/components/chart/FullscreenChartViewportLayer';
import { FullscreenOscillatorLayout } from '@/components/oscillators/FullscreenOscillatorLayout';
import { TideCrossMarkers } from '@/components/indicators/TideCrossMarkers';
import { TetherDivergenceOverlay } from '@/components/indicators/TetherDivergenceOverlay';
import { useTetherDivergenceSettings } from '@/hooks/useTetherDivergenceSettings';
import { useTetherDivergence } from '@/hooks/useTetherDivergence';

import { useSuperTrendSettings } from '@/hooks/useSuperTrendSettings';
import { useSuperTrendCalculation } from '@/hooks/useSuperTrendCalculation';
import { useVolumeProfileSettings } from '@/hooks/useVolumeProfileSettings';
import { useVisibleRange } from '@/hooks/useVisibleRange';
import { useVolumeProfileCalculation } from '@/hooks/useVolumeProfileCalculation';
import { useLiquidityHeatmapSettings } from '@/hooks/useLiquidityHeatmapSettings';
import { useLiquidityHeatmapData } from '@/hooks/useLiquidityHeatmapData';
import { useLiquidityPivotAnalysis } from '@/hooks/useLiquidityPivotAnalysis';
import { useFVGSettings } from '@/hooks/useFVGSettings';
import { useFVGDetection } from '@/hooks/useFVGDetection';
import { useOrderBlockSettings } from '@/hooks/useOrderBlockSettings';
import { useOrderBlockDetection } from '@/hooks/useOrderBlockDetection';
import { useBreakerSettings } from '@/hooks/useBreakerSettings';
import { useBOSSettings } from '@/hooks/useBOSSettings';
import { useBOSDetection } from '@/hooks/useBOSDetection';
import { useLiquiditySettings } from '@/hooks/useLiquiditySettings';
import { useLiquidityDetection } from '@/hooks/useLiquidityDetection';
import { usePDZoneSettings } from '@/hooks/usePDZoneSettings';
import { usePDZoneDetection } from '@/hooks/usePDZoneDetection';
import { useAutoFibSettings } from '@/hooks/useAutoFibSettings';
import { useAutoFibDetection } from '@/hooks/useAutoFibDetection';
import { useAutoTrendlineSettings } from '@/hooks/useAutoTrendlineSettings';
import { useAutoTrendlineDetection } from '@/hooks/useAutoTrendlineDetection';
import { useSwoopSettings } from '@/hooks/useSwoopSettings';
import { useSwoopDetection } from '@/hooks/useSwoopDetection';
import { useVolumeEmaSettings } from '@/hooks/useVolumeEmaSettings';
import { DrawingRenderer } from '@/components/drawings/DrawingRenderer';
import { calculateEMA } from '@/lib/indicators';
import { useMultiTimeframeDivergenceScanner } from '@/hooks/useMultiTimeframeDivergenceScanner';
import { useDivergenceSettings } from '@/hooks/useDivergenceSettings';
import { DEFAULT_OSCILLATOR_CONFIG } from '@/lib/calculations/divergenceCalculations';
import type { TimeframeKey } from '@/lib/calculations/multiTimeframeDivergenceScoring';
import { WaveOverlayStack } from '@/components/elliottWave/WaveOverlayStack';
import { useHTFBias } from '@/hooks/useHTFBias';
import { useHTFBiasSettings } from '@/hooks/useHTFBiasSettings';
import { useTradingSystem, type TradingSystemCallbacks } from '@/hooks/useTradingSystem';
import { TRADING_SYSTEMS, type TradingSystemId } from '@/types/tradingSystems';
import { OWNER_ONLY_TRADING_SYSTEM_IDS, isOwnerOnlyTradingSystem } from '@/constants/ownerOnlyFeatures';
import { useShowOwnerOnlyTools } from '@/hooks/useShowOwnerOnlyTools';
import { useMultiSystemConfluence, type ConfluenceResult } from '@/hooks/useMultiSystemConfluence';
import { FloatingConfluenceMonitor } from '@/components/tradingSystems/FloatingConfluenceMonitor';
import { DraggableSystemInfoBox } from '@/components/tradingSystems/DraggableSystemInfoBox';
import { ActiveSystemMonitor } from '@/components/tradingSystems/ActiveSystemMonitor';
import { scoreSystem, buildSmcZoneInputs, type ScoringInput } from '@/lib/tradingSystemScoring';
import { runTradingSystemBacktest, type BacktestResult } from '@/lib/tradingSystemBacktest';
import { AlertSettingsDialog } from '@/components/AlertSettingsDialog';
import { DrawingAlertSettings } from '@/components/modals/DrawingAlertSettings';
import { RewindSettingsModal } from '@/components/modals/RewindSettingsModal';
import type { OscillatorModalConfig } from '@/components/modals/OscillatorSelectorModal';
import { useGDSMarketMetrics } from '@/hooks/indicators/useGDSMarketMetrics';
import { useGenuineDemandScore } from '@/hooks/indicators/useGenuineDemandScore';
import { GDSMiniBadge } from '@/components/indicators/GDSMiniBadge';
import { findMaximumOpportunityZones, type OpportunityZone } from '@/lib/confluenceAnalysis';
import { getConditionWeights } from '@/lib/conditionWeights';
import { resolveLiquidityPredictorConfig } from '@/lib/liquidityPredictorConfig';
import type { IPriceLine } from 'lightweight-charts';
import { RewindControls } from '@/components/chart/RewindControls';
import { useRewindSettings } from '@/hooks/useRewindSettings';
import { useUserSettings } from '@/hooks/useUserSettings';
import { findDrawingsNearClick } from '@/lib/drawingHitDetection';
import { readMainChartVisibleRange } from '@/lib/chart/syncOscillatorTimeScale';
// Defensive import: ensures Button is included in the ChartPage chunk scope.
// Child components (DrawingMenu, IndicatorMenu, ToolsMenu, TradingSystemsMenu)
// all use Button, but Vite's production scope-hoisting can drop the binding
// if no ancestor in the chunk explicitly imports it.
import { Button } from '@/components/ui/button';
// Trade tool
import { useManualTrades } from '@/hooks/useManualTrades';
import { TradePanel } from '@/components/trading/TradePanel';
import { TradeZoneRenderer } from '@/components/chart/TradeZoneRenderer';
import { FreeDrawToolbar } from '@/components/drawings/FreeDrawToolbar';
import { ChartPickOverlay } from '@/components/trading/ChartPickOverlay';
import type { TradePickField } from '@/components/trading/ChartPickOverlay';
// Types and constants
import type { Drawing, ChartDrawingTool, FreeDrawMode } from '@/types/drawing';
import type { DivergencePoint, MAConfig } from '@/types/chart.types';
import type { Candle } from '@/types/chart';
import { simplifyForLine, simplifyForCurve } from '@/lib/drawingUtils';

interface ChartFullscreenPageProps {
  onClose: () => void;
  initialSymbol: string;
  initialTimeframe: string;
  watchlistTickers: string[];
}

const TOTAL_CONFLUENCE_REFRESH_MS = 2 * 60 * 1000;

/** When free-draw mode is 'free', capture every Nth pixel point to limit array size */
const FREE_MODE_POINT_INTERVAL = 3;

// All possible oscillator panel IDs (must match OscillatorSelectorModal)
const ALL_OSCILLATOR_IDS = [
  'rsi', 'macd', 'waddah', 'cmf', 'volume', 'stochRsi', 'tsi',
  'williamsR', 'cci', 'adx', 'obv', 'mfi', 'klinger', 'tideZone', 'tetherDivergence', 'smartMoney', 'smcTrendEngine',
];

// Minimum number of candles required for meaningful indicator calculations during rewind
const MIN_REWIND_POSITION = 50;

function calculateSimpleMovingAverage(
  candles: Array<{ close: number }>,
  endIndex: number,
  period: number,
): number | undefined {
  if (endIndex < period - 1 || period <= 0) return undefined;
  let sum = 0;
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    sum += candles[i].close;
  }
  return sum / period;
}

function calculateAverageVolume(
  candles: Array<{ volume: number }>,
  endIndex: number,
  period: number,
): number | undefined {
  if (endIndex < period - 1 || period <= 0) return undefined;
  let sum = 0;
  for (let i = endIndex - period + 1; i <= endIndex; i++) {
    sum += candles[i].volume;
  }
  return sum / period;
}

function calculateSupportResistance(
  candles: Array<{ low: number; high: number }>,
  endIndex: number,
  lookback = 20,
): { supportLevel?: number; resistanceLevel?: number } {
  if (endIndex < 1) return {};
  const start = Math.max(0, endIndex - lookback + 1);
  let supportLevel = candles[start].low;
  let resistanceLevel = candles[start].high;

  for (let i = start + 1; i <= endIndex; i++) {
    supportLevel = Math.min(supportLevel, candles[i].low);
    resistanceLevel = Math.max(resistanceLevel, candles[i].high);
  }

  return { supportLevel, resistanceLevel };
}

function getSRLookback(timeframe: string): number {
  const lookbackByTimeframe: Record<string, number> = {
    '1m': 20, '3m': 20, '5m': 20, '15m': 30, '30m': 40,
    '1h': 40, '2h': 50, '4h': 60, '6h': 70, '12h': 75, '1d': 80, '1w': 100,
  };
  return lookbackByTimeframe[timeframe] ?? 20;
}

/** Thin adapter: converts the new graduated score to the legacy action+reasons format. */
function evaluateTradingSystemSignal(
  input: ScoringInput & { systemId: TradingSystemId; divergencePoints?: DivergencePoint[] },
) {
  const evaluation = scoreSystem(input.systemId, {
    ...input,
    divergencePoints: input.divergencePoints ?? [],
  });

  const buyThreshold = parseInt(
    localStorage.getItem(`tradingSystem_${input.systemId}_buyThreshold`) || '70',
    10,
  );
  const sellThreshold = parseInt(
    localStorage.getItem(`tradingSystem_${input.systemId}_sellThreshold`) || '70',
    10,
  );

  const action: 'OPEN LONG' | 'OPEN SHORT' | 'WAIT' =
    evaluation.score >= buyThreshold
      ? 'OPEN LONG'
      : evaluation.score <= -sellThreshold
        ? 'OPEN SHORT'
        : 'WAIT';

  const signalReasons =
    evaluation.reasoning && evaluation.reasoning.length > 0
      ? evaluation.reasoning
      : evaluation.conditions.filter(c => c.met).length > 0
        ? evaluation.conditions.filter(c => c.met).slice(0, 3).map(c => c.name)
        : ['No strong confluence yet'];

  return { action, signalReasons, evaluation };
}

export function ChartFullscreenPage({
  onClose,
  initialSymbol,
  initialTimeframe,
  watchlistTickers,
}: ChartFullscreenPageProps) {
  const showOwnerOnlyTools = useShowOwnerOnlyTools();
  // Core state
  const [symbol, setSymbol] = useState(initialSymbol);
  const [timeframe, setTimeframe] = useState(initialTimeframe);
  useEffect(() => {
    if (isFalconTicker(symbol) && !isFalconCandleTimeframe(timeframe)) {
      setTimeframe(falconSafeTimeframe(timeframe));
    }
  }, [symbol, timeframe]);

  // Keep the URL + local last-view in sync so refresh stays on BTC/1D (not the ticker
  // you originally opened the chart with).
  useEffect(() => {
    try {
      localStorage.setItem('chartLastView', JSON.stringify({ symbol, timeframe }));
    } catch {
      /* ignore quota */
    }
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('symbol') === symbol && url.searchParams.get('timeframe') === timeframe) {
      return;
    }
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('timeframe', timeframe);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }, [symbol, timeframe]);
  const [activeTool, setActiveTool] = useState<ChartDrawingTool>(null);
  const [freeDrawMode, setFreeDrawMode] = useState<FreeDrawMode>('line_assisted');
  const freeDrawModeRef = useRef<FreeDrawMode>('line_assisted');
  const [freeDrawColor, setFreeDrawColor] = useState('#3b82f6');
  const [freeDrawLineWidth, setFreeDrawLineWidth] = useState(2);
  const freeDrawColorRef = useRef('#3b82f6');
  const freeDrawLineWidthRef = useRef(2);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [drawingsVisible, setDrawingsVisible] = useState(true);
  const [activeEdit, setActiveEdit] = useState<{ drawingId: string; pointIndex: number; originalDrawing: Drawing } | null>(null);
  const [moveArmedDrawingId, setMoveArmedDrawingId] = useState<string | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [showEmaSmaModal, setShowEmaSmaModal] = useState(false);
  const [showSmcModal, setShowSmcModal] = useState(false);
  const [showAutoFibModal, setShowAutoFibModal] = useState(false);
  const [showSuperTrendModal, setShowSuperTrendModal] = useState(false);
  const [showVwapModal, setShowVwapModal] = useState(false);
  const [tempDrawing, setTempDrawing] = useState<{ points: { time: number; price: number; snapType?: 'high' | 'low' | 'none' }[] } | null>(null);

  // Incremented whenever the chart pans/zooms so we can recompute the SVG click overlay coords
  const [chartViewVersion, setChartViewVersion] = useState(0);
  // Degree picker state – shown when elliott_wave tool is activated
  const [showDegreePicker, setShowDegreePicker] = useState(false);
  const [selectedWaveDegree, setSelectedWaveDegree] = useState('Minor');
  const [selectedWaveLabel, setSelectedWaveLabel] = useState('1');
  const [selectedWavePatternType, setSelectedWavePatternType] = useState('impulse');

  const [highLowEnabled, setHighLowEnabled] = useState(false);
  // Force indicator overlays (High/Low) to re-bind after the chart instance exists
  const [chartEpoch, setChartEpoch] = useState(0);
  const [showVolumeEmaModal, setShowVolumeEmaModal] = useState(false);
  const [showAutoTrendlineModal, setShowAutoTrendlineModal] = useState(false);
  const [showSwoopModal, setShowSwoopModal] = useState(false);
  const [divergenceScannerEnabled, setDivergenceScannerEnabled] = useState(false);
  const [selectedDivergencePoint, setSelectedDivergencePoint] = useState<DivergencePoint | null>(null);
  const [showDivergenceSettings, setShowDivergenceSettings] = useState(false);
  // Volume Profile state
  const [showVPModal, setShowVPModal] = useState(false);
  // Liquidity Heatmap state
  const [showLHModal, setShowLHModal] = useState(false);
  // Rewind modal state
  const [showRewindModal, setShowRewindModal] = useState(false);
  // Alerts state
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [showDrawingAlertSettings, setShowDrawingAlertSettings] = useState(false);
  const [selectedDrawingForAlerts, setSelectedDrawingForAlerts] = useState<Drawing | null>(null);
  const [confluenceSnapshot, setConfluenceSnapshot] = useState<(ConfluenceResult & { updatedAt: number }) | null>(null);
  const [conditionWeightsVersion, setConditionWeightsVersion] = useState(0);

  const [showFloatingConfluence, setShowFloatingConfluence] = useState(() => {
    try {
      const saved = localStorage.getItem('floatingConfluenceVisible');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [activeSystemBacktestSignals, setActiveSystemBacktestSignals] = useState<BacktestResult | null>(null);

  const [maxOpportunityZones, setMaxOpportunityZones] = useState<OpportunityZone[]>([]);
  const [isAnalyzingOpportunities, setIsAnalyzingOpportunities] = useState(false);
  const opportunityPriceLinesRef = useRef<IPriceLine[]>([]);

  const [showGdsMiniBadge, setShowGdsMiniBadge] = useState(() => {
    try {
      const saved = localStorage.getItem('gdsMiniBadgeVisible');
      return saved ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Rewind: null = live, number = candle index to rewind to
  // Rewind state - null means LIVE
  const [rewindPosition, setRewindPosition] = useState<number | null>(null);
  // Rewind settings hook - placed here so handleToggleRewind can reference it
  const rewindSettings = useRewindSettings();

  // Trade tool state (data computed after effectiveCandles is available)
  const [showTradePanel, setShowTradePanel] = useState(false);
  const [tradePickMode, setTradePickMode] = useState<TradePickField | null>(null);
  const tradePickModeRef = useRef<TradePickField | null>(null);
  /** Incremented each time the user clicks the chart in pick mode; TradePanel watches this object reference */
  const [chartPickValue, setChartPickValue] = useState<{ price: number; time: number } | null>(null);

  // Refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const activeToolRef = useRef<ChartDrawingTool>(null);
  const lastUsedToolRef = useRef<ChartDrawingTool>('trendline');
  const dragEditStateRef = useRef<{
    drawingId: string;
    mode: 'point' | 'move';
    pointIndex?: number;
    startLogical: number;
    startPrice: number;
    basePoints: Drawing['points'];
    basePointLogicals: number[];
    latestPoints: Drawing['points'];
  } | null>(null);
  const chartPanZoomRestoreRef = useRef<{
    handleScroll: any;
    handleScale: any;
  } | null>(null);
  const suppressNextClickRef = useRef(false);
  const autoColorEnabledRef = useRef(true);
  const onPointCommitRef = useRef<((point: GesturePoint) => void) | null>(null);
  const systemSignalMarkersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const systemSignalMarkerHostSeriesRef = useRef<any>(null);
  // Hooks - Elliott Wave tool
  const elliottWave = useElliottWave();

  // User-level persistent settings (including drawing defaults).
  const { settings: userSettings, updateSettings: updateUserSettings } = useUserSettings();

  const drawingDefaultsByTool = useMemo(() => {
    const raw = userSettings?.drawingDefaults as any;
    return (raw?.byTool || {}) as Record<string, any>;
  }, [userSettings]);

  const [autoColorEnabled, setAutoColorEnabled] = useState(true);

  useEffect(() => {
    const raw = userSettings?.drawingDefaults as any;
    const enabled = raw?.autoColorEnabled;
    if (typeof enabled === 'boolean') {
      setAutoColorEnabled(enabled);
    }
  }, [userSettings]);

  useEffect(() => {
    autoColorEnabledRef.current = autoColorEnabled;
  }, [autoColorEnabled]);

  // Hooks - Toast notifications
  const { toast } = useToast();

  // Tier-based access control for SMC indicators
  const isPaidTier = true;

  const requirePaidForSMC = useCallback((_toolName: string, action: () => void) => {
    action();
  }, []);

  const persistDrawingDefaults = useCallback(async (payload: { tool: string; style: any }) => {
    const raw = userSettings?.drawingDefaults as any;
    const byTool = { ...(raw?.byTool || {}) };
    const { __openColorPicker: _ignored, ...style } = payload.style || {};
    byTool[payload.tool] = {
      ...(byTool[payload.tool] || {}),
      ...style,
    };

    try {
      await updateUserSettings({
        drawingDefaults: {
          ...(raw || {}),
          byTool,
          autoColorEnabled,
        },
      } as any);
      toast({
        title: 'Defaults saved',
        description: `Default style saved for ${payload.tool.replace('_', ' ')}`,
      });
    } catch (error: any) {
      console.error('[Drawing] Failed to save drawing defaults:', error);
      toast({
        title: 'Failed to save defaults',
        description: error instanceof Error ? error.message : (error?.message || 'Could not save default style. Please try again.'),
        variant: 'destructive',
      });
    }
  }, [userSettings, autoColorEnabled, updateUserSettings, toast]);

  const resetDrawingDefaults = useCallback(async (tool: string) => {
    const raw = userSettings?.drawingDefaults as any;
    const byTool = { ...(raw?.byTool || {}) };
    delete byTool[tool];

    try {
      await updateUserSettings({
        drawingDefaults: {
          ...(raw || {}),
          byTool,
          autoColorEnabled,
        },
      } as any);
      toast({
        title: 'Defaults reset',
        description: `Saved default removed for ${tool.replace('_', ' ')}`,
      });
    } catch (error: any) {
      console.error('[Drawing] Failed to reset drawing defaults:', error);
      toast({
        title: 'Failed to reset defaults',
        description: error?.message || 'Could not reset default style. Check auth / DB connection.',
        variant: 'destructive',
      });
    }
  }, [userSettings, autoColorEnabled, updateUserSettings, toast]);

  const handleAutoColorPreferenceChange = useCallback((enabled: boolean) => {
    setAutoColorEnabled(enabled);
    const raw = userSettings?.drawingDefaults as any;
    updateUserSettings({
      drawingDefaults: {
        ...(raw || {}),
        byTool: raw?.byTool || {},
        autoColorEnabled: enabled,
      },
    } as any);
  }, [userSettings, updateUserSettings]);

  // Hooks - Oscillator panel (needed first for totalHeight)
  const oscillatorPanel = useOscillatorPanel();
  const tetherSettings = useTetherDivergenceSettings();

  // Hooks - Chart instance
  const { chartRef, candleSeriesRef, isReady: chartReady, fitContent } = useChartInstance({
    containerRef: chartContainerRef,
    totalOscillatorHeight: oscillatorPanel.totalHeight,
    mobileNavHeight: 0, // No mobile nav in fullscreen mode
  });

  const [mainChartVisibleRange, setMainChartVisibleRange] = useState<any>(null);

  // Hooks - Data fetching
  const { candles, candlesKey, isLoading, error, falconMeta } = useCandleData({
    symbol,
    timeframe,
    enabled: chartReady,
    refreshInterval: 30000,
  });

  useEffect(() => {
    if (!chartReady || !highLowEnabled) return;
    const id = window.requestAnimationFrame(() => {
      if (chartRef.current && candleSeriesRef.current) setChartEpoch((n) => n + 1);
    });
    return () => window.cancelAnimationFrame(id);
  }, [chartReady, highLowEnabled, candles.length, symbol, timeframe, chartRef, candleSeriesRef]);

  // The timeframe that the currently-held `candles` array actually belongs to.
  // `timeframe` (the selected value) updates immediately on a dropdown change, but the
  // candle data lags by one network round-trip. Indicator overlays that pick their data
  // source from the interval (e.g. moving averages choosing "current TF" vs a cached HTF
  // series) must key off the timeframe of the data they are rendering — otherwise a
  // higher-TF MA gets computed from the previous lower-TF candles, producing the stray
  // "line"/shadow that reads the wrong timeframe. Derived from candlesKey (`${symbol}_${tf}`)
  // so it advances in lock-step with `candles`.
  const renderedTimeframe = useMemo(() => {
    const prefix = `${symbol}_`;
    return candlesKey.startsWith(prefix) ? candlesKey.slice(prefix.length) : timeframe;
  }, [candlesKey, symbol, timeframe]);

  // Subscribe to main chart visible range for oscillator sync (time + logical).
  // Tag every snapshot with candlesKey so a leftover 15m range cannot be applied
  // to 1h oscillator data (that shoved the panes left after TF switches).
  useEffect(() => {
    setMainChartVisibleRange(null);
    if (!chartRef.current) return;
    const handleVisibleRangeChange = () => {
      try {
        const currentKey = `${symbol}_${timeframe}`;
        // Don't tag a leftover 15m viewport with the new 1h candlesKey — that
        // is what jammed oscillator panes to the far left after TF switches.
        if (candlesKey !== currentKey) return;
        const range = readMainChartVisibleRange(chartRef.current, candlesKey);
        if (range.logical && candles.length > 0 && range.logical.from > candles.length + 200) {
          return;
        }
        if (range.time || range.logical) setMainChartVisibleRange(range);
        setChartViewVersion(v => v + 1);
      } catch (err) {
        // A throw here would propagate into lightweight-charts' internal event
        // dispatch and can wedge the time scale, disabling further pan/zoom.
        console.error('[Chart] visible range handler error:', err);
      }
    };
    handleVisibleRangeChange();
    const ts = chartRef.current.timeScale();
    ts.subscribeVisibleTimeRangeChange(handleVisibleRangeChange);
    ts.subscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
    return () => {
      try {
        const scale = chartRef.current?.timeScale();
        scale?.unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
        scale?.unsubscribeVisibleLogicalRangeChange(handleVisibleRangeChange);
      } catch {
        /* disposed */
      }
    };
  }, [chartRef.current, candlesKey, chartReady, symbol, timeframe, candles.length]);

  const syncedOscillatorRange = useMemo(() => {
    if (!mainChartVisibleRange) return null;
    const key = (mainChartVisibleRange as { key?: string }).key;
    if (key && key !== candlesKey) return null;
    return mainChartVisibleRange;
  }, [mainChartVisibleRange, candlesKey]);

  const {
    externalMetrics: gdsExternalMetrics,
    cvdData: gdsCvdData,
    oiHistory: gdsOiHistory,
    isLoading: isGdsMetricsLoading,
  } = useGDSMarketMetrics({
    symbol,
    timeframe,
    enabled: chartReady,
  });

  const { gds, latestScore } = useGenuineDemandScore({
    candles,
    cvdData: gdsCvdData,
    externalMetrics: gdsExternalMetrics,
  });

  // Determine effective candle slice for indicator calculations
  const effectiveCandleCount = (showOwnerOnlyTools ? rewindPosition : null) ?? candles.length;
  const effectiveCandles = useMemo(
    () => candles.slice(0, effectiveCandleCount),
    [candles, effectiveCandleCount],
  );

  // Trade tool data (must be after effectiveCandles to avoid TDZ)
  const tradeCandleData = useMemo(
    () => effectiveCandles.map(c => ({
      time: Number((c as { time: number }).time),
      high: (c as { high: number }).high,
      low: (c as { low: number }).low,
      close: (c as { close: number }).close,
    })),
    [effectiveCandles],
  );
  const { trades: manualTrades, addTrade: addManualTrade, exitTrade: exitManualTrade, deleteTrade: deleteManualTrade, updateTrade: updateManualTrade } = useManualTrades(symbol, timeframe, tradeCandleData, candlesKey);
  const latestTradeCandle = tradeCandleData[tradeCandleData.length - 1];
  const currentTradePrice = latestTradeCandle?.close ?? 0;
  const currentTradeTime = latestTradeCandle?.time ?? 0;

  // Rewind handlers
  const handleStepBack = useCallback(() => {
    const current = rewindPosition ?? candles.length;
    setRewindPosition(Math.max(50, current - 1));
  }, [rewindPosition, candles.length]);

  const handleStepForward = useCallback(() => {
    if (rewindPosition === null) return;
    const newPosition = rewindPosition + 1;
    if (newPosition >= candles.length) {
      setRewindPosition(null);
    } else {
      setRewindPosition(newPosition);
    }
  }, [rewindPosition, candles.length]);

  const handleGoLive = useCallback(() => {
    setRewindPosition(null);
  }, []);

  const handleToggleRewind = useCallback((enabled: boolean) => {
    rewindSettings.updateSetting('enabled', enabled);
    if (!enabled) {
      // When disabling, return to live mode
      setRewindPosition(null);
    } else if (rewindSettings.settings.autoPlay) {
      // When enabling with autoPlay, start at the midpoint of available candles
      // (minimum 50 candles so indicators have enough history to calculate)
      setRewindPosition(Math.max(50, Math.floor(candles.length / 2)));
    }
  }, [rewindSettings, candles.length]);

  // Hooks - Indicators
  const indicators = useIndicatorState();

  const oscillatorSettings = useMemo(
    () => ({
      rsiPeriod: indicators.rsi.period,
      macdFast: indicators.macd.fast,
      macdSlow: indicators.macd.slow,
      macdSignal: indicators.macd.signal,
      stochRsiPeriod: indicators.stochRSI.period,
      mfiPeriod: indicators.mfi.period,
      williamsRPeriod: indicators.williamsR.period,
      cciPeriod: indicators.cci.period,
      adxPeriod: indicators.adx.period,
    }),
    [
      indicators.rsi.period,
      indicators.macd.fast,
      indicators.macd.slow,
      indicators.macd.signal,
      indicators.stochRSI.period,
      indicators.mfi.period,
      indicators.williamsR.period,
      indicators.cci.period,
      indicators.adx.period,
    ],
  );

  // Hooks - Oscillator data
  const oscillatorDataBase = useOscillatorData(effectiveCandles, oscillatorSettings, {
    oiHistory: gdsOiHistory,
    timeframe: renderedTimeframe,
  });
  const tetherDivergence = useTetherDivergence({
    symbol,
    chartCandles: effectiveCandles,
    chartTimeframe: renderedTimeframe,
    settings: tetherSettings.settings,
    enabled: oscillatorPanel.selectedOscillators.has('tetherDivergence'),
  });
  const oscillatorData = useMemo(
    () => ({ ...oscillatorDataBase, tetherDivergence: tetherDivergence.result }),
    [oscillatorDataBase, tetherDivergence.result],
  );
  const oscillatorModalConfigs = useMemo<Record<string, OscillatorModalConfig>>(
    () => ({
      rsi: { enabled: oscillatorPanel.selectedOscillators.has('rsi'), period: indicators.rsi.period },
      macd: {
        enabled: oscillatorPanel.selectedOscillators.has('macd'),
        fast: indicators.macd.fast,
        slow: indicators.macd.slow,
        signal: indicators.macd.signal,
      },
      stochRsi: { enabled: oscillatorPanel.selectedOscillators.has('stochRsi'), period: indicators.stochRSI.period },
      mfi: { enabled: oscillatorPanel.selectedOscillators.has('mfi'), period: indicators.mfi.period },
      williamsR: { enabled: oscillatorPanel.selectedOscillators.has('williamsR'), period: indicators.williamsR.period },
      cci: { enabled: oscillatorPanel.selectedOscillators.has('cci'), period: indicators.cci.period },
      adx: { enabled: oscillatorPanel.selectedOscillators.has('adx'), period: indicators.adx.period },
      obv: { enabled: oscillatorPanel.selectedOscillators.has('obv') },
      volume: { enabled: oscillatorPanel.selectedOscillators.has('volume') },
      cmf: { enabled: oscillatorPanel.selectedOscillators.has('cmf') },
      tsi: { enabled: oscillatorPanel.selectedOscillators.has('tsi') },
      klinger: { enabled: oscillatorPanel.selectedOscillators.has('klinger') },
      waddah: { enabled: oscillatorPanel.selectedOscillators.has('waddah') },
      tetherDivergence: { enabled: oscillatorPanel.selectedOscillators.has('tetherDivergence') },
      smartMoney: { enabled: oscillatorPanel.selectedOscillators.has('smartMoney') },
      smcTrendEngine: { enabled: oscillatorPanel.selectedOscillators.has('smcTrendEngine') },
    }),
    [
      oscillatorPanel.selectedOscillators,
      indicators.rsi.period,
      indicators.macd.fast,
      indicators.macd.slow,
      indicators.macd.signal,
      indicators.stochRSI.period,
      indicators.mfi.period,
      indicators.williamsR.period,
      indicators.cci.period,
      indicators.adx.period,
    ],
  );

  const handleUpdateOscillatorConfig = useCallback((oscillatorId: string, config: OscillatorModalConfig) => {
    switch (oscillatorId) {
      case 'rsi': {
        if (typeof config.period === 'number' && Number.isFinite(config.period)) {
          indicators.rsi.setPeriod(config.period);
          indicators.rsi.setPeriodInput(String(config.period));
        }
        break;
      }
      case 'macd': {
        if (typeof config.fast === 'number' && Number.isFinite(config.fast)) {
          indicators.macd.setFast(config.fast);
          indicators.macd.setFastInput(String(config.fast));
        }
        if (typeof config.slow === 'number' && Number.isFinite(config.slow)) {
          indicators.macd.setSlow(config.slow);
          indicators.macd.setSlowInput(String(config.slow));
        }
        if (typeof config.signal === 'number' && Number.isFinite(config.signal)) {
          indicators.macd.setSignal(config.signal);
          indicators.macd.setSignalInput(String(config.signal));
        }
        break;
      }
      case 'stochRsi': {
        if (typeof config.period === 'number' && Number.isFinite(config.period)) {
          indicators.stochRSI.setPeriod(config.period);
          indicators.stochRSI.setPeriodInput(String(config.period));
        }
        break;
      }
      case 'mfi': {
        if (typeof config.period === 'number' && Number.isFinite(config.period)) {
          indicators.mfi.setPeriod(config.period);
          indicators.mfi.setPeriodInput(String(config.period));
        }
        break;
      }
      case 'williamsR': {
        if (typeof config.period === 'number' && Number.isFinite(config.period)) {
          indicators.williamsR.setPeriod(config.period);
          indicators.williamsR.setPeriodInput(String(config.period));
        }
        break;
      }
      case 'cci': {
        if (typeof config.period === 'number' && Number.isFinite(config.period)) {
          indicators.cci.setPeriod(config.period);
          indicators.cci.setPeriodInput(String(config.period));
        }
        break;
      }
      case 'adx': {
        if (typeof config.period === 'number' && Number.isFinite(config.period)) {
          indicators.adx.setPeriod(config.period);
          indicators.adx.setPeriodInput(String(config.period));
        }
        break;
      }
      default:
        break;
    }
  }, [indicators]);

  // Reset rewind when symbol/timeframe changes
  useEffect(() => {
    setRewindPosition(null);
  }, [symbol, timeframe]);

  // Clear divergence selection when chart context changes.
  useEffect(() => {
    setSelectedDivergencePoint(null);
  }, [symbol, timeframe]);

  // Hooks - FVG detection (uses effectiveCandles so it updates with rewind)
  const fvgSettings = useFVGSettings();
  const fvgs = useFVGDetection({ candles: effectiveCandles, settings: fvgSettings.settings });

  // Hooks - Order Block detection
  const obSettings = useOrderBlockSettings();
  const breakerSettings = useBreakerSettings();
  const { orderBlocks, breakers } = useOrderBlockDetection({ candles: effectiveCandles, settings: obSettings.settings, fvgs });

  // Hooks - BOS/CHoCH detection
  const bosSettings = useBOSSettings();
  const { structureBreaks, swingPoints, sessionSeparators } = useBOSDetection({
    candles: effectiveCandles,
    settings: bosSettings.settings,
    fvgs,
    orderBlocks,
  });

  // Hooks - Liquidity Zone detection
  const liquiditySettings = useLiquiditySettings();
  const liquidityZones = useLiquidityDetection({
    candles: effectiveCandles,
    settings: liquiditySettings.settings,
    symbol,
    timeframe,
  });

  // Hooks - Premium/Discount Zone detection
  const pdZoneSettings = usePDZoneSettings();
  const pdZones = usePDZoneDetection({
    candles: effectiveCandles,
    settings: pdZoneSettings.settings,
  });

  // Hooks - Auto-Fibonacci detection
  const autoFibSettings = useAutoFibSettings();
  const chartVisibleRange = useVisibleRange(chartRef.current, chartReady);
  const autoFibResult = useAutoFibDetection(effectiveCandles, chartVisibleRange, autoFibSettings.settings);

  // Hooks - Auto Trendlines (macro / mid / LTF)
  const autoTrendlineSettings = useAutoTrendlineSettings();
  const autoTrendlineResult = useAutoTrendlineDetection(
    effectiveCandles as Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>,
    autoTrendlineSettings.settings,
  );
  const swoopSettings = useSwoopSettings();
  const swoopResult = useSwoopDetection(
    effectiveCandles as Array<{ time: number; open: number; high: number; low: number; close: number; volume?: number }>,
    swoopSettings.settings,
    chartVisibleRange,
  );

  // Hooks - Volume EMA overlay (display settings)
  const volumeEmaSettings = useVolumeEmaSettings();

  // Hooks - SuperTrend
  const superTrendSettings = useSuperTrendSettings();
  const superTrendData = useSuperTrendCalculation(effectiveCandles, superTrendSettings.settings);

  // Hooks - Divergence Scanner
  const divSettings = useDivergenceSettings();
  const divergencePoints = useMultiTimeframeDivergenceScanner(
    symbol,
    timeframe as TimeframeKey,
    effectiveCandles,
    divSettings.settings.enabledTimeframes,
    DEFAULT_OSCILLATOR_CONFIG,
  );

  const filteredDivergencePoints = useMemo(() => {
    const count = divSettings.settings.historyCount;
    const bullish = divergencePoints
      .filter(p => p.type === 'bullish')
      .sort((a, b) => (b.time as number) - (a.time as number))
      .slice(0, count);
    const bearish = divergencePoints
      .filter(p => p.type === 'bearish')
      .sort((a, b) => (b.time as number) - (a.time as number))
      .slice(0, count);
    return [...bullish, ...bearish];
  }, [divergencePoints, divSettings.settings.historyCount]);

  // Hooks - HTF data cache
  const { htfDataCache } = useHTFDataCache({
    symbol,
    currentTimeframe: timeframe,
    emaConfigs: indicators.ema.configs,
    enabled: indicators.ema.show,
  });

  // Hooks - HTF Bias Panel
  const htfBiasSettings = useHTFBiasSettings();
  const htfBiasEntries = useHTFBias({
    symbol,
    timeframes: htfBiasSettings.settings.timeframes,
    enabled: htfBiasSettings.settings.enabled,
  });
  // Hooks - Volume Profile
  const vpSettings = useVolumeProfileSettings();
  const visibleRange = useVisibleRange(vpSettings.settings.updateOnPan ? chartRef.current : null, chartReady);
  const volumeProfileData = useVolumeProfileCalculation(effectiveCandles, visibleRange, vpSettings.settings);

  // Hooks - Liquidity Heatmap
  const lhSettings = useLiquidityHeatmapSettings();
  const lhVisibleRange = useVisibleRange(chartRef.current, chartReady);
  const liquidityHeatmapDataResult = useLiquidityHeatmapData(
    symbol,
    lhSettings.settings,
    timeframe,
    effectiveCandles,
    lhVisibleRange,
  );

  const resolvedLiquidityPredictorConfig = useMemo(
    () => resolveLiquidityPredictorConfig(lhSettings.settings, liquidityHeatmapDataResult.effectiveRange),
    [lhSettings.settings, liquidityHeatmapDataResult.effectiveRange],
  );

  // Hooks - Liquidity Pivot Analysis (combines pivots + volume + liquidation)
  const liquidityPivotAnalysis = useLiquidityPivotAnalysis(
    effectiveCandles,
    volumeProfileData,
    liquidityHeatmapDataResult?.data ?? null,
    {
      enabled: lhSettings.settings.usePivotVolumePrediction,
      pivotLookback: resolvedLiquidityPredictorConfig.pivotLookback,
      minConfluenceScore: resolvedLiquidityPredictorConfig.minConfluenceScore,
      topNPoints: resolvedLiquidityPredictorConfig.topNPoints,
      priceThresholdPercent: resolvedLiquidityPredictorConfig.priceThresholdPercent,
    }
  );

  // Hooks - Trading Systems
  const tradingSystemCallbacks: TradingSystemCallbacks = {
    // Oscillators
    setShowRSI: indicators.rsi.setShow,
    setRSIPeriod: indicators.rsi.setPeriod,
    setShowMACD: indicators.macd.setShow,
    setMACDFast: indicators.macd.setFast,
    setMACDSlow: indicators.macd.setSlow,
    setMACDSignal: indicators.macd.setSignal,
    setShowStochRSI: indicators.stochRSI.setShow,
    setStochRSIPeriod: indicators.stochRSI.setPeriod,
    setShowOBV: indicators.obv.setShow,
    setShowMFI: indicators.mfi.setShow,
    setMFIPeriod: indicators.mfi.setPeriod,
    setShowWilliamsR: indicators.williamsR.setShow,
    setShowCCI: indicators.cci.setShow,
    setShowADX: indicators.adx.setShow,
    setADXPeriod: indicators.adx.setPeriod,
    
    // Chart indicators
    setShowEMA: indicators.ema.setShow,
    setShowBollingerBands: indicators.bb.setShow,
    setBBPeriod: indicators.bb.setPeriod,
    setBBStdDev: indicators.bb.setStdDev,
    setElderImpulseEnabled: indicators.elderImpulse.setShow,
    
    // SMC
    setFVGEnabled: (enabled) => fvgSettings.updateSetting('enabled', enabled),
    setOrderBlocksEnabled: (enabled) => obSettings.updateSetting('enabled', enabled),
    setBOSEnabled: (enabled) => bosSettings.updateSetting('enabled', enabled),
    setLiquidityEnabled: (enabled) => liquiditySettings.updateSetting('enabled', enabled),
    setPDZonesEnabled: (enabled: boolean) => pdZoneSettings.updateSetting('enabled', enabled),
    setAutoFibEnabled: (enabled) => autoFibSettings.updateSettings({ enabled }),
    
    // Tools
    setSuperTrendEnabled: (enabled) => {
      // Enable standard SuperTrend by default
      superTrendSettings.updateSettings({ standard: { ...superTrendSettings.settings.standard, enabled } });
    },
    setVolumeProfileEnabled: (enabled) => vpSettings.updateSettings({ enabled }),
    setDivergenceScannerEnabled: setDivergenceScannerEnabled,
    setHTFBiasEnabled: (enabled) => htfBiasSettings.updateSetting('enabled', enabled),
    setSessionSeparatorsEnabled: (enabled) => bosSettings.updateSetting('showSessions', enabled),
  };
  
  const tradingSystem = useTradingSystem(tradingSystemCallbacks);

  useEffect(() => {
    if (showOwnerOnlyTools) return;
    if (isOwnerOnlyTradingSystem(tradingSystem.activeSystem)) {
      tradingSystem.deactivateSystem();
    }
  }, [showOwnerOnlyTools, tradingSystem.activeSystem, tradingSystem.deactivateSystem]);

  const historicalSystemSignalEvents = useMemo(() => {
    if (!tradingSystem.activeSystem || effectiveCandles.length < 3) return [];

    const lookbackCandles = Math.min(400, effectiveCandles.length - 1);
    const startIndex = Math.max(1, effectiveCandles.length - lookbackCandles);

    const rsiByTime = new Map<number, number>(oscillatorData.rsi.map(point => [Number(point.time), point.value]));
    const macdByTime = new Map<number, number>(oscillatorData.macd.macd.map(point => [Number(point.time), point.value]));
    const signalByTime = new Map<number, number>(oscillatorData.macd.signal.map(point => [Number(point.time), point.value]));
    const superTrendByTime = new Map<number, 'bullish' | 'bearish'>(
      superTrendData.standard.map(point => [Number(point.time), point.trend])
    );

    // Avoid look-ahead in historical mode: current HTF panel state should not
    // influence past-candle signal generation.
    const htfBullish = 0;
    const htfBearish = 0;

    const tfMinutesMap: Record<string, number> = {
      '1m': 1,
      '5m': 5,
      '15m': 15,
      '30m': 30,
      '1h': 60,
      '4h': 240,
      '1d': 1440,
    };
    const tfMinutes = tfMinutesMap[timeframe] ?? 15;
    const barSeconds = tfMinutes * 60;
    const divergenceConfirmationSeconds = 5 * barSeconds;

    const events: Array<{
      time: number;
      action: 'BUY OPEN' | 'BUY CLOSE' | 'SELL OPEN' | 'SELL CLOSE';
    }> = [];

    let inBuyZone = false;
    let inSellZone = false;

    for (let index = startIndex; index < effectiveCandles.length; index++) {
      const currentCandle = effectiveCandles[index] as { time: number; close: number };
      const prevCandle = effectiveCandles[index - 1] as { time: number; close: number };
      const currentCandleWithVolume = effectiveCandles[index] as { volume?: number; low?: number; high?: number; close: number; time: number };
      const currentTime = Number(currentCandle.time);
      const prevTime = Number(prevCandle.time);
      const avgVolume = calculateAverageVolume(effectiveCandles as Array<{ volume: number }>, index, 20);
      const shortTermMA = calculateSimpleMovingAverage(effectiveCandles as Array<{ close: number }>, index, 9);
      const longTermMA = calculateSimpleMovingAverage(effectiveCandles as Array<{ close: number }>, index, 21);
      const { supportLevel, resistanceLevel } = calculateSupportResistance(
        effectiveCandles as Array<{ low: number; high: number }>,
        index,
        getSRLookback(timeframe),
      );

      let latestStructureDirection: 'bullish' | 'bearish' | undefined;
      for (let breakIndex = structureBreaks.length - 1; breakIndex >= 0; breakIndex--) {
        const structureBreak = structureBreaks[breakIndex];
        if (structureBreak.breakTime <= currentTime) {
          latestStructureDirection = structureBreak.direction;
          break;
        }
      }

      const divergencePointsForCandle = divergencePoints.filter(point => {
        const ageSeconds = currentTime - Number(point.time);
        return ageSeconds >= divergenceConfirmationSeconds;
      });

      const evaluation = evaluateTradingSystemSignal({
        systemId: tradingSystem.activeSystem,
        lastRsi: rsiByTime.get(currentTime),
        prevRsi: rsiByTime.get(prevTime),
        macdNow: macdByTime.get(currentTime),
        macdPrev: macdByTime.get(prevTime),
        sigNow: signalByTime.get(currentTime),
        sigPrev: signalByTime.get(prevTime),
        stTrend: superTrendByTime.get(currentTime),
        latestStructureDirection,
        htfBullish,
        htfBearish,
        rsi: rsiByTime.get(currentTime),
        currentPrice: currentCandle.close,
        supportLevel,
        resistanceLevel,
        currentVolume: currentCandleWithVolume.volume,
        avgVolume,
        shortTermMA,
        longTermMA,
        latestClose: currentCandle.close,
        previousClose: prevCandle.close,
        divergencePoints: divergencePointsForCandle,
        currentTime,
        currentCandleIndex: index,
        structureBreaks,
        ...buildSmcZoneInputs(fvgs, orderBlocks, breakers, liquidityZones, currentTime),
        volumeProfileData: volumeProfileData
          ? { rows: volumeProfileData.rows.map(r => ({ price: r.price, volume: r.volume })), valueAreaHigh: volumeProfileData.vahPrice, valueAreaLow: volumeProfileData.valPrice, poc: volumeProfileData.poc }
          : undefined,
      });

      const isBuySignal = evaluation.action === 'OPEN LONG';
      const isSellSignal = evaluation.action === 'OPEN SHORT';

      // Buy Zone Open
      if (isBuySignal && !inBuyZone) {
        events.push({ time: currentTime, action: 'BUY OPEN' });
        inBuyZone = true;
        inSellZone = false;
      }

      // Buy Zone Close
      if (!isBuySignal && inBuyZone) {
        events.push({ time: currentTime, action: 'BUY CLOSE' });
        inBuyZone = false;
      }

      // Sell Zone Open
      if (isSellSignal && !inSellZone) {
        events.push({ time: currentTime, action: 'SELL OPEN' });
        inSellZone = true;
        inBuyZone = false;
      }

      // Sell Zone Close
      if (!isSellSignal && inSellZone) {
        events.push({ time: currentTime, action: 'SELL CLOSE' });
        inSellZone = false;
      }
    }

    return events.slice(-120);
  }, [
    tradingSystem.activeSystem,
    effectiveCandles,
    oscillatorData,
    superTrendData.standard,
    structureBreaks,
    swingPoints,
    htfBiasEntries,
    conditionWeightsVersion,
    divergencePoints,
    fvgs,
    orderBlocks,
    breakers,
    liquidityZones,
    volumeProfileData,
    timeframe,
  ]);

  const historicalSystemSignalMarkers = useMemo(() => {
    // Only show a single LONG or SHORT marker for the most recent active signal.
    // An active signal is a BUY OPEN (or SELL OPEN) that has no subsequent CLOSE.
    // Scan backwards once per direction: stop at the first matching OPEN or CLOSE.
    const markers: Array<{
      time: Time;
      position: 'belowBar' | 'aboveBar';
      shape: 'arrowUp' | 'arrowDown';
      color: string;
      text: string;
      size: number;
    }> = [];

    // Find the last BUY OPEN with no BUY CLOSE after it (single backwards pass)
    for (let i = historicalSystemSignalEvents.length - 1; i >= 0; i--) {
      const ev = historicalSystemSignalEvents[i];
      if (ev.action === 'BUY CLOSE') break; // CLOSE comes after the last OPEN → zone is closed
      if (ev.action === 'BUY OPEN') {
        markers.push({
          time: ev.time as Time,
          position: 'belowBar',
          shape: 'arrowUp',
          color: '#22c55e',
          text: 'LONG',
          size: 2,
        });
        break;
      }
    }

    // Find the last SELL OPEN with no SELL CLOSE after it (single backwards pass)
    for (let i = historicalSystemSignalEvents.length - 1; i >= 0; i--) {
      const ev = historicalSystemSignalEvents[i];
      if (ev.action === 'SELL CLOSE') break; // CLOSE comes after the last OPEN → zone is closed
      if (ev.action === 'SELL OPEN') {
        markers.push({
          time: ev.time as Time,
          position: 'aboveBar',
          shape: 'arrowDown',
          color: '#ef4444',
          text: 'SHORT',
          size: 2,
        });
        break;
      }
    }

    markers.sort((a, b) => (a.time as number) - (b.time as number));
    return markers;
  }, [historicalSystemSignalEvents]);

  const displayedSystemMarkers = useMemo(() => {
    if (activeSystemBacktestSignals) {
      // Only show the last active buy and/or sell open signal (no close markers)
      const markers: Array<{
        time: Time;
        position: 'belowBar' | 'aboveBar';
        shape: 'arrowUp' | 'arrowDown';
        color: string;
        text: string;
        size: number;
      }> = [];

      const lastBuy = activeSystemBacktestSignals.buySignals
        .filter(s => s.type === 'zone-open')
        .at(-1);
      if (lastBuy) {
        markers.push({
          time: lastBuy.time as Time,
          position: 'belowBar',
          shape: 'arrowUp',
          color: '#22c55e',
          text: 'LONG',
          size: 2,
        });
      }

      const lastSell = activeSystemBacktestSignals.sellSignals
        .filter(s => s.type === 'zone-open')
        .at(-1);
      if (lastSell) {
        markers.push({
          time: lastSell.time as Time,
          position: 'aboveBar',
          shape: 'arrowDown',
          color: '#ef4444',
          text: 'SHORT',
          size: 2,
        });
      }

      markers.sort((a, b) => (a.time as number) - (b.time as number));
      return markers;
    }
    return historicalSystemSignalMarkers;
  }, [activeSystemBacktestSignals, historicalSystemSignalMarkers]);

  useEffect(() => {
    const candleSeries = candleSeriesRef.current;

    if (!candleSeries || !tradingSystem.activeSystem) {
      systemSignalMarkersRef.current?.setMarkers([]);
      return;
    }

    if (!systemSignalMarkersRef.current || systemSignalMarkerHostSeriesRef.current !== candleSeries) {
      systemSignalMarkersRef.current = createSeriesMarkers(candleSeries, []);
      systemSignalMarkerHostSeriesRef.current = candleSeries;
    }

    systemSignalMarkersRef.current.setMarkers(displayedSystemMarkers);
  }, [tradingSystem.activeSystem, displayedSystemMarkers, candleSeriesRef, chartReady]);

  useEffect(() => {
    return () => {
      systemSignalMarkersRef.current?.setMarkers([]);
      systemSignalMarkersRef.current = null;
      systemSignalMarkerHostSeriesRef.current = null;
    };
  }, []);

  // Clear backtest signals when active system changes
  useEffect(() => {
    setActiveSystemBacktestSignals(null);
  }, [tradingSystem.activeSystem]);

  // Auto-enable divergence scanner when Smart Money system is activated
  useEffect(() => {
    if (tradingSystem.activeSystem === 'smart-money' || tradingSystem.activeSystem === 'smc-trend-engine') {
      setDivergenceScannerEnabled(true);
    }
  }, [tradingSystem.activeSystem]);

  const activeSystemDetails = useMemo(() => {
    if (!tradingSystem.activeSystem || effectiveCandles.length < 2) return null;

    const system = TRADING_SYSTEMS[tradingSystem.activeSystem];
    if (!system) return null;

    const previousCandle = effectiveCandles[effectiveCandles.length - 2] as { open: number; close: number };
    const latestCandle = effectiveCandles[effectiveCandles.length - 1] as { time: number; close: number };
    const previousDirection = previousCandle.close >= previousCandle.open ? 'Bullish' : 'Bearish';
    const previousDelta = previousCandle.close - previousCandle.open;

    const lastRsi = oscillatorData.rsi[oscillatorData.rsi.length - 1]?.value;
    const prevRsi = oscillatorData.rsi[oscillatorData.rsi.length - 2]?.value;
    const macdNow = oscillatorData.macd.macd[oscillatorData.macd.macd.length - 1]?.value;
    const macdPrev = oscillatorData.macd.macd[oscillatorData.macd.macd.length - 2]?.value;
    const sigNow = oscillatorData.macd.signal[oscillatorData.macd.signal.length - 1]?.value;
    const sigPrev = oscillatorData.macd.signal[oscillatorData.macd.signal.length - 2]?.value;

    const stLatest = superTrendData.standard[superTrendData.standard.length - 1];
    const stTrend = stLatest?.trend;
    const latestStructureBreak = structureBreaks[structureBreaks.length - 1];
    const avgVolume = calculateAverageVolume(effectiveCandles as Array<{ volume: number }>, effectiveCandles.length - 1, 20);
    const shortTermMA = calculateSimpleMovingAverage(effectiveCandles as Array<{ close: number }>, effectiveCandles.length - 1, 9);
    const longTermMA = calculateSimpleMovingAverage(effectiveCandles as Array<{ close: number }>, effectiveCandles.length - 1, 21);
    const { supportLevel, resistanceLevel } = calculateSupportResistance(
      effectiveCandles as Array<{ low: number; high: number }>,
      effectiveCandles.length - 1,
      getSRLookback(timeframe),
    );

    const htfBullish = htfBiasEntries.filter(e => e.bias === 'bullish').length;
    const htfBearish = htfBiasEntries.filter(e => e.bias === 'bearish').length;

    const divergenceHistoryLength = 51; // 50 lookback bars + 1 for current candle
    const priceHistory = effectiveCandles.slice(-divergenceHistoryLength).map(c => (c as { close: number }).close);
    const rsiHistory = oscillatorData.rsi.slice(-divergenceHistoryLength).map(p => p.value);
    const macdHistHistory = oscillatorData.macd.hist.slice(-divergenceHistoryLength).map(p => p.value);

    const scoringInput = {
      systemId: tradingSystem.activeSystem,
      lastRsi,
      prevRsi,
      macdNow,
      macdPrev,
      sigNow,
      sigPrev,
      stTrend,
      latestStructureDirection: latestStructureBreak?.direction,
      htfBullish,
      htfBearish,
      rsi: lastRsi,
      currentPrice: latestCandle.close,
      supportLevel,
      resistanceLevel,
      currentVolume: (latestCandle as { volume?: number }).volume,
      avgVolume,
      shortTermMA,
      longTermMA,
      latestClose: latestCandle.close,
      previousClose: previousCandle.close,
      divergencePoints,
      currentTime: Number(latestCandle.time),
      currentCandleIndex: effectiveCandles.length - 1,
      structureBreaks,
      swingPoints,
      ...buildSmcZoneInputs(fvgs, orderBlocks, breakers, liquidityZones),
      volumeProfileData: volumeProfileData
        ? { rows: volumeProfileData.rows.map(r => ({ price: r.price, volume: r.volume })), valueAreaHigh: volumeProfileData.vahPrice, valueAreaLow: volumeProfileData.valPrice, poc: volumeProfileData.poc }
        : undefined,
      priceHistory,
      rsiHistory,
      macdHistHistory,
      autoFibResult,
      timeframe,
    };

    const evaluatedSignal = evaluateTradingSystemSignal(scoringInput);

    return {
      system,
      previousOpen: previousCandle.open,
      previousClose: previousCandle.close,
      previousDirection,
      previousDelta,
      signals: system.alerts?.entry ?? [],
      signalAction: evaluatedSignal.action,
      signalReasons: evaluatedSignal.signalReasons,
      evaluation: { ...evaluatedSignal.evaluation, timestamp: Date.now() },
      historicalSignalCount: historicalSystemSignalEvents.length,
      scoringInput,
    };
  }, [
    tradingSystem.activeSystem,
    effectiveCandles,
    oscillatorData,
    superTrendData,
    structureBreaks,
    swingPoints,
    htfBiasEntries,
    conditionWeightsVersion,
    historicalSystemSignalEvents.length,
    divergencePoints,
    fvgs,
    orderBlocks,
    breakers,
    liquidityZones,
    volumeProfileData,
    autoFibResult,
    timeframe,
  ]);

  const smartMoneyPanelData = useMemo(() => {
    if (effectiveCandles.length < 2) {
      return { scoringInput: null, evaluation: null };
    }

    const previousCandle = effectiveCandles[effectiveCandles.length - 2] as { open: number; close: number };
    const latestCandle = effectiveCandles[effectiveCandles.length - 1] as { time: number; close: number; volume?: number };

    const lastRsi = oscillatorData.rsi[oscillatorData.rsi.length - 1]?.value;
    const prevRsi = oscillatorData.rsi[oscillatorData.rsi.length - 2]?.value;
    const macdNow = oscillatorData.macd.macd[oscillatorData.macd.macd.length - 1]?.value;
    const macdPrev = oscillatorData.macd.macd[oscillatorData.macd.macd.length - 2]?.value;
    const sigNow = oscillatorData.macd.signal[oscillatorData.macd.signal.length - 1]?.value;
    const sigPrev = oscillatorData.macd.signal[oscillatorData.macd.signal.length - 2]?.value;

    const stLatest = superTrendData.standard[superTrendData.standard.length - 1];
    const stTrend = stLatest?.trend;
    const latestStructureBreak = structureBreaks[structureBreaks.length - 1];
    const avgVolume = calculateAverageVolume(effectiveCandles as Array<{ volume: number }>, effectiveCandles.length - 1, 20);
    const shortTermMA = calculateSimpleMovingAverage(effectiveCandles as Array<{ close: number }>, effectiveCandles.length - 1, 9);
    const longTermMA = calculateSimpleMovingAverage(effectiveCandles as Array<{ close: number }>, effectiveCandles.length - 1, 21);
    const { supportLevel, resistanceLevel } = calculateSupportResistance(
      effectiveCandles as Array<{ low: number; high: number }>,
      effectiveCandles.length - 1,
      getSRLookback(timeframe),
    );

    const htfBullish = htfBiasEntries.filter(e => e.bias === 'bullish').length;
    const htfBearish = htfBiasEntries.filter(e => e.bias === 'bearish').length;

    const divergenceHistoryLength = 51;
    const priceHistory = effectiveCandles.slice(-divergenceHistoryLength).map(c => (c as { close: number }).close);
    const rsiHistory = oscillatorData.rsi.slice(-divergenceHistoryLength).map(p => p.value);
    const macdHistHistory = oscillatorData.macd.hist.slice(-divergenceHistoryLength).map(p => p.value);

    const scoringInput: ScoringInput = {
      lastRsi,
      prevRsi,
      macdNow,
      macdPrev,
      sigNow,
      sigPrev,
      stTrend,
      latestStructureDirection: latestStructureBreak?.direction,
      htfBullish,
      htfBearish,
      rsi: lastRsi,
      currentPrice: latestCandle.close,
      supportLevel,
      resistanceLevel,
      currentVolume: latestCandle.volume,
      avgVolume,
      shortTermMA,
      longTermMA,
      latestClose: latestCandle.close,
      previousClose: previousCandle.close,
      divergencePoints,
      currentTime: Number(latestCandle.time),
      currentCandleIndex: effectiveCandles.length - 1,
      structureBreaks,
      swingPoints,
      ...buildSmcZoneInputs(fvgs, orderBlocks, breakers, liquidityZones),
      volumeProfileData: volumeProfileData
        ? { rows: volumeProfileData.rows.map(r => ({ price: r.price, volume: r.volume })), valueAreaHigh: volumeProfileData.vahPrice, valueAreaLow: volumeProfileData.valPrice, poc: volumeProfileData.poc }
        : undefined,
      priceHistory,
      rsiHistory,
      macdHistHistory,
      autoFibResult,
      timeframe,
    };

    const evaluation = scoreSystem('smart-money', scoringInput);

    return {
      scoringInput,
      evaluation: {
        ...evaluation,
        timestamp: Date.now(),
      },
    };
  }, [
    effectiveCandles,
    oscillatorData,
    superTrendData,
    structureBreaks,
    swingPoints,
    htfBiasEntries,
    divergencePoints,
    fvgs,
    orderBlocks,
    breakers,
    liquidityZones,
    volumeProfileData,
    autoFibResult,
    timeframe,
    conditionWeightsVersion,
  ]);

  const smcTrendEnginePanelData = useMemo(() => {
    if (effectiveCandles.length < 2) {
      return { scoringInput: null, evaluation: null };
    }

    const previousCandle = effectiveCandles[effectiveCandles.length - 2] as { open: number; close: number };
    const latestCandle = effectiveCandles[effectiveCandles.length - 1] as { time: number; close: number; volume?: number };

    const lastRsi = oscillatorData.rsi[oscillatorData.rsi.length - 1]?.value;
    const prevRsi = oscillatorData.rsi[oscillatorData.rsi.length - 2]?.value;
    const macdNow = oscillatorData.macd.macd[oscillatorData.macd.macd.length - 1]?.value;
    const macdPrev = oscillatorData.macd.macd[oscillatorData.macd.macd.length - 2]?.value;
    const sigNow = oscillatorData.macd.signal[oscillatorData.macd.signal.length - 1]?.value;
    const sigPrev = oscillatorData.macd.signal[oscillatorData.macd.signal.length - 2]?.value;

    const stLatest = superTrendData.standard[superTrendData.standard.length - 1];
    const stTrend = stLatest?.trend;
    const latestStructureBreak = structureBreaks[structureBreaks.length - 1];
    const avgVolume = calculateAverageVolume(effectiveCandles as Array<{ volume: number }>, effectiveCandles.length - 1, 20);
    const shortTermMA = calculateSimpleMovingAverage(effectiveCandles as Array<{ close: number }>, effectiveCandles.length - 1, 9);
    const longTermMA = calculateSimpleMovingAverage(effectiveCandles as Array<{ close: number }>, effectiveCandles.length - 1, 21);
    const { supportLevel, resistanceLevel } = calculateSupportResistance(
      effectiveCandles as Array<{ low: number; high: number }>,
      effectiveCandles.length - 1,
      getSRLookback(timeframe),
    );

    const htfBullish = htfBiasEntries.filter(e => e.bias === 'bullish').length;
    const htfBearish = htfBiasEntries.filter(e => e.bias === 'bearish').length;

    const divergenceHistoryLength = 51;
    const priceHistory = effectiveCandles.slice(-divergenceHistoryLength).map(c => (c as { close: number }).close);
    const rsiHistory = oscillatorData.rsi.slice(-divergenceHistoryLength).map(p => p.value);
    const macdHistHistory = oscillatorData.macd.hist.slice(-divergenceHistoryLength).map(p => p.value);

    const scoringInput: ScoringInput = {
      lastRsi,
      prevRsi,
      macdNow,
      macdPrev,
      sigNow,
      sigPrev,
      stTrend,
      latestStructureDirection: latestStructureBreak?.direction,
      htfBullish,
      htfBearish,
      rsi: lastRsi,
      currentPrice: latestCandle.close,
      supportLevel,
      resistanceLevel,
      currentVolume: latestCandle.volume,
      avgVolume,
      shortTermMA,
      longTermMA,
      latestClose: latestCandle.close,
      previousClose: previousCandle.close,
      divergencePoints,
      currentTime: Number(latestCandle.time),
      currentCandleIndex: effectiveCandles.length - 1,
      structureBreaks,
      swingPoints,
      ...buildSmcZoneInputs(fvgs, orderBlocks, breakers, liquidityZones),
      volumeProfileData: volumeProfileData
        ? { rows: volumeProfileData.rows.map(r => ({ price: r.price, volume: r.volume })), valueAreaHigh: volumeProfileData.vahPrice, valueAreaLow: volumeProfileData.valPrice, poc: volumeProfileData.poc }
        : undefined,
      priceHistory,
      rsiHistory,
      macdHistHistory,
      autoFibResult,
      timeframe,
    };

    const evaluation = scoreSystem('smc-trend-engine', scoringInput);

    return {
      scoringInput,
      evaluation: {
        ...evaluation,
        timestamp: Date.now(),
      },
    };
  }, [
    effectiveCandles,
    oscillatorData,
    superTrendData,
    structureBreaks,
    swingPoints,
    htfBiasEntries,
    divergencePoints,
    fvgs,
    orderBlocks,
    breakers,
    liquidityZones,
    volumeProfileData,
    autoFibResult,
    timeframe,
    conditionWeightsVersion,
  ]);

  const activeSystemSummary = useMemo(() => {
    if (!tradingSystem.activeSystem) return null;

    const system = TRADING_SYSTEMS[tradingSystem.activeSystem];
    if (!system) return null;

    // When viewport is locked, use the viewport backtest signals for accurate visible range counts
    if (activeSystemBacktestSignals) {
      const buySignals = activeSystemBacktestSignals.buySignals.filter(s => s.type === 'zone-open').length;
      const sellSignals = activeSystemBacktestSignals.sellSignals.filter(s => s.type === 'zone-open').length;
      return {
        name: system.name,
        historicalSignalCount: buySignals + sellSignals,
        buySignals,
        sellSignals,
        lookbackCandles: activeSystemBacktestSignals.totalCandles,
      };
    }

    const buySignals = historicalSystemSignalEvents.filter(e => e.action === 'BUY OPEN').length;
    const sellSignals = historicalSystemSignalEvents.filter(e => e.action === 'SELL OPEN').length;

    return {
      name: system.name,
      historicalSignalCount: buySignals + sellSignals,
      buySignals,
      sellSignals,
      lookbackCandles: Math.min(400, Math.max(0, candles.length - 1)),
    };
  }, [tradingSystem.activeSystem, historicalSystemSignalEvents, candles.length, activeSystemBacktestSignals]);

  const handleSystemLockToViewport = useCallback((locked: boolean) => {
    if (!locked) {
      setActiveSystemBacktestSignals(null);
      setMaxOpportunityZones([]);
      // Clear opportunity price lines directly
      opportunityPriceLinesRef.current.forEach(line => {
        try { candleSeriesRef.current?.removePriceLine(line); } catch { /* removePriceLine may throw if chart is disposed */ }
      });
      opportunityPriceLinesRef.current = [];
      return;
    }
    if (!tradingSystem.activeSystem || !chartRef.current || candles.length < 2) return;

    const visibleRange = chartRef.current.timeScale().getVisibleLogicalRange();
    if (!visibleRange) return;

    const startIdx = Math.max(0, Math.floor(visibleRange.from));
    const endIdx = Math.min(candles.length - 1, Math.ceil(visibleRange.to));

    console.log(`Viewport locked: ${startIdx} to ${endIdx} (${endIdx - startIdx + 1} candles)`);

    const signals = runTradingSystemBacktest({
      systemId: tradingSystem.activeSystem,
      candles: candles as Candle[],
      startIdx,
      endIdx,
      oscillatorData,
      superTrendStandard: superTrendData.standard,
      structureBreaks,
      htfBiasEntries,
      divergencePoints,
      fvgs,
      orderBlocks,
      breakers,
      sqzData: [],
      liquidityZones,
      volumeProfileData,
      swingPoints,
    });

    setActiveSystemBacktestSignals(signals);
  }, [
    tradingSystem.activeSystem,
    chartRef,
    candles,
    oscillatorData,
    superTrendData.standard,
    structureBreaks,
    htfBiasEntries,
    divergencePoints,
    fvgs,
    orderBlocks,
    breakers,
    liquidityZones,
    volumeProfileData,
    swingPoints,
    candleSeriesRef,
  ]);

  const clearOpportunityPriceLines = useCallback(() => {
    if (!candleSeriesRef.current) return;
    opportunityPriceLinesRef.current.forEach(line => {
      try { candleSeriesRef.current?.removePriceLine(line); } catch { /* removePriceLine may throw if chart is disposed */ }
    });
    opportunityPriceLinesRef.current = [];
  }, [candleSeriesRef]);

  const handleFindMaxOpportunity = useCallback(() => {
    if (!chartRef.current || candles.length < 2) return;
    const visibleRange = chartRef.current.timeScale().getVisibleLogicalRange();
    if (!visibleRange) return;

    const startIdx = Math.max(0, Math.floor(visibleRange.from));
    const endIdx = Math.min(candles.length - 1, Math.ceil(visibleRange.to));

    setIsAnalyzingOpportunities(true);
    // Defer to next animation frame so the loading state renders before heavy computation
    requestAnimationFrame(() => {
      const smcWeights = getConditionWeights(tradingSystem.activeSystem === 'smc-trend-engine' ? 'smc-trend-engine' : 'smart-money');
      const zones = findMaximumOpportunityZones(
        candles as Candle[],
        startIdx,
        endIdx,
        autoFibResult,
        fvgs,
        orderBlocks,
        breakers,
        structureBreaks,
        liquidityZones,
        smcWeights,
      );
      setMaxOpportunityZones(zones);
      setIsAnalyzingOpportunities(false);

      // Render price lines on chart
      clearOpportunityPriceLines();
      if (candleSeriesRef.current) {
        const lines: IPriceLine[] = [];
        zones.forEach((zone, idx) => {
          const color =
            zone.strength === 'extreme' ? '#a855f7' :
            zone.strength === 'high' ? '#3b82f6' :
            zone.strength === 'moderate' ? '#06b6d4' :
            '#64748b';
          const line = candleSeriesRef.current!.createPriceLine({
            price: zone.priceLevel,
            color,
            lineWidth: zone.strength === 'extreme' ? 3 : 2,
            lineStyle: 0,
            axisLabelVisible: true,
            title: `Zone #${idx + 1} (${zone.confluenceScore} pts)`,
          });
          lines.push(line);
        });
        opportunityPriceLinesRef.current = lines;
      }
    });
  }, [
    tradingSystem.activeSystem,
    chartRef,
    candles,
    autoFibResult,
    fvgs,
    orderBlocks,
    breakers,
    structureBreaks,
    liquidityZones,
    clearOpportunityPriceLines,
    candleSeriesRef,
  ]);

  const handleClearOpportunityZones = useCallback(() => {
    setMaxOpportunityZones([]);
    clearOpportunityPriceLines();
  }, [clearOpportunityPriceLines]);

  const handleJumpToZone = useCallback((candleIndex: number) => {
    if (!chartRef.current) return;
    const halfWindow = 50;
    chartRef.current.timeScale().setVisibleLogicalRange({
      from: candleIndex - halfWindow,
      to: candleIndex + halfWindow,
    });
  }, [chartRef]);

  const totalConfluenceNow = useMultiSystemConfluence(
    effectiveCandles,
    oscillatorData,
    superTrendData,
    structureBreaks,
    htfBiasEntries,
    divergencePoints,
    fvgs.map(fvg => ({ high: fvg.top, low: fvg.bottom, filled: fvg.mitigated, type: fvg.type })),
    orderBlocks.map(ob => ({
      high: ob.top,
      low: ob.bottom,
      type: ob.type,
      mitigated: ob.mitigated,
    })),
    breakers.map(b => ({
      high: b.top,
      low: b.bottom,
      type: b.type,
      mitigated: b.mitigated,
      conversionIndex: b.conversionIndex,
      conversionPrice: b.conversionPrice,
    })),
    liquidityZones.map(lz => ({
      price: lz.price,
      type: lz.type,
      swept: lz.swept,
      sweepPrice: lz.sweepPrice,
      sweepIndex: lz.sweepIndex,
      sweptIndex: lz.sweptIndex,
    })),
    volumeProfileData
      ? { rows: volumeProfileData.rows.map(r => ({ price: r.price, volume: r.volume })), valueAreaHigh: volumeProfileData.vahPrice, valueAreaLow: volumeProfileData.valPrice, poc: volumeProfileData.poc }
      : undefined,
    conditionWeightsVersion,
    autoFibResult,
    swingPoints,
    showOwnerOnlyTools ? undefined : OWNER_ONLY_TRADING_SYSTEM_IDS,
  );

  const totalConfluenceNowRef = useRef(totalConfluenceNow);

  useEffect(() => {
    totalConfluenceNowRef.current = totalConfluenceNow;
  }, [totalConfluenceNow]);

  useEffect(() => {
    if (!totalConfluenceNow) {
      setConfluenceSnapshot(null);
      return;
    }

    setConfluenceSnapshot({
      ...totalConfluenceNow,
      updatedAt: Date.now(),
    });
  }, [totalConfluenceNow]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const current = totalConfluenceNowRef.current;
      if (!current) return;

      setConfluenceSnapshot({
        ...current,
        updatedAt: Date.now(),
      });
    }, TOTAL_CONFLUENCE_REFRESH_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('floatingConfluenceVisible', JSON.stringify(showFloatingConfluence));
    } catch {
      // ignore
    }
  }, [showFloatingConfluence]);

  useEffect(() => {
    try {
      localStorage.setItem('gdsMiniBadgeVisible', JSON.stringify(showGdsMiniBadge));
    } catch {
      // ignore
    }
  }, [showGdsMiniBadge]);

  // Visual rewind marker: add an orange price line at the rewound candle's close price
  const rewindPriceLineRef = useRef<IPriceLine | null>(null);
  useEffect(() => {
    const series = candleSeriesRef.current;
    if (!series) return;

    // Remove any previous rewind line
    if (rewindPriceLineRef.current) {
      try { series.removePriceLine(rewindPriceLineRef.current); } catch { /* ignore */ }
      rewindPriceLineRef.current = null;
    }

    if (rewindPosition === null) return;

    const candle = candles[rewindPosition - 1];
    if (!candle) return;

    rewindPriceLineRef.current = series.createPriceLine({
      price: (candle as Candle).close,
      color: '#f59e0b',
      lineWidth: 2,
      lineStyle: 2, // Dashed
      axisLabelVisible: true,
      title: 'REWIND',
    });
  }, [rewindPosition, candles, candleSeriesRef]);

  // Hooks - Drawing persistence
  const drawingsPersistence = useDrawingsPersistence(symbol, timeframe);

  const {
    canUndo,
    canRedo,
    handleUndo,
    handleRedo,
    recordAdd,
    recordDelete,
    updateDrawingId,
  } = useDrawingHistory({ drawingsPersistence, setDrawings });

  const {
    ewLabels,
    saveEWLabelMutation,
    deleteEWLabelMutation,
  } = useElliottWaveLabels({ symbol, timeframe, toast });

  // Hooks - Drawing interaction
  const drawingInteraction = useDrawingInteraction({
    chartRef,
    candleSeriesRef,
    containerRef: chartContainerRef,
    drawings,
    activeTool,
  });

  const estimatedIntervalSeconds = useMemo(() => {
    if (candles.length >= 2) {
      const delta = Number(candles[candles.length - 1].time) - Number(candles[candles.length - 2].time);
      if (Number.isFinite(delta) && delta > 0) return delta;
    }
    return 60;
  }, [candles]);

  const timeToLogical = useCallback((time: number): number => {
    const chart = chartRef.current;
    if (chart) {
      const x = chart.timeScale().timeToCoordinate(time as Time);
      if (x !== null) {
        const logical = chart.timeScale().coordinateToLogical(x);
        if (logical !== null) return logical;
      }
    }

    if (candles.length === 0) return 0;
    const first = Number(candles[0].time);
    return (time - first) / estimatedIntervalSeconds;
  }, [chartRef, candles, estimatedIntervalSeconds]);

  const logicalToTime = useCallback((logical: number): number => {
    if (candles.length === 0) return 0;
    const rounded = Math.round(logical);

    if (rounded >= 0 && rounded < candles.length) {
      return Number(candles[rounded].time);
    }

    const first = Number(candles[0].time);
    return first + (rounded * estimatedIntervalSeconds);
  }, [candles, estimatedIntervalSeconds]);

  const getChartPointFromClient = useCallback((clientX: number, clientY: number) => {
    if (!chartRef.current || !candleSeriesRef.current || !chartContainerRef.current) return null;

    const rect = chartContainerRef.current.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const logical = chartRef.current.timeScale().coordinateToLogical(localX);
    const price = candleSeriesRef.current.coordinateToPrice(localY);

    if (logical === null || price === null) return null;
    return { logical, price, localX, localY };
  }, [chartRef, candleSeriesRef, chartContainerRef]);

  const pauseChartPanZoom = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (!chartPanZoomRestoreRef.current) {
      const opts = chart.options() as any;
      chartPanZoomRestoreRef.current = {
        // Default to true so that if lightweight-charts returns undefined for an
        // option that was never explicitly set, we still re-enable scroll/scale.
        handleScroll: opts.handleScroll ?? true,
        handleScale: opts.handleScale ?? true,
      };
    }
    chart.applyOptions({
      handleScroll: false,
      handleScale: false,
    });
  }, [chartRef]);

  const resumeChartPanZoom = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) {
      chartPanZoomRestoreRef.current = null;
      return;
    }
    const restore = chartPanZoomRestoreRef.current;
    chart.applyOptions({
      handleScroll: restore?.handleScroll ?? true,
      handleScale: restore?.handleScale ?? true,
    });
    chartPanZoomRestoreRef.current = null;
  }, [chartRef]);

  const findNearestPointIndex = useCallback((drawing: Drawing, localX: number, localY: number): number | null => {
    if (!chartRef.current || !candleSeriesRef.current || drawing.points.length === 0) return null;

    const HANDLE_RADIUS = 14;
    let bestIndex: number | null = null;
    let bestDistance = Infinity;

    drawing.points.forEach((point, index) => {
      const x = chartRef.current?.timeScale().timeToCoordinate(point.time as Time);
      const y = candleSeriesRef.current?.priceToCoordinate(point.price);
      if (x == null || y == null) return;

      const distance = Math.hypot(localX - x, localY - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestDistance <= HANDLE_RADIUS ? bestIndex : null;
  }, [chartRef, candleSeriesRef]);

  const beginDrawingDrag = useCallback((clientX: number, clientY: number): boolean => {
    if (activeTool || !drawingInteraction.selectedDrawingId) return false;

    const drawing = drawings.find(d => d.id === drawingInteraction.selectedDrawingId);
    if (!drawing || drawing.type === 'elliott_wave') return false;
    // Prevent dragging drawings that belong to a higher timeframe
    if (drawing.timeframe && drawing.timeframe !== timeframe) return false;

    const chartPoint = getChartPointFromClient(clientX, clientY);
    if (!chartPoint) return false;

    const pointIndex = findNearestPointIndex(drawing, chartPoint.localX, chartPoint.localY);
    const basePointLogicals = drawing.points.map(p => timeToLogical(Number(p.time)));

    if (pointIndex !== null) {
      setActiveEdit({
        drawingId: drawing.id,
        pointIndex,
        originalDrawing: { ...drawing, points: [...drawing.points] },
      });

      dragEditStateRef.current = {
        drawingId: drawing.id,
        mode: 'point',
        pointIndex,
        startLogical: chartPoint.logical,
        startPrice: chartPoint.price,
        basePoints: drawing.points.map(p => ({ ...p })),
        basePointLogicals,
        latestPoints: drawing.points.map(p => ({ ...p })),
      };
      pauseChartPanZoom();
      return true;
    }

    if (moveArmedDrawingId !== drawing.id || !chartRef.current || !candleSeriesRef.current) return false;

    const hits = findDrawingsNearClick(
      chartPoint.localX,
      chartPoint.localY,
      [drawing as any],
      chartRef.current,
      candleSeriesRef.current,
    );

    if (hits.length === 0) return false;

    setActiveEdit(null);
    dragEditStateRef.current = {
      drawingId: drawing.id,
      mode: 'move',
      startLogical: chartPoint.logical,
      startPrice: chartPoint.price,
      basePoints: drawing.points.map(p => ({ ...p })),
      basePointLogicals,
      latestPoints: drawing.points.map(p => ({ ...p })),
    };

    pauseChartPanZoom();

    return true;
  }, [
    activeTool,
    drawingInteraction.selectedDrawingId,
    drawings,
    getChartPointFromClient,
    findNearestPointIndex,
    timeToLogical,
    moveArmedDrawingId,
    chartRef,
    candleSeriesRef,
    pauseChartPanZoom,
  ]);

  const updateDrawingDrag = useCallback((clientX: number, clientY: number) => {
    const drag = dragEditStateRef.current;
    if (!drag) return;

    const chartPoint = getChartPointFromClient(clientX, clientY);
    if (!chartPoint) return;

    let nextPoints: Drawing['points'];
    if (drag.mode === 'point' && typeof drag.pointIndex === 'number') {
      nextPoints = drag.basePoints.map((point, index) => {
        if (index !== drag.pointIndex) return { ...point };
        return {
          ...point,
          time: logicalToTime(chartPoint.logical),
          price: chartPoint.price,
          snapType: 'none',
        };
      });
    } else {
      const deltaLogical = chartPoint.logical - drag.startLogical;
      const deltaPrice = chartPoint.price - drag.startPrice;

      nextPoints = drag.basePoints.map((point, index) => ({
        ...point,
        time: logicalToTime(drag.basePointLogicals[index] + deltaLogical),
        price: point.price + deltaPrice,
        snapType: 'none',
      }));
    }

    drag.latestPoints = nextPoints;
    setDrawings(previous => previous.map(item => (
      item.id === drag.drawingId
        ? { ...item, points: nextPoints }
        : item
    )));
  }, [getChartPointFromClient, logicalToTime]);

  const endDrawingDrag = useCallback(() => {
    const drag = dragEditStateRef.current;
    if (!drag) return;

    const drawing = drawings.find(d => d.id === drag.drawingId);
    if (drawing && !drag.drawingId.startsWith('drawing-') && drawing.type !== 'elliott_wave') {
      drawingsPersistence.updateDrawing({
        id: drag.drawingId,
        updates: { coordinates: { points: drag.latestPoints } },
      });
    }

    dragEditStateRef.current = null;
    setActiveEdit(null);
    setMoveArmedDrawingId(null);
    resumeChartPanZoom();
  }, [drawings, drawingsPersistence, resumeChartPanZoom]);

  useEffect(() => {
    return () => {
      resumeChartPanZoom();
    };
  }, [resumeChartPanZoom]);

  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    const onMouseDown = (event: MouseEvent) => {
      if (beginDrawingDrag(event.clientX, event.clientY)) {
        event.preventDefault();
      }
    };

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      if (beginDrawingDrag(touch.clientX, touch.clientY)) {
        event.preventDefault();
      }
    };

    const onMouseMove = (event: MouseEvent) => {
      if (!dragEditStateRef.current) return;
      event.preventDefault();
      updateDrawingDrag(event.clientX, event.clientY);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!dragEditStateRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      event.preventDefault();
      updateDrawingDrag(touch.clientX, touch.clientY);
    };

    const onPointerEnd = () => {
      if (!dragEditStateRef.current) return;
      suppressNextClickRef.current = true;
      endDrawingDrag();
    };

    const onClickCapture = (event: MouseEvent) => {
      if (!suppressNextClickRef.current) return;
      suppressNextClickRef.current = false;
      event.stopImmediatePropagation();
      event.preventDefault();
    };

    // If the pointer leaves the window (or touch is cancelled) while dragging, end
    // the drag so that resumeChartPanZoom() is called and the chart does not stay frozen.
    const onPointerLeaveOrCancel = () => {
      if (!dragEditStateRef.current) return;
      endDrawingDrag();
    };

    container.addEventListener('mousedown', onMouseDown);
    container.addEventListener('touchstart', onTouchStart, { passive: false });
    container.addEventListener('click', onClickCapture, true);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('mouseup', onPointerEnd);
    window.addEventListener('touchend', onPointerEnd);
    document.addEventListener('mouseleave', onPointerLeaveOrCancel);
    window.addEventListener('touchcancel', onPointerLeaveOrCancel);
    window.addEventListener('blur', onPointerLeaveOrCancel);

    return () => {
      container.removeEventListener('mousedown', onMouseDown);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('click', onClickCapture, true);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('mouseup', onPointerEnd);
      window.removeEventListener('touchend', onPointerEnd);
      document.removeEventListener('mouseleave', onPointerLeaveOrCancel);
      window.removeEventListener('touchcancel', onPointerLeaveOrCancel);
      window.removeEventListener('blur', onPointerLeaveOrCancel);
    };
  }, [beginDrawingDrag, updateDrawingDrag, endDrawingDrag]);

  useEffect(() => {
    if (!moveArmedDrawingId) return;
    if (drawingInteraction.selectedDrawingId === moveArmedDrawingId) return;
    setMoveArmedDrawingId(null);
  }, [moveArmedDrawingId, drawingInteraction.selectedDrawingId]);

  const handleEditMoveDrawing = useCallback(() => {
    if (!drawingInteraction.selectedDrawingId) return;
    setMoveArmedDrawingId(drawingInteraction.selectedDrawingId);
    toast({
      title: 'Edit mode enabled',
      description: 'Drag a point to reshape, or drag the drawing to move it.',
    });
  }, [drawingInteraction.selectedDrawingId, toast]);

  const handleDrawingComplete = useCallback((tool: Exclude<ChartDrawingTool, null>) => {
    const repeatPlaceTools: ChartDrawingTool[] = ['trendline', 'horizontal', 'rectangle', 'channel', 'number_label'];
    setTempDrawing(null);
    drawingInteraction.suppressNextSelect();

    if (repeatPlaceTools.includes(tool)) {
      return;
    }

    setActiveTool(null);
    activeToolRef.current = null;
  }, [drawingInteraction.suppressNextSelect]);

  const handleToggleDrawingsVisible = useCallback(() => {
    setDrawingsVisible((visible: boolean) => !visible);
  }, []);

  const handleClearAllDrawings = useCallback(() => {
    if (!window.confirm('Delete all drawings for this timeframe? This cannot be undone.')) return;
    setDrawings([]);
    drawingsPersistence.clearDrawings();
  }, [drawingsPersistence]);

  const handleDisableAllIndicators = useCallback(() => {
    indicators.ema.setShow(false);
    indicators.sma.setShow(false);
    indicators.bb.setShow(false);
    indicators.vwap.setShowSession(false);
    indicators.vwap.setShowDaily(false);
    indicators.vwap.setShowWeekly(false);
    indicators.vwap.setShowMonthly(false);
    indicators.vwap.setShowRolling(false);
    indicators.elderImpulse.setShow(false);
    indicators.rsi.setShow(false);
    indicators.macd.setShow(false);
    indicators.stochRSI.setShow(false);
    indicators.obv.setShow(false);
    indicators.mfi.setShow(false);
    indicators.williamsR.setShow(false);
    indicators.cci.setShow(false);
    indicators.adx.setShow(false);

    ALL_OSCILLATOR_IDS.forEach((oscillatorId) => {
      oscillatorPanel.toggleOscillator(oscillatorId, false);
    });

    setDivergenceScannerEnabled(false);
    volumeEmaSettings.updateSettings({ enabled: false });
    autoTrendlineSettings.updateSettings({ enabled: false });
    swoopSettings.updateSettings({ enabled: false });
    fvgSettings.updateSetting('enabled', false);
    obSettings.updateSetting('enabled', false);
    breakerSettings.updateSetting('enabled', false);
    bosSettings.updateSetting('enabled', false);
    liquiditySettings.updateSetting('enabled', false);
    pdZoneSettings.updateSetting('enabled', false);
    autoFibSettings.updateSettings({ enabled: false });
    superTrendSettings.updateSettings({
      standard: { ...superTrendSettings.settings.standard, enabled: false },
      adx: { ...superTrendSettings.settings.adx, enabled: false },
      keltner: { ...superTrendSettings.settings.keltner, enabled: false },
    });
    vpSettings.updateSettings({ enabled: false });
    lhSettings.updateSettings({ enabled: false });
    htfBiasSettings.updateSetting('enabled', false);
    setShowGdsMiniBadge(false);

    toast({
      title: 'Indicators disabled',
      description: 'All chart indicators and oscillators were turned off.',
    });
  }, [
    indicators,
    oscillatorPanel,
    setDivergenceScannerEnabled,
    fvgSettings,
    obSettings,
    breakerSettings,
    bosSettings,
    liquiditySettings,
    pdZoneSettings,
    autoFibSettings,
    autoTrendlineSettings,
    swoopSettings,
    volumeEmaSettings,
    superTrendSettings,
    vpSettings,
    lhSettings,
    htfBiasSettings,
    toast,
  ]);

  const waveSelection = useWaveSelection({
    drawings,
    candles: candles as Array<{ time: number }>,
    drawingInteraction,
  });

  useElliottWaveRendering({
    candleSeriesRef,
    chartRef,
    candles,
    drawings,
    selectedWaveDegree,
    selectedWaveId: waveSelection.selectedWaveId,
    elliottWave,
  });

  const elliottWaveController = useElliottWaveController({
    activeTool,
    elliottWave,
    waveSelection,
    symbol,
    timeframe,
    selectedWaveDegree,
    selectedWaveLabel,
    selectedWavePatternType,
    setShowDegreePicker,
    setSelectedWaveDegree,
    setSelectedWaveLabel,
    setSelectedWavePatternType,
    setActiveTool,
    activeToolRef,
    saveEWLabelMutation,
  });

  const drawingActions = useFullscreenDrawingActions({
    selectedDrawingId: drawingInteraction.selectedDrawingId,
    drawings,
    setDrawings,
    currentTimeframe: timeframe,
    drawingsPersistence,
    deleteEWLabelMutation,
    recordDelete,
    setSelectedDrawingId: drawingInteraction.setSelectedDrawingId,
  });

  useElliottWaveKeyboardShortcuts({
    elliottWave,
    onDeactivateTool: elliottWaveController.deactivateTool,
    toast,
  });

  // Hooks - Drawing primitives (side effect only)
  useDrawingPrimitives({
    chartRef,
    candleSeriesRef,
    drawings,
    selectedDrawingId: drawingInteraction.selectedDrawingId,
    activeEdit,
    visible: drawingsVisible,
    candles: candles as Array<{ time: number | string }>,
  });

  // Extract wave endpoints from all saved drawings for priority snapping
  const waveEndpoints = useMemo(() =>
    drawings
      .filter(d => d.type === 'elliott_wave' && d.points.length > 0)
      .flatMap(d => d.points.map(p => ({ time: p.time, price: p.price }))),
    [drawings]
  );

  // Hooks - Gesture controller
  const gestureController = useChartGestures({
    enabled: activeTool !== null && activeTool !== 'free_draw',
    data: candles as unknown as { time: Time; open: number; high: number; low: number; close: number }[],
    onPointCommit: (point) => {
      drawingInteraction.suppressNextSelect();
      onPointCommitRef.current?.(point);
    },
    onCrosshairModeChange: () => {},
    autoSnapEnabled: true,
    waveEndpoints,
  });

  useFullscreenChartLifecycle({
    candleSeriesRef,
    chartRef,
    chartContainerRef,
    candles,
    candlesKey,
    timeframe,
    symbol,
    isLoading,
    fitContent,
    handleChartClick: drawingInteraction.handleChartClick as EventListener,
    handleTouchEnd: drawingInteraction.handleTouchEnd as EventListener,
    gestureController,
    rewindPosition,
  });

  useHydratedDrawings({
    persistedDrawings: drawingsPersistence.drawings,
    ewLabels,
    setDrawings,
  });

  // Update refs
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { freeDrawModeRef.current = freeDrawMode; }, [freeDrawMode]);
  useEffect(() => { freeDrawColorRef.current = freeDrawColor; }, [freeDrawColor]);
  useEffect(() => { freeDrawLineWidthRef.current = freeDrawLineWidth; }, [freeDrawLineWidth]);

  // Resume pan/zoom whenever activeTool changes (including when cancelled via Escape or
  // tool-switch). This unblocks the chart if pauseChartPanZoom() was called mid-stroke
  // but resumeChartPanZoom() was never reached due to the interrupted interaction.
  //
  // symbol/timeframe are also included: cycling the timeframe while a drawing drag or
  // free-draw stroke had paused pan/zoom could otherwise leave the chart frozen (pan/zoom
  // disabled) with no code path to re-enable it — forcing the user to exit and reopen the
  // fullscreen chart just to scroll again. Re-running here guarantees pan/zoom is restored
  // and any stuck drag state is cleared on every symbol/timeframe switch.
  useEffect(() => {
    resumeChartPanZoom();
    dragEditStateRef.current = null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool, symbol, timeframe]);

  const modalHelpers = useFullscreenModalHelpers({
    selectedDrawingId: drawingInteraction.selectedDrawingId,
    drawings,
    setSettingsModalOpen,
  });

  // Drawing alerts handler
  const handleOpenDrawingAlerts = useCallback(() => {
    if (!drawingInteraction.selectedDrawingId) return;
    const drawing = drawings.find(d => d.id === drawingInteraction.selectedDrawingId);
    if (!drawing) return;
    // Add symbol and timeframe to drawing for alert modal
    const drawingWithContext = {
      ...drawing,
      drawingType: drawing.type,
      symbol,
      timeframe,
    };
    setSelectedDrawingForAlerts(drawingWithContext as any);
    setShowDrawingAlertSettings(true);
  }, [drawingInteraction.selectedDrawingId, drawings, symbol, timeframe]);

  const saveDrawingWithUndo = useSaveDrawingWithUndo({
    saveDrawing: drawingsPersistence.saveDrawing,
    recordAdd,
    updateDrawingId,
  });

  // Wrapper that tracks the last used tool so toggling draw mode restores it
  const handleSelectToolWithMemory = useCallback((tool: ChartDrawingTool) => {
    if (tool) {
      lastUsedToolRef.current = tool;
    }
    elliottWaveController.handleSelectTool(tool);
  }, [elliottWaveController]);

  /** Returns the next sequential number for a number_label drawing. */
  const getNextNumberLabel = useCallback(() => {
    const max = drawings.reduce((acc, d) => {
      if (d.type === 'number_label') {
        const n = parseInt(d.style?.text ?? '0', 10);
        return Number.isFinite(n) ? Math.max(acc, n) : acc;
      }
      return acc;
    }, 0);
    return max + 1;
  }, [drawings]);

  // ── Free draw capture ──────────────────────────────────────────────────────
  // When free_draw tool is active, capture raw pixel points on drag and convert
  // to time/price after the stroke ends, then apply the selected sub-mode algorithm.
  useEffect(() => {
    if (activeTool !== 'free_draw') return;
    const container = chartContainerRef.current;
    if (!container) return;

    let isDrawing = false;
    const rawPx: { x: number; y: number }[] = [];

    const getLocalXY = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const onStart = (clientX: number, clientY: number) => {
      isDrawing = true;
      rawPx.length = 0;
      pauseChartPanZoom();
      rawPx.push(getLocalXY(clientX, clientY));
    };

    const onMove = (clientX: number, clientY: number) => {
      if (!isDrawing) return;
      rawPx.push(getLocalXY(clientX, clientY));
    };

    const finishStroke = () => {
      if (!isDrawing) {
        resumeChartPanZoom();
        return;
      }
      isDrawing = false;
      resumeChartPanZoom();

      if (rawPx.length < 2 || !chartRef.current || !candleSeriesRef.current) return;

      // Convert every raw pixel to (time, price)
      const allPoints: { time: number; price: number }[] = [];
      for (const px of rawPx) {
        const logical = chartRef.current.timeScale().coordinateToLogical(px.x);
        const price = candleSeriesRef.current.coordinateToPrice(px.y);
        if (logical === null || price === null) continue;
        allPoints.push({ time: logicalToTime(logical), price });
      }
      if (allPoints.length < 2) return;

      // Apply sub-mode algorithm
      let finalPoints: { time: number; price: number }[];
      const currentMode = freeDrawModeRef.current;
      if (currentMode === 'free') {
        // Thin the raw points by taking every Nth point to avoid enormous arrays
        finalPoints = rawPx
          .filter((_, i) => i % FREE_MODE_POINT_INTERVAL === 0 || i === rawPx.length - 1)
          .map((px) => {
            const logical = chartRef.current!.timeScale().coordinateToLogical(px.x);
            const price = candleSeriesRef.current!.coordinateToPrice(px.y);
            if (logical === null || price === null) return null;
            return { time: logicalToTime(logical), price: Number(price) };
          })
          .filter((p): p is { time: number; price: number } => p !== null);
      } else if (currentMode === 'line_assisted') {
        const indices = simplifyForLine(rawPx);
        // indices are guaranteed within [0, allPoints.length-1] by simplifyForLine
        finalPoints = indices.map((i) => allPoints[i]).filter(Boolean);
      } else if (currentMode === 'arrow') {
        // Straight line (start → end only) with arrow head rendered at tip
        finalPoints = [allPoints[0], allPoints[allPoints.length - 1]];
      } else {
        // curve_assisted
        const indices = simplifyForCurve(rawPx);
        // indices are guaranteed within [0, allPoints.length-1] by simplifyForCurve
        finalPoints = indices.map((i) => allPoints[i]).filter(Boolean);
      }

      if (finalPoints.length < 2) return;

      const newDrawing: Drawing = {
        id: `drawing-${Date.now()}`,
        type: 'free_draw',
        points: finalPoints,
        style: {
          color: freeDrawColorRef.current,
          lineWidth: freeDrawLineWidthRef.current,
          drawSubMode: currentMode,
        },
        timeframe,
      };

      setDrawings((d: Drawing[]) => [...d, newDrawing]);
      saveDrawingWithUndo(newDrawing);
      toast({ title: 'Drawing Saved', description: 'Free draw added to chart' });
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      e.preventDefault();
      try { container.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      onStart(e.clientX, e.clientY);
    };
    const onPointerMove = (e: PointerEvent) => { onMove(e.clientX, e.clientY); };
    const onPointerUp = (e: PointerEvent) => {
      try { container.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      finishStroke();
    };
    const onPointerCancel = () => {
      isDrawing = false;
      resumeChartPanZoom();
    };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerCancel);
    window.addEventListener('blur', onPointerCancel);

    return () => {
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerCancel);
      window.removeEventListener('blur', onPointerCancel);
      isDrawing = false;
      resumeChartPanZoom();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // The effect uses refs (chartRef, candleSeriesRef, freeDrawModeRef) and stable
  // callbacks (pauseChartPanZoom, resumeChartPanZoom, saveDrawingWithUndo, toast,
  // setDrawings, logicalToTime) that do not need to re-run the effect.
  // Only activeTool and timeframe drive re-binding of event listeners.
  }, [activeTool, timeframe]);

  useFullscreenKeyboardShortcuts({
    activeTool,
    setActiveTool,
    activeToolRef,
    lastUsedToolRef,
    onSelectTool: handleSelectToolWithMemory,
    onDeleteSelected: drawingActions.handleDeleteDrawing,
    onDeselectAll: () => drawingInteraction.setSelectedDrawingId(null),
    onUndo: handleUndo,
    onRedo: handleRedo,
  });

  // Keep pick-mode ref in sync so the click handler (registered via addEventListener) can read it
  useEffect(() => { tradePickModeRef.current = tradePickMode; }, [tradePickMode]);

  // Escape cancels chart-pick mode
  useEffect(() => {
    if (!tradePickMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setTradePickMode(null);
        tradePickModeRef.current = null;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tradePickMode]);

  // Single click on chart resolves the pick
  useEffect(() => {
    if (!tradePickMode) return;
    const container = chartContainerRef.current;
    if (!container) return;

    const onClick = (e: MouseEvent) => {
      const field = tradePickModeRef.current;
      if (!field) return;
      const pt = getChartPointFromClient(e.clientX, e.clientY);
      if (!pt) return;
      const time = logicalToTime(pt.logical);
      if (!time) return;
      setChartPickValue({ price: pt.price, time });
      setTradePickMode(null);
      tradePickModeRef.current = null;
    };

    // Use capture so it fires before chart's own click handlers
    container.addEventListener('click', onClick, true);
    return () => container.removeEventListener('click', onClick, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradePickMode]);

  // Elliott Wave: auto-save the wave immediately when all points are placed and valid
  useEffect(() => {
    if (elliottWave.isComplete && elliottWave.isValid) {
      elliottWaveController.handleElliottWaveSave();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elliottWave.isComplete, elliottWave.isValid]);

  // --- Indicator Persistence ---
  //
  // Two separate localStorage keys:
  //   indicatorDefaults_${symbol}_${timeframe}  — per-timeframe indicator PARAMETERS
  //   oscillatorDefaults_${symbol}              — global per-symbol oscillator panel
  //                                               selections and toggle states (highLow,
  //                                               divergenceScanner).  These should be
  //                                               shared across all timeframes.

  const saveIndicatorDefaults = useCallback(() => {
    try {
      // --- Per-timeframe indicator parameters ---
      const tfKey = `indicatorDefaults_${symbol}_${timeframe}`;
      const tfData = {
        indicators: {
          ema: { show: indicators.ema.show, configs: indicators.ema.configs, inputs: indicators.ema.inputs },
          sma: { show: indicators.sma.show, configs: indicators.sma.configs },
          bb: { show: indicators.bb.show, period: indicators.bb.period, stdDev: indicators.bb.stdDev },
          vwap: {
            showSession: indicators.vwap.showSession,
            showDaily: indicators.vwap.showDaily,
            showWeekly: indicators.vwap.showWeekly,
            showMonthly: indicators.vwap.showMonthly,
            showRolling: indicators.vwap.showRolling,
            rollingPeriod: indicators.vwap.rollingPeriod,
          },
          elderImpulse: { show: indicators.elderImpulse.show },
          rsi: { show: indicators.rsi.show, period: indicators.rsi.period },
          macd: { show: indicators.macd.show, fast: indicators.macd.fast, slow: indicators.macd.slow, signal: indicators.macd.signal },
          stochRSI: { show: indicators.stochRSI.show, period: indicators.stochRSI.period },
          obv: { show: indicators.obv.show },
          mfi: { show: indicators.mfi.show, period: indicators.mfi.period },
          williamsR: { show: indicators.williamsR.show, period: indicators.williamsR.period },
          cci: { show: indicators.cci.show, period: indicators.cci.period },
          adx: { show: indicators.adx.show, period: indicators.adx.period },
        },
      };
      localStorage.setItem(tfKey, JSON.stringify(tfData));

      // --- Global per-symbol settings (shared across all timeframes) ---
      const symKey = `oscillatorDefaults_${symbol}`;
      const symData = {
        oscillatorPanel: {
          selected: Array.from(oscillatorPanel.selectedOscillators),
        },
        highLowEnabled,
        divergenceScannerEnabled,
      };
      localStorage.setItem(symKey, JSON.stringify(symData));

      console.log(`💾 Saved indicator defaults for ${symbol}_${timeframe}`);
    } catch {
      // Ignore storage errors (e.g. quota exceeded)
    }
  }, [
    symbol, timeframe,
    indicators.ema.show, indicators.ema.configs, indicators.ema.inputs,
    indicators.sma.show, indicators.sma.configs,
    indicators.bb.show, indicators.bb.period, indicators.bb.stdDev,
    indicators.vwap.showSession, indicators.vwap.showDaily, indicators.vwap.showWeekly,
    indicators.vwap.showMonthly, indicators.vwap.showRolling, indicators.vwap.rollingPeriod,
    indicators.elderImpulse.show,
    indicators.rsi.show, indicators.rsi.period,
    indicators.macd.show, indicators.macd.fast, indicators.macd.slow, indicators.macd.signal,
    indicators.stochRSI.show, indicators.stochRSI.period,
    indicators.obv.show,
    indicators.mfi.show, indicators.mfi.period,
    indicators.williamsR.show, indicators.williamsR.period,
    indicators.cci.show, indicators.cci.period,
    indicators.adx.show, indicators.adx.period,
    oscillatorPanel.selectedOscillators,
    highLowEnabled,
    divergenceScannerEnabled,
  ]);

  const loadIndicatorDefaults = useCallback(() => {
    try {
      // --- Per-timeframe indicator parameters ---
      const tfKey = `indicatorDefaults_${symbol}_${timeframe}`;
      const savedTf = localStorage.getItem(tfKey);
      if (savedTf) {
        const data = JSON.parse(savedTf);
        const ind = data.indicators || {};

        // EMA
        if (ind.ema) {
          if (ind.ema.show !== undefined) indicators.ema.setShow(ind.ema.show);
          if (Array.isArray(ind.ema.configs)) {
            indicators.ema.setConfigs(ind.ema.configs);
            const inputs: Record<string, string> = {};
            ind.ema.configs.forEach((c: MAConfig) => { inputs[c.id] = String(c.period); });
            indicators.ema.setInputs(inputs);
          }
        }

        // SMA
        if (ind.sma) {
          if (ind.sma.show !== undefined) indicators.sma.setShow(ind.sma.show);
          if (Array.isArray(ind.sma.configs)) indicators.sma.setConfigs(ind.sma.configs);
        }

        // Bollinger Bands
        if (ind.bb) {
          if (ind.bb.show !== undefined) indicators.bb.setShow(ind.bb.show);
          if (ind.bb.period !== undefined) { indicators.bb.setPeriod(ind.bb.period); indicators.bb.setPeriodInput(String(ind.bb.period)); }
          if (ind.bb.stdDev !== undefined) { indicators.bb.setStdDev(ind.bb.stdDev); indicators.bb.setStdDevInput(String(ind.bb.stdDev)); }
        }

        // VWAP
        if (ind.vwap) {
          if (ind.vwap.showSession !== undefined) indicators.vwap.setShowSession(ind.vwap.showSession);
          if (ind.vwap.showDaily !== undefined) indicators.vwap.setShowDaily(ind.vwap.showDaily);
          if (ind.vwap.showWeekly !== undefined) indicators.vwap.setShowWeekly(ind.vwap.showWeekly);
          if (ind.vwap.showMonthly !== undefined) indicators.vwap.setShowMonthly(ind.vwap.showMonthly);
          if (ind.vwap.showRolling !== undefined) indicators.vwap.setShowRolling(ind.vwap.showRolling);
          if (ind.vwap.rollingPeriod !== undefined) {
            indicators.vwap.setRollingPeriod(ind.vwap.rollingPeriod);
            indicators.vwap.setRollingPeriodInput(String(ind.vwap.rollingPeriod));
          }
        }

        // Elder Impulse
        if (ind.elderImpulse?.show !== undefined) indicators.elderImpulse.setShow(ind.elderImpulse.show);

        // RSI
        if (ind.rsi) {
          if (ind.rsi.show !== undefined) indicators.rsi.setShow(ind.rsi.show);
          if (ind.rsi.period !== undefined) { indicators.rsi.setPeriod(ind.rsi.period); indicators.rsi.setPeriodInput(String(ind.rsi.period)); }
        }

        // MACD
        if (ind.macd) {
          if (ind.macd.show !== undefined) indicators.macd.setShow(ind.macd.show);
          if (ind.macd.fast !== undefined) { indicators.macd.setFast(ind.macd.fast); indicators.macd.setFastInput(String(ind.macd.fast)); }
          if (ind.macd.slow !== undefined) { indicators.macd.setSlow(ind.macd.slow); indicators.macd.setSlowInput(String(ind.macd.slow)); }
          if (ind.macd.signal !== undefined) { indicators.macd.setSignal(ind.macd.signal); indicators.macd.setSignalInput(String(ind.macd.signal)); }
        }

        // Stochastic RSI
        if (ind.stochRSI) {
          if (ind.stochRSI.show !== undefined) indicators.stochRSI.setShow(ind.stochRSI.show);
          if (ind.stochRSI.period !== undefined) { indicators.stochRSI.setPeriod(ind.stochRSI.period); indicators.stochRSI.setPeriodInput(String(ind.stochRSI.period)); }
        }

        // OBV
        if (ind.obv?.show !== undefined) indicators.obv.setShow(ind.obv.show);

        // MFI
        if (ind.mfi) {
          if (ind.mfi.show !== undefined) indicators.mfi.setShow(ind.mfi.show);
          if (ind.mfi.period !== undefined) { indicators.mfi.setPeriod(ind.mfi.period); indicators.mfi.setPeriodInput(String(ind.mfi.period)); }
        }

        // Williams %R
        if (ind.williamsR) {
          if (ind.williamsR.show !== undefined) indicators.williamsR.setShow(ind.williamsR.show);
          if (ind.williamsR.period !== undefined) { indicators.williamsR.setPeriod(ind.williamsR.period); indicators.williamsR.setPeriodInput(String(ind.williamsR.period)); }
        }

        // CCI
        if (ind.cci) {
          if (ind.cci.show !== undefined) indicators.cci.setShow(ind.cci.show);
          if (ind.cci.period !== undefined) { indicators.cci.setPeriod(ind.cci.period); indicators.cci.setPeriodInput(String(ind.cci.period)); }
        }

        // ADX
        if (ind.adx) {
          if (ind.adx.show !== undefined) indicators.adx.setShow(ind.adx.show);
          if (ind.adx.period !== undefined) { indicators.adx.setPeriod(ind.adx.period); indicators.adx.setPeriodInput(String(ind.adx.period)); }
        }

        // Migrate old per-timeframe oscillator panel data to the new global key (one-time migration)
        if (Array.isArray(data.oscillatorPanel?.selected) || data.highLowEnabled !== undefined || data.divergenceScannerEnabled !== undefined) {
          try {
            const symKey = `oscillatorDefaults_${symbol}`;
            if (!localStorage.getItem(symKey)) {
              const migrated: Record<string, any> = {};
              if (Array.isArray(data.oscillatorPanel?.selected)) {
                migrated.oscillatorPanel = { selected: data.oscillatorPanel.selected };
              }
              if (data.highLowEnabled !== undefined) migrated.highLowEnabled = data.highLowEnabled;
              if (data.divergenceScannerEnabled !== undefined) migrated.divergenceScannerEnabled = data.divergenceScannerEnabled;
              localStorage.setItem(symKey, JSON.stringify(migrated));
            }
          } catch { /* ignore */ }
        }
      }

      // --- Global per-symbol settings (shared across all timeframes) ---
      const symKey = `oscillatorDefaults_${symbol}`;
      const savedSym = localStorage.getItem(symKey);
      if (savedSym) {
        const symData = JSON.parse(savedSym);

        // Oscillator panel selections
        if (Array.isArray(symData.oscillatorPanel?.selected)) {
          const savedSet = new Set<string>(symData.oscillatorPanel.selected);
          ALL_OSCILLATOR_IDS.forEach(id => {
            oscillatorPanel.toggleOscillator(id, savedSet.has(id));
          });
        }

        // Global toggles
        if (symData.highLowEnabled !== undefined) setHighLowEnabled(symData.highLowEnabled);
        if (symData.divergenceScannerEnabled !== undefined) setDivergenceScannerEnabled(symData.divergenceScannerEnabled);
      }

      console.log(`📂 Loaded indicator defaults for ${symbol}_${timeframe}`);
    } catch (error) {
      console.error('Failed to load indicator defaults:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- setters from useState/useCallback are stable; only re-run when symbol or timeframe changes
  }, [symbol, timeframe]);

  // Load indicator defaults when symbol or timeframe changes
  useEffect(() => {
    loadIndicatorDefaults();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- loadIndicatorDefaults is stable per symbol+timeframe; avoids double-trigger
  }, [symbol, timeframe]);

  // Auto-save indicator defaults after 500ms of inactivity
  useEffect(() => {
    const timer = setTimeout(saveIndicatorDefaults, 500);
    return () => clearTimeout(timer);
  }, [saveIndicatorDefaults]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col h-screen">
      {/* Top Toolbar */}
      <FullscreenChartToolbar
        symbol={symbol}
        onSymbolChange={setSymbol}
        timeframe={timeframe}
        onTimeframeChange={setTimeframe}
        watchlistTickers={watchlistTickers}
        onClose={onClose}
        onOpenAlerts={() => setShowAlertSettings(true)}
      />

      {/* Chart Area */}
      <div className="flex-1 relative overflow-hidden">
        <FullscreenChartActionToolbar
          activeTool={activeTool}
          onSelectTool={handleSelectToolWithMemory}
          freeDrawMode={freeDrawMode}
          onFreeDrawModeChange={setFreeDrawMode}
          selectedOscillators={oscillatorPanel.selectedOscillators}
          onToggleOscillator={(id, enabled) => {
            // Volume as bottom histogram pane (not mini badge)
            if (id === 'volume') oscillatorPanel.toggleDockedOscillator('volume', enabled);
            else oscillatorPanel.toggleOscillator(id, enabled);
          }}
          onOpenOscillators={() => oscillatorPanel.setShowSelector(true)}
          emaShow={indicators.ema.show}
          onEmaToggle={indicators.ema.setShow}
          emaConfigs={indicators.ema.configs}
          smaShow={indicators.sma.show}
          onSmaToggle={indicators.sma.setShow}
          smaConfigs={indicators.sma.configs}
          vwapShow={indicators.vwap.showSession}
          onVwapToggle={indicators.vwap.setShowSession}
          onOpenVwapSettings={() => setShowVwapModal(true)}
          elderImpulseShow={showOwnerOnlyTools && indicators.elderImpulse.show}
          onElderImpulseToggle={indicators.elderImpulse.setShow}
          onOpenEmaSma={() => setShowEmaSmaModal(true)}
          fvgSettings={fvgSettings.settings}
          onFVGSettingsChange={(s) => {
            if (s.enabled && !fvgSettings.settings.enabled) {
              requirePaidForSMC('FVG', () => fvgSettings.setSettings(s));
            } else {
              fvgSettings.setSettings(s);
            }
          }}
          obSettings={obSettings.settings}
          onOBSettingsChange={(s) => {
            if (s.enabled && !obSettings.settings.enabled) {
              requirePaidForSMC('Order Blocks', () => obSettings.setSettings(s));
            } else {
              obSettings.setSettings(s);
            }
          }}
          breakerSettings={breakerSettings.settings}
          onBreakerSettingsChange={(s) => {
            if (s.enabled && !breakerSettings.settings.enabled) {
              requirePaidForSMC('Breaker Blocks', () => breakerSettings.setSettings(s));
            } else {
              breakerSettings.setSettings(s);
            }
          }}
          bosSettings={bosSettings.settings}
          onBOSSettingsChange={(s) => {
            if (s.enabled && !bosSettings.settings.enabled) {
              requirePaidForSMC('BOS / CHoCH', () => bosSettings.setSettings(s));
            } else {
              bosSettings.setSettings(s);
            }
          }}
          liquiditySettings={liquiditySettings.settings}
          onLiquiditySettingsChange={(s) => {
            if (s.enabled && !liquiditySettings.settings.enabled) {
              requirePaidForSMC('Liquidity Zones', () => liquiditySettings.setSettings(s));
            } else {
              liquiditySettings.setSettings(s);
            }
          }}
          pdZoneSettings={pdZoneSettings.settings}
          onPDZoneSettingsChange={(s) => {
            if (s.enabled && !pdZoneSettings.settings.enabled) {
              requirePaidForSMC('Premium / Discount Zones', () => pdZoneSettings.setSettings(s));
            } else {
              pdZoneSettings.setSettings(s);
            }
          }}
          onOpenSmc={() => setShowSmcModal(true)}
          autoFibSettings={autoFibSettings.settings}
          onAutoFibToggle={(enabled) => {
            if (enabled) {
              requirePaidForSMC('Auto-Fibonacci', () => autoFibSettings.updateSettings({ enabled: true }));
            } else {
              autoFibSettings.updateSettings({ enabled: false });
            }
          }}
          onOpenAutoFib={() => setShowAutoFibModal(true)}
          highLowEnabled={highLowEnabled}
          onToggleHighLow={setHighLowEnabled}
          divergenceScannerEnabled={divergenceScannerEnabled}
          onToggleDivergenceScanner={setDivergenceScannerEnabled}
          onOpenDivergenceSettings={() => setShowDivergenceSettings(true)}
          superTrendEnabled={
            superTrendSettings.settings.standard.enabled ||
            superTrendSettings.settings.adx.enabled ||
            superTrendSettings.settings.keltner.enabled
          }
          onToggleSuperTrend={(enabled) => {
            superTrendSettings.updateSettings({
              standard: { ...superTrendSettings.settings.standard, enabled },
              adx: { ...superTrendSettings.settings.adx, enabled: enabled ? superTrendSettings.settings.adx.enabled : false },
              keltner: { ...superTrendSettings.settings.keltner, enabled: enabled ? superTrendSettings.settings.keltner.enabled : false },
            });
          }}
          onOpenSuperTrendSettings={() => setShowSuperTrendModal(true)}
          onToggleDrawingMode={() => {
            if (activeTool) {
              setActiveTool(null);
              activeToolRef.current = null;
            } else {
              const tool = lastUsedToolRef.current || 'trendline';
              setActiveTool(tool);
              activeToolRef.current = tool;
            }
          }}
          drawingsVisible={drawingsVisible}
          onToggleDrawingsVisible={handleToggleDrawingsVisible}
          onDeleteAllDrawings={handleClearAllDrawings}
          onDisableAllIndicators={handleDisableAllIndicators}
          canUndo={canUndo}
          onUndo={handleUndo}
          canRedo={canRedo}
          onRedo={handleRedo}
          htfBiasEnabled={htfBiasSettings.settings.enabled}
          onToggleHtfBias={() => htfBiasSettings.updateSetting('enabled', !htfBiasSettings.settings.enabled)}
          vpEnabled={vpSettings.settings.enabled}
          onToggleVolumeProfile={(enabled) => vpSettings.updateSettings({ enabled })}
          onOpenVolumeProfileSettings={() => setShowVPModal(true)}
          volumeEnabled={oscillatorPanel.selectedOscillators.has('volume')}
          onToggleVolume={(enabled) => oscillatorPanel.toggleDockedOscillator('volume', enabled)}
          volumeEmaEnabled={volumeEmaSettings.settings.enabled}
          onToggleVolumeEma={(enabled) => volumeEmaSettings.updateSettings({ enabled })}
          onOpenVolumeEmaSettings={() => setShowVolumeEmaModal(true)}
          autoTrendlineEnabled={showOwnerOnlyTools && autoTrendlineSettings.settings.enabled}
          onToggleAutoTrendline={(enabled) => autoTrendlineSettings.updateSettings({ enabled })}
          onOpenAutoTrendlineSettings={() => setShowAutoTrendlineModal(true)}
          swoopEnabled={showOwnerOnlyTools && swoopSettings.settings.enabled}
          onToggleSwoop={(enabled) => swoopSettings.updateSettings({ enabled })}
          onOpenSwoopSettings={() => setShowSwoopModal(true)}
          liquidityHeatmapEnabled={showOwnerOnlyTools && lhSettings.settings.enabled}
          onToggleLiquidityHeatmap={(enabled) => lhSettings.updateSettings({ enabled })}
          onOpenLiquidityHeatmapSettings={() => setShowLHModal(true)}
          gdsMiniBadgeEnabled={showOwnerOnlyTools && showGdsMiniBadge}
          onToggleGdsMiniBadge={setShowGdsMiniBadge}
          rewindEnabled={showOwnerOnlyTools && rewindSettings.settings.enabled}
          onToggleRewind={handleToggleRewind}
          onOpenRewindSettings={() => setShowRewindModal(true)}
          onOpenTrade={() => setShowTradePanel(v => !v)}
          activeSystem={tradingSystem.activeSystem}
          onActivateSystem={tradingSystem.activateSystem}
          onDeactivateSystem={tradingSystem.deactivateSystem}
          confluenceSnapshot={confluenceSnapshot}
          onToggleFloatingMonitor={() => setShowFloatingConfluence((v: boolean) => !v)}
        />

        <FloatingConfluenceMonitor
          confluenceSnapshot={confluenceSnapshot}
          isVisible={showFloatingConfluence}
          onClose={() => setShowFloatingConfluence(false)}
        />

        {activeSystemSummary && (
          <div className="pointer-events-none select-none absolute top-14 right-2 z-[55] rounded-md border border-blue-700/70 bg-slate-900/95 px-2 py-1 text-[11px] font-semibold text-blue-200 shadow-lg backdrop-blur-sm">
            {activeSystemSummary.historicalSignalCount}/{activeSystemSummary.lookbackCandles}
            {activeSystemSummary.buySignals > 0 || activeSystemSummary.sellSignals > 0 ? (
              <span className="ml-1 font-normal text-slate-400">
                ({activeSystemSummary.buySignals}↑ {activeSystemSummary.sellSignals}↓)
              </span>
            ) : null}
          </div>
        )}

        {showOwnerOnlyTools && showGdsMiniBadge && (
          <GDSMiniBadge score={latestScore} gds={gds} isLoading={isGdsMetricsLoading} />
        )}

        {activeSystemDetails && tradingSystem.activeSystem && (
          <ActiveSystemMonitor
            systemId={tradingSystem.activeSystem}
            evaluation={activeSystemDetails.evaluation}
            onClose={tradingSystem.deactivateSystem}
            onWeightsChanged={() => setConditionWeightsVersion(v => v + 1)}
            scoringInput={activeSystemDetails.scoringInput}
            structureBreaks={structureBreaks}
            visibleRange={chartVisibleRange ?? undefined}
            historicalSignalEvents={historicalSystemSignalEvents}
            onLockToViewport={handleSystemLockToViewport}
            canLockToViewport={candles.length >= 2}
            viewportSignals={activeSystemBacktestSignals}
            onFindMaxOpportunity={handleFindMaxOpportunity}
            isAnalyzingOpportunities={isAnalyzingOpportunities}
            maxOpportunityZones={maxOpportunityZones}
            onClearOpportunityZones={handleClearOpportunityZones}
            onJumpToZone={handleJumpToZone}
          />
        )}

        {isFalconTicker(symbol) && (
          <FalconChartStatusBanner
            className="mx-2 my-1 shrink-0"
            pair={symbol}
            candleCount={candles.length}
            isLoading={isLoading}
            error={error}
            meta={falconMeta}
          />
        )}

        <FullscreenChartViewportLayer
          miniOscillators={oscillatorPanel.miniOscillators}
          selectedOscillators={oscillatorPanel.selectedOscillators}
          oscillatorData={oscillatorData}
          candles={effectiveCandles}
          onCycleMiniMode={oscillatorPanel.cycleMode}
          smartMoneyPanelData={smartMoneyPanelData}
          smcTrendEnginePanelData={smcTrendEnginePanelData}
          showHtfBiasPanel={htfBiasSettings.settings.enabled}
          htfBiasEntries={htfBiasEntries}
          isLoading={isLoading && candles.length === 0}
          errorMessage={error?.message || null}
          chartContainerRef={chartContainerRef}
          chartPercentage={oscillatorPanel.chartPercentage}
          onChartBackgroundClick={!activeTool ? waveSelection.handleDeselect : undefined}
        />
        
        <FullscreenChartIndicatorLayer
          chart={chartRef.current}
          candleSeries={candleSeriesRef.current}
          candles={effectiveCandles}
          calculateEMA={calculateEMA}
          emaConfigs={indicators.ema.configs}
          showEma={indicators.ema.show}
          emaHTFDataCache={htfDataCache}
          symbol={symbol}
          interval={renderedTimeframe}
          elderImpulseEnabled={showOwnerOnlyTools && indicators.elderImpulse.show}
          vwapShowSession={indicators.vwap.showSession}
          vwapShowDaily={indicators.vwap.showDaily}
          vwapShowWeekly={indicators.vwap.showWeekly}
          vwapShowMonthly={indicators.vwap.showMonthly}
          vwapShowRolling={indicators.vwap.showRolling}
          vwapRollingPeriod={indicators.vwap.rollingPeriod}
          fvgs={fvgs}
          fvgSettings={fvgSettings.settings}
          orderBlocks={orderBlocks}
          obSettings={obSettings.settings}
          breakers={breakers}
          breakerSettings={breakerSettings.settings}
          structureBreaks={structureBreaks}
          swingPoints={swingPoints}
          sessionSeparators={sessionSeparators}
          bosSettings={bosSettings.settings}
          liquidityZones={liquidityZones}
          liquiditySettings={liquiditySettings.settings}
          pdZones={pdZones}
          pdZoneSettings={pdZoneSettings.settings}
          autoFibResult={autoFibResult}
          autoFibSettings={autoFibSettings.settings}
          volumeProfileData={volumeProfileData}
          vpSettings={vpSettings.settings}
          showVPModal={showVPModal}
          onCloseVPModal={() => setShowVPModal(false)}
          onVPSettingsChange={vpSettings.setSettings}
          liquidityHeatmapData={liquidityHeatmapDataResult.data}
          lhSettings={
            showOwnerOnlyTools
              ? lhSettings.settings
              : { ...lhSettings.settings, enabled: false }
          }
          lhEffectiveRange={liquidityHeatmapDataResult.effectiveRange}
          showLHModal={showOwnerOnlyTools && showLHModal}
          onCloseLHModal={() => setShowLHModal(false)}
          onLHSettingsChange={lhSettings.setSettings}
          lhIsLoading={liquidityHeatmapDataResult.isLoading}
          lhError={liquidityHeatmapDataResult.error}
          lhDebugInfo={liquidityHeatmapDataResult.debugInfo}
          liquidityPivotAnalysis={liquidityPivotAnalysis}
          superTrendData={superTrendData}
          superTrendSettings={superTrendSettings.settings}
          highLowEnabled={highLowEnabled}
          chartEpoch={chartEpoch}
          volumeEmaEnabled={volumeEmaSettings.settings.enabled}
          volumeEmaSettings={volumeEmaSettings.settings}
          showVolumeEmaModal={showVolumeEmaModal}
          onCloseVolumeEmaModal={() => setShowVolumeEmaModal(false)}
          onVolumeEmaSettingsChange={volumeEmaSettings.updateSettings}
          onVolumeEmaReset={volumeEmaSettings.resetToDefaults}
          autoTrendlineSettings={
            showOwnerOnlyTools
              ? autoTrendlineSettings.settings
              : { ...autoTrendlineSettings.settings, enabled: false }
          }
          autoTrendlineResult={autoTrendlineResult}
          showAutoTrendlineModal={showOwnerOnlyTools && showAutoTrendlineModal}
          onCloseAutoTrendlineModal={() => setShowAutoTrendlineModal(false)}
          onAutoTrendlineSettingsChange={autoTrendlineSettings.updateSettings}
          onAutoTrendlineTierChange={autoTrendlineSettings.updateTier}
          onAutoTrendlineReset={autoTrendlineSettings.resetToDefaults}
          swoopSettings={
            showOwnerOnlyTools
              ? swoopSettings.settings
              : { ...swoopSettings.settings, enabled: false }
          }
          swoopResult={swoopResult}
          showSwoopModal={showOwnerOnlyTools && showSwoopModal}
          onCloseSwoopModal={() => setShowSwoopModal(false)}
          onSwoopSettingsChange={swoopSettings.updateSettings}
          onSwoopReset={swoopSettings.resetToDefaults}
          divergenceScannerEnabled={divergenceScannerEnabled}
          filteredDivergencePoints={filteredDivergencePoints}
          onSelectDivergencePoint={setSelectedDivergencePoint}
          selectedDivergencePoint={selectedDivergencePoint}
          onCloseDivergencePoint={() => setSelectedDivergencePoint(null)}
          showDivergenceSettings={showDivergenceSettings}
          onCloseDivergenceSettings={() => setShowDivergenceSettings(false)}
          divergenceSettings={divSettings.settings}
          onDivergenceSettingsChange={divSettings.updateSettings}
        />

        {/* Drawing Renderer */}
        <DrawingRenderer
          drawingMode={activeTool && activeTool !== 'free_draw' ? 'draw' : 'off'}
          activeTool={activeTool}
          activeToolRef={activeToolRef}
          autoColorEnabledRef={autoColorEnabledRef}
          candles={candles}
          tempDrawing={tempDrawing}
          setTempDrawing={setTempDrawing}
          setDrawings={setDrawings}
          saveDrawingMutation={{ mutate: saveDrawingWithUndo }}
          onPointCommitRef={onPointCommitRef}
          drawingDefaultsByTool={drawingDefaultsByTool}
          onDrawingComplete={handleDrawingComplete}
          getNextNumberLabel={getNextNumberLabel}
          onElliottWavePoint={elliottWave.isActive && elliottWave.isDrawing
            ? (p: GesturePoint) => {
                elliottWave.placePoint(p.time as number, p.price, p.snapType);
              }
            : undefined
          }
        />

        <WaveOverlayStack
          elliottWave={elliottWave}
          activeTool={activeTool}
          onDeactivateTool={elliottWaveController.deactivateTool}
          selectedWaveId={waveSelection.selectedWaveId}
          selectedWaveFibs={waveSelection.selectedWaveFibs}
          futurePredictionLines={waveSelection.futurePredictionLines}
          chartViewVersion={chartViewVersion}
          drawings={drawings}
          chart={chartRef.current}
          candleSeries={candleSeriesRef.current}
          chartContainerRef={chartContainerRef}
          onDeselectWave={waveSelection.handleDeselect}
          onWaveClick={waveSelection.handleWaveClick}
          tempDrawing={tempDrawing}
          quickMenuPosition={drawingInteraction.quickMenuPosition}
          selectedDrawingId={drawingInteraction.selectedDrawingId}
          onOpenDrawingSettings={modalHelpers.handleOpenSettings}
          onOpenDrawingAlerts={handleOpenDrawingAlerts}
          onMoveDrawing={handleEditMoveDrawing}
          onDeleteDrawing={drawingActions.handleDeleteDrawing}
          onCloseQuickMenu={drawingInteraction.closeQuickMenu}
          currentTimeframe={timeframe}
          selectedDrawingTimeframe={drawings.find(d => d.id === drawingInteraction.selectedDrawingId)?.timeframe}
        />

        {/* Free draw on-screen toolbar – shown whenever free_draw tool is active */}
        {activeTool === 'free_draw' && (
          <FreeDrawToolbar
            mode={freeDrawMode}
            onModeChange={(m) => { setFreeDrawMode(m); freeDrawModeRef.current = m; }}
            color={freeDrawColor}
            onColorChange={(c) => { setFreeDrawColor(c); freeDrawColorRef.current = c; }}
            lineWidth={freeDrawLineWidth}
            onLineWidthChange={(w) => { setFreeDrawLineWidth(w); freeDrawLineWidthRef.current = w; }}
          />
        )}

        {/* Trade zone overlay */}
        <TradeZoneRenderer
          chart={chartRef.current}
          candleSeries={candleSeriesRef.current}
          trades={manualTrades}
          currentTime={currentTradeTime}
          timeframe={timeframe}
        />

        <TideCrossMarkers
          candleSeries={candleSeriesRef.current}
          tideZone={oscillatorData.tideZone}
          timeframe={oscillatorData.tideTimeframe}
          enabled={oscillatorPanel.selectedOscillators.has('tideZone')}
        />

        <TetherDivergenceOverlay
          chart={chartRef.current}
          candles={effectiveCandles}
          result={tetherDivergence.result}
          settings={tetherSettings.settings}
          enabled={oscillatorPanel.selectedOscillators.has('tetherDivergence')}
        />

        {/* Trade panel popup */}
        {showTradePanel && (
          <div className="absolute bottom-16 left-2 z-50">
            <TradePanel
              currentPrice={currentTradePrice}
              currentTime={currentTradeTime}
              symbol={symbol}
              timeframe={timeframe}
              trades={manualTrades}
              onAddTrade={addManualTrade}
              onExitTrade={exitManualTrade}
              onDeleteTrade={deleteManualTrade}
              onUpdateTrade={updateManualTrade}
              onClose={() => setShowTradePanel(false)}
              activePickField={tradePickMode}
              onRequestChartPick={(field) => {
                setTradePickMode(field);
                tradePickModeRef.current = field;
                // Clear any stale result so the useEffect in TradePanel fires on next pick
                setChartPickValue(null);
              }}
              chartPickValue={chartPickValue}
            />
          </div>
        )}

        {/* Chart-pick instruction overlay */}
        {tradePickMode && (
          <ChartPickOverlay
            field={tradePickMode}
            onCancel={() => { setTradePickMode(null); tradePickModeRef.current = null; }}
          />
        )}
      </div>
      
        <FullscreenOscillatorLayout
        selectedOscillators={oscillatorPanel.selectedOscillators}
        poppedOutOscillators={oscillatorPanel.poppedOutOscillators}
        miniOscillators={oscillatorPanel.miniOscillators}
        oscillatorData={oscillatorData}
        candles={effectiveCandles}
        totalOscillatorHeight={oscillatorPanel.totalHeight}
        onPopout={oscillatorPanel.popoutOscillator}
        onCycleMode={oscillatorPanel.cycleMode}
        totalPercentage={oscillatorPanel.totalPercentage}
        perOscillatorPercentage={oscillatorPanel.perOscillatorPercentage}
          mainChartVisibleRange={syncedOscillatorRange}
          mainChart={chartReady ? chartRef.current : null}
          smartMoneyPanelData={smartMoneyPanelData}
          smcTrendEnginePanelData={smcTrendEnginePanelData}
        />
      
      <FullscreenChartModals
        selectedDrawingId={drawingInteraction.selectedDrawingId}
        settingsModalOpen={settingsModalOpen}
        onCloseSettings={modalHelpers.handleCloseSettings}
        selectedDrawingForModal={modalHelpers.selectedDrawingForModal}
        onUpdateDrawing={drawingActions.handleUpdateDrawing}
        autoColorEnabled={autoColorEnabled}
        onAutoColorChange={handleAutoColorPreferenceChange}
        onSaveDrawingDefaults={persistDrawingDefaults}
        onResetDrawingDefaults={resetDrawingDefaults}
        showSelectionModal={drawingInteraction.showSelectionModal}
        nearbyDrawings={drawingInteraction.nearbyDrawings}
        onSelectFromModal={drawingInteraction.selectFromModal}
        onCloseSelectionModal={drawingInteraction.closeSelectionModal}
        showEmaSmaModal={showEmaSmaModal}
        onCloseEmaSmaModal={() => setShowEmaSmaModal(false)}
        emaShow={indicators.ema.show}
        emaConfigs={indicators.ema.configs}
        emaInputs={indicators.ema.inputs}
        onEmaToggle={indicators.ema.setShow}
        onEmaConfigsChange={indicators.ema.setConfigs}
        onEmaInputsChange={indicators.ema.setInputs}
        smaShow={indicators.sma.show}
        smaConfigs={indicators.sma.configs}
        onSmaToggle={indicators.sma.setShow}
        onSmaConfigsChange={indicators.sma.setConfigs}
        showOscillatorSelector={oscillatorPanel.showSelector}
        onCloseOscillatorSelector={() => oscillatorPanel.setShowSelector(false)}
        selectedOscillators={oscillatorPanel.selectedOscillators}
        onToggleOscillator={(id, enabled) => {
          if (id === 'volume') oscillatorPanel.toggleDockedOscillator('volume', enabled);
          else oscillatorPanel.toggleOscillator(id, enabled);
        }}
        oscillatorConfigs={oscillatorModalConfigs}
        onUpdateOscillatorConfig={handleUpdateOscillatorConfig}
        showSmcModal={showSmcModal}
        onCloseSmcModal={() => setShowSmcModal(false)}
        fvgSettings={fvgSettings.settings}
        onFVGSettingsChange={fvgSettings.setSettings}
        obSettings={obSettings.settings}
        onOBSettingsChange={obSettings.setSettings}
        breakerSettings={breakerSettings.settings}
        onBreakerSettingsChange={breakerSettings.setSettings}
        bosSettings={bosSettings.settings}
        onBOSSettingsChange={bosSettings.setSettings}
        liquiditySettings={liquiditySettings.settings}
        onLiquiditySettingsChange={liquiditySettings.setSettings}
        pdZoneSettings={pdZoneSettings.settings}
        onPDZoneSettingsChange={pdZoneSettings.setSettings}
        showDegreePicker={showDegreePicker}
        onDegreeSelect={elliottWaveController.handleDegreeSelect}
        onCloseDegreePicker={() => setShowDegreePicker(false)}
        showAutoFibModal={showAutoFibModal}
        onCloseAutoFibModal={() => setShowAutoFibModal(false)}
        autoFibSettings={autoFibSettings.settings}
        onAutoFibSettingsChange={autoFibSettings.updateSettings}
        showSuperTrendModal={showSuperTrendModal}
        onCloseSuperTrendModal={() => setShowSuperTrendModal(false)}
        superTrendSettings={superTrendSettings.settings}
        onSuperTrendSettingsChange={superTrendSettings.updateConfig}
        showVwapModal={showVwapModal}
        onCloseVwapModal={() => setShowVwapModal(false)}
        vwapState={indicators.vwap}
      />
      
      <AlertSettingsDialog 
        open={showAlertSettings} 
        onOpenChange={setShowAlertSettings} 
      />

      {selectedDrawingForAlerts && (
        <DrawingAlertSettings
          isOpen={showDrawingAlertSettings}
          onClose={() => {
            setShowDrawingAlertSettings(false);
            setSelectedDrawingForAlerts(null);
          }}
          drawing={selectedDrawingForAlerts}
          onUpdate={drawingActions.handleUpdateDrawing}
        />
      )}

      {/* Rewind Controls - show when rewind is active OR when controls are enabled and in rewind mode */}
      {showOwnerOnlyTools && rewindSettings.settings.showControls && (
        <RewindControls
          currentPosition={rewindPosition}
          totalCandles={candles.length}
          onStepBack={handleStepBack}
          onStepForward={handleStepForward}
          onGoLive={handleGoLive}
        />
      )}

      {/* Rewind Settings Modal */}
      {showOwnerOnlyTools && (
      <RewindSettingsModal
        isOpen={showRewindModal}
        onClose={() => setShowRewindModal(false)}
        settings={rewindSettings.settings}
        onSettingsChange={rewindSettings.setSettings}
      />
      )}
    </div>
  );
}
