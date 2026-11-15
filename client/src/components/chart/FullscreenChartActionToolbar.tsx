// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import type { ChartDrawingTool } from '@/types/drawing';
import { DrawingMenu } from '@/components/drawings/DrawingMenu';
import { IndicatorMenu } from '@/components/indicators/IndicatorMenu';
import { ToolsMenu } from '@/components/tools/ToolsMenu';
import { TradingSystemsMenu } from '@/components/tradingSystems/TradingSystemsMenu';
import type { TradingSystemId } from '@/types/tradingSystems';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Eye, EyeOff, Trash2 } from 'lucide-react';

interface ConfluenceSnapshot {
  score: number;
  longCount: number;
  shortCount: number;
  neutralCount: number;
  updatedAt: number;
}

interface FullscreenChartActionToolbarProps {
  activeTool: ChartDrawingTool;
  onSelectTool: (tool: ChartDrawingTool) => void;
  freeDrawMode?: import('@/types/drawing').FreeDrawMode;
  onFreeDrawModeChange?: (mode: import('@/types/drawing').FreeDrawMode) => void;
  selectedOscillators: Set<string>;
  onToggleOscillator: (id: string, enabled: boolean) => void;
  onOpenOscillators: () => void;
  emaShow: boolean;
  onEmaToggle: (show: boolean) => void;
  emaConfigs: any;
  smaShow: boolean;
  onSmaToggle: (show: boolean) => void;
  smaConfigs: any;
  vwapShow: boolean;
  onVwapToggle: (show: boolean) => void;
  onOpenVwapSettings: () => void;
  elderImpulseShow: boolean;
  onElderImpulseToggle: (show: boolean) => void;
  onOpenEmaSma: () => void;
  fvgSettings: any;
  onFVGSettingsChange: (value: any) => void;
  obSettings: any;
  onOBSettingsChange: (value: any) => void;
  breakerSettings: any;
  onBreakerSettingsChange: (value: any) => void;
  bosSettings: any;
  onBOSSettingsChange: (value: any) => void;
  liquiditySettings: any;
  onLiquiditySettingsChange: (value: any) => void;
  pdZoneSettings: any;
  onPDZoneSettingsChange: (value: any) => void;
  onOpenSmc: () => void;
  autoFibSettings: any;
  onAutoFibToggle: (enabled: boolean) => void;
  onOpenAutoFib: () => void;
  highLowEnabled: boolean;
  onToggleHighLow: (enabled: boolean) => void;
  divergenceScannerEnabled: boolean;
  onToggleDivergenceScanner: (enabled: boolean) => void;
  onOpenDivergenceSettings: () => void;
  superTrendEnabled: boolean;
  onToggleSuperTrend: (enabled: boolean) => void;
  onOpenSuperTrendSettings: () => void;
  onToggleDrawingMode: () => void;
  drawingsVisible: boolean;
  onToggleDrawingsVisible: () => void;
  onDeleteAllDrawings: () => void;
  onDisableAllIndicators: () => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  htfBiasEnabled: boolean;
  onToggleHtfBias: () => void;
  vpEnabled: boolean;
  onToggleVolumeProfile: (enabled: boolean) => void;
  onOpenVolumeProfileSettings: () => void;
  volumeEnabled: boolean;
  onToggleVolume: (enabled: boolean) => void;
  volumeEmaEnabled: boolean;
  onToggleVolumeEma: (enabled: boolean) => void;
  onOpenVolumeEmaSettings: () => void;
  autoTrendlineEnabled: boolean;
  onToggleAutoTrendline: (enabled: boolean) => void;
  onOpenAutoTrendlineSettings: () => void;
  swoopEnabled?: boolean;
  onToggleSwoop?: (enabled: boolean) => void;
  onOpenSwoopSettings?: () => void;
  liquidityHeatmapEnabled: boolean;
  onToggleLiquidityHeatmap: (enabled: boolean) => void;
  onOpenLiquidityHeatmapSettings: () => void;
  gdsMiniBadgeEnabled: boolean;
  onToggleGdsMiniBadge: (enabled: boolean) => void;
  rewindEnabled: boolean;
  onToggleRewind: (enabled: boolean) => void;
  onOpenRewindSettings: () => void;
  onOpenTrade?: () => void;
  activeSystem: TradingSystemId | null;
  onActivateSystem: (systemId: TradingSystemId) => void;
  onDeactivateSystem: () => void;
  confluenceSnapshot: ConfluenceSnapshot | null;
  onToggleFloatingMonitor: () => void;
}

export function FullscreenChartActionToolbar(props: FullscreenChartActionToolbarProps) {
  const {
    activeTool, onSelectTool, freeDrawMode, onFreeDrawModeChange,
    selectedOscillators, onToggleOscillator, onOpenOscillators,
    emaShow, onEmaToggle, emaConfigs, smaShow, onSmaToggle, smaConfigs,
    vwapShow, onVwapToggle, onOpenVwapSettings, elderImpulseShow, onElderImpulseToggle, onOpenEmaSma,
    fvgSettings, onFVGSettingsChange, obSettings, onOBSettingsChange, breakerSettings, onBreakerSettingsChange,
    bosSettings, onBOSSettingsChange, liquiditySettings, onLiquiditySettingsChange, pdZoneSettings, onPDZoneSettingsChange, onOpenSmc,
    autoFibSettings, onAutoFibToggle, onOpenAutoFib,
    highLowEnabled, onToggleHighLow, divergenceScannerEnabled, onToggleDivergenceScanner, onOpenDivergenceSettings,
    superTrendEnabled, onToggleSuperTrend, onOpenSuperTrendSettings,
    onToggleDrawingMode, drawingsVisible, onToggleDrawingsVisible, onDeleteAllDrawings, onDisableAllIndicators,
    canUndo, onUndo, canRedo, onRedo, htfBiasEnabled, onToggleHtfBias,
    vpEnabled, onToggleVolumeProfile, onOpenVolumeProfileSettings, volumeEnabled, onToggleVolume,
    volumeEmaEnabled, onToggleVolumeEma, onOpenVolumeEmaSettings,
    autoTrendlineEnabled, onToggleAutoTrendline, onOpenAutoTrendlineSettings,
    swoopEnabled = false, onToggleSwoop = () => {}, onOpenSwoopSettings = () => {},
    liquidityHeatmapEnabled, onToggleLiquidityHeatmap, onOpenLiquidityHeatmapSettings,
    gdsMiniBadgeEnabled, onToggleGdsMiniBadge, rewindEnabled, onToggleRewind, onOpenRewindSettings, onOpenTrade,
    activeSystem, onActivateSystem, onDeactivateSystem, confluenceSnapshot, onToggleFloatingMonitor,
  } = props;
  return (
    <div className="absolute top-2 left-2 z-30 flex items-center gap-1 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg p-1 shadow-xl">
      <DrawingMenu activeTool={activeTool} onSelectTool={onSelectTool} freeDrawMode={freeDrawMode} onFreeDrawModeChange={onFreeDrawModeChange} />
      <IndicatorMenu
        selectedOscillators={selectedOscillators} onToggleOscillator={onToggleOscillator} onOpenOscillators={onOpenOscillators}
        emaShow={emaShow} onEmaToggle={onEmaToggle} emaConfigs={emaConfigs} smaShow={smaShow} onSmaToggle={onSmaToggle} smaConfigs={smaConfigs}
        vwapShow={vwapShow} onVwapToggle={onVwapToggle} onOpenVwapSettings={onOpenVwapSettings} elderImpulseShow={elderImpulseShow} onElderImpulseToggle={onElderImpulseToggle} onOpenEmaSma={onOpenEmaSma}
        superTrendEnabled={superTrendEnabled} onToggleSuperTrend={onToggleSuperTrend} onOpenSuperTrendSettings={onOpenSuperTrendSettings}
        fvgSettings={fvgSettings} onFVGSettingsChange={onFVGSettingsChange} obSettings={obSettings} onOBSettingsChange={onOBSettingsChange}
        breakerSettings={breakerSettings} onBreakerSettingsChange={onBreakerSettingsChange} bosSettings={bosSettings} onBOSSettingsChange={onBOSSettingsChange}
        liquiditySettings={liquiditySettings} onLiquiditySettingsChange={onLiquiditySettingsChange} pdZoneSettings={pdZoneSettings} onPDZoneSettingsChange={onPDZoneSettingsChange} onOpenSmc={onOpenSmc}
      />
      <ToolsMenu
        highLowEnabled={highLowEnabled} onToggleHighLow={onToggleHighLow}
        divergenceScannerEnabled={divergenceScannerEnabled} onToggleDivergenceScanner={onToggleDivergenceScanner} onOpenDivergenceSettings={onOpenDivergenceSettings}
        htfBiasEnabled={htfBiasEnabled} onToggleHtfBias={onToggleHtfBias}
        vpEnabled={vpEnabled} onToggleVolumeProfile={onToggleVolumeProfile} onOpenVolumeProfileSettings={onOpenVolumeProfileSettings}
        volumeEnabled={volumeEnabled} onToggleVolume={onToggleVolume}
        volumeEmaEnabled={volumeEmaEnabled} onToggleVolumeEma={onToggleVolumeEma} onOpenVolumeEmaSettings={onOpenVolumeEmaSettings}
        autoTrendlineEnabled={autoTrendlineEnabled} onToggleAutoTrendline={onToggleAutoTrendline} onOpenAutoTrendlineSettings={onOpenAutoTrendlineSettings}
        swoopEnabled={swoopEnabled} onToggleSwoop={onToggleSwoop} onOpenSwoopSettings={onOpenSwoopSettings}
        liquidityHeatmapEnabled={liquidityHeatmapEnabled} onToggleLiquidityHeatmap={onToggleLiquidityHeatmap} onOpenLiquidityHeatmapSettings={onOpenLiquidityHeatmapSettings}
        gdsMiniBadgeEnabled={gdsMiniBadgeEnabled} onToggleGdsMiniBadge={onToggleGdsMiniBadge}
        rewindEnabled={rewindEnabled} onToggleRewind={onToggleRewind} onOpenRewindSettings={onOpenRewindSettings}
        autoFibSettings={autoFibSettings} onAutoFibToggle={onAutoFibToggle} onOpenAutoFib={onOpenAutoFib}
        onOpenTrade={onOpenTrade}
      />
      <div className="w-px h-6 bg-slate-700" />
      <TradingSystemsMenu activeSystem={activeSystem} onActivateSystem={onActivateSystem} onDeactivateSystem={onDeactivateSystem} confluenceSnapshot={confluenceSnapshot} onToggleFloatingMonitor={onToggleFloatingMonitor} />
      <div className="w-px h-6 bg-slate-700" />
      <Button variant="ghost" size="sm" onClick={onToggleDrawingMode} className={cn('h-7 px-1.5 text-[11px] font-semibold transition-all', activeTool ? 'bg-blue-500 text-white' : 'bg-slate-800/90 text-gray-400 hover:bg-slate-700')} title={activeTool ? 'Drawing: ON (press D or click to disable)' : 'Drawing: OFF (press D or click to enable)'} data-testid="btn-drawing-toggle">{activeTool ? 'Draw: ON' : 'Draw: OFF'}</Button>
      <Button variant="ghost" size="sm" onClick={onToggleDrawingsVisible} className={cn('h-7 px-1.5 text-[11px] font-semibold transition-all', drawingsVisible ? 'bg-slate-800/90 text-gray-300 hover:bg-slate-700' : 'bg-amber-600 text-white hover:bg-amber-500')} title={drawingsVisible ? 'Hide all drawings' : 'Show all drawings'}>{drawingsVisible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}<span className="ml-1 hidden sm:inline">{drawingsVisible ? 'Hide' : 'Show'}</span></Button>
      <Button variant="ghost" size="sm" onClick={onDeleteAllDrawings} className="h-7 px-1.5 text-[11px] font-semibold bg-slate-800/90 text-gray-300 hover:bg-red-700 hover:text-white transition-all" title="Delete all drawings for this timeframe"><Trash2 className="h-3 w-3" /><span className="ml-1 hidden sm:inline">Clear</span></Button>
      <Button variant="ghost" size="sm" onClick={onDisableAllIndicators} className="h-7 px-1.5 text-[11px] font-semibold bg-slate-800/90 text-gray-300 hover:bg-slate-700" title="Turn all indicators and oscillators off">Ind: Off</Button>
      <Button variant="ghost" size="sm" onClick={onUndo} disabled={!canUndo} className={cn('h-7 p-1.5 transition-all', canUndo ? 'bg-slate-800/90 text-gray-300 hover:bg-slate-700' : 'bg-slate-800/40 text-gray-600 cursor-not-allowed')} title="Undo (Ctrl+Z)" data-testid="btn-undo"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg></Button>
      <Button variant="ghost" size="sm" onClick={onRedo} disabled={!canRedo} className={cn('h-7 p-1.5 transition-all', canRedo ? 'bg-slate-800/90 text-gray-300 hover:bg-slate-700' : 'bg-slate-800/40 text-gray-600 cursor-not-allowed')} title="Redo (Ctrl+Y)" data-testid="btn-redo"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10H11a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg></Button>
    </div>
  );
}
