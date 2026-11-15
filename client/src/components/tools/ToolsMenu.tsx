// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useState } from 'react';
import { Wrench, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useShowOwnerOnlyTools } from '@/hooks/useShowOwnerOnlyTools';
import type { AutoFibSettings } from '@/types/autoFib';

interface ToolsMenuProps {
  highLowEnabled: boolean;
  onToggleHighLow: (enabled: boolean) => void;
  divergenceScannerEnabled: boolean;
  onToggleDivergenceScanner: (enabled: boolean) => void;
  onOpenDivergenceSettings?: () => void;
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
  swoopEnabled: boolean;
  onToggleSwoop: (enabled: boolean) => void;
  onOpenSwoopSettings: () => void;
  liquidityHeatmapEnabled: boolean;
  onToggleLiquidityHeatmap: (enabled: boolean) => void;
  onOpenLiquidityHeatmapSettings: () => void;
  gdsMiniBadgeEnabled: boolean;
  onToggleGdsMiniBadge: (enabled: boolean) => void;
  rewindEnabled: boolean;
  onToggleRewind: (enabled: boolean) => void;
  onOpenRewindSettings: () => void;
  onOpenTrade?: () => void;
  /** Auto-Fibonacci (moved here from the Indicators > SMC tab — it's a general tool). */
  autoFibSettings?: AutoFibSettings;
  onAutoFibToggle?: (enabled: boolean) => void;
  onOpenAutoFib?: () => void;
  className?: string;
}

export function ToolsMenu({
  highLowEnabled,
  onToggleHighLow,
  divergenceScannerEnabled,
  onToggleDivergenceScanner,
  onOpenDivergenceSettings,
  htfBiasEnabled,
  onToggleHtfBias,
  vpEnabled,
  onToggleVolumeProfile,
  onOpenVolumeProfileSettings,
  volumeEnabled,
  onToggleVolume,
  volumeEmaEnabled,
  onToggleVolumeEma,
  onOpenVolumeEmaSettings,
  autoTrendlineEnabled,
  onToggleAutoTrendline,
  onOpenAutoTrendlineSettings,
  swoopEnabled,
  onToggleSwoop,
  onOpenSwoopSettings,
  liquidityHeatmapEnabled,
  onToggleLiquidityHeatmap,
  onOpenLiquidityHeatmapSettings,
  gdsMiniBadgeEnabled,
  onToggleGdsMiniBadge,
  rewindEnabled,
  onToggleRewind,
  onOpenRewindSettings,
  onOpenTrade,
  autoFibSettings,
  onAutoFibToggle,
  onOpenAutoFib,
  className,
}: ToolsMenuProps) {
  const [open, setOpen] = useState(false);
  const showOwnerOnlyTools = useShowOwnerOnlyTools();

  const hasActiveTools =
    highLowEnabled ||
    divergenceScannerEnabled ||
    htfBiasEnabled ||
    vpEnabled ||
    volumeEnabled ||
    volumeEmaEnabled ||
    !!autoFibSettings?.enabled ||
    (showOwnerOnlyTools && autoTrendlineEnabled) ||
    (showOwnerOnlyTools && swoopEnabled) ||
    (showOwnerOnlyTools && liquidityHeatmapEnabled) ||
    (showOwnerOnlyTools && gdsMiniBadgeEnabled) ||
    (showOwnerOnlyTools && rewindEnabled);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative h-9 w-9 transition-all',
            hasActiveTools
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-300 hover:text-white hover:bg-slate-800',
            className,
          )}
          title="Tools"
          aria-label="Tools"
        >
          <Wrench className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        collisionPadding={12}
        className="w-56 max-h-[min(70dvh,var(--radix-popover-content-available-height,70dvh))] overflow-y-auto p-0 bg-slate-900 border-slate-700 text-slate-100"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800">
          <span className="text-xs font-semibold text-slate-300">Tools</span>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="h-5 w-5 p-0 text-slate-400 hover:text-white hover:bg-slate-700">
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="p-2">
          <div className="text-xs text-slate-400 font-medium uppercase tracking-wide px-1 mb-1">Tools</div>
          <div className="flex items-center justify-between py-1.5 px-1">
            <div className="min-w-0 mr-3">
              <div className="text-sm font-medium text-slate-100 leading-tight">High/Low</div>
              <div className="text-xs text-slate-400 leading-tight">Visible range high and low levels</div>
            </div>
            <Switch checked={highLowEnabled} onCheckedChange={onToggleHighLow} className="shrink-0 data-[state=checked]:bg-blue-600" />
          </div>
          <div className="flex items-center justify-between py-1.5 px-1">
            <div className="min-w-0 mr-3">
              <div className="text-sm font-medium text-slate-100 leading-tight">Divergence Scanner</div>
              <div className="text-xs text-slate-400 leading-tight">Scan all 7 oscillators</div>
            </div>
            <div className="flex items-center gap-1">
              <Switch checked={divergenceScannerEnabled} onCheckedChange={onToggleDivergenceScanner} className="shrink-0 data-[state=checked]:bg-blue-600" />
              {onOpenDivergenceSettings && (
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-700" title="Divergence Settings" onClick={() => { setOpen(false); onOpenDivergenceSettings(); }}>
                  <Settings className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between py-1.5 px-1">
            <div className="min-w-0 mr-3">
              <div className="text-sm font-medium text-slate-100 leading-tight">HTF Bias</div>
              <div className="text-xs text-slate-400 leading-tight">Multi-timeframe bias panel</div>
            </div>
            <Switch checked={htfBiasEnabled} onCheckedChange={() => onToggleHtfBias()} className="shrink-0 data-[state=checked]:bg-blue-600" />
          </div>
          <div className="flex items-center justify-between py-1.5 px-1">
            <div className="min-w-0 mr-3">
              <div className="text-sm font-medium text-slate-100 leading-tight">Volume Profile</div>
              <div className="text-xs text-slate-400 leading-tight">Horizontal volume by price (POC/VAH/VAL)</div>
            </div>
            <div className="flex items-center gap-1">
              <Switch checked={vpEnabled} onCheckedChange={onToggleVolumeProfile} className="shrink-0 data-[state=checked]:bg-blue-600" />
              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-700" title="Volume Profile Settings" onClick={() => { setOpen(false); onOpenVolumeProfileSettings(); }} data-testid="btn-volume-profile-settings">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between py-1.5 px-1">
            <div className="min-w-0 mr-3">
              <div className="text-sm font-medium text-slate-100 leading-tight">Volume</div>
              <div className="text-xs text-slate-400 leading-tight">Per-candle volume bars under the chart</div>
            </div>
            <Switch checked={volumeEnabled} onCheckedChange={onToggleVolume} className="shrink-0 data-[state=checked]:bg-blue-600" data-testid="switch-volume-indicator" />
          </div>
          <div className="flex items-center justify-between py-1.5 px-1">
            <div className="min-w-0 mr-3">
              <div className="text-sm font-medium text-slate-100 leading-tight">Volume EMA</div>
              <div className="text-xs text-slate-400 leading-tight">Net buy flow above mid, net sell below; balanced flow returns to mid</div>
            </div>
            <div className="flex items-center gap-1">
              <Switch checked={volumeEmaEnabled} onCheckedChange={onToggleVolumeEma} className="shrink-0 data-[state=checked]:bg-blue-600" data-testid="switch-volume-ema-overlay" />
              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-700" title="Volume EMA Settings" onClick={() => { setOpen(false); onOpenVolumeEmaSettings(); }} data-testid="btn-volume-ema-settings">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {autoFibSettings && onAutoFibToggle && (
            <div className="flex items-center justify-between py-1.5 px-1">
              <div className="min-w-0 mr-3">
                <div className="text-sm font-medium text-slate-100 leading-tight">Auto-Fibonacci</div>
                <div className="text-xs text-slate-400 leading-tight">Swing-based fib levels</div>
              </div>
              <div className="flex items-center gap-1">
                <Switch checked={autoFibSettings.enabled} onCheckedChange={onAutoFibToggle} className="shrink-0 data-[state=checked]:bg-blue-600" data-testid="switch-auto-fib" />
                {onOpenAutoFib && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-700" title="Auto-Fibonacci Settings" onClick={() => { setOpen(false); onOpenAutoFib(); }} data-testid="btn-auto-fib-settings">
                    <Settings className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
          {showOwnerOnlyTools && (
          <>
          <div className="flex items-center justify-between py-1.5 px-1">
            <div className="min-w-0 mr-3">
              <div className="text-sm font-medium text-slate-100 leading-tight">Auto Trendlines</div>
              <div className="text-xs text-slate-400 leading-tight">Macro / mid / LTF wick lines (settings per tier)</div>
            </div>
            <div className="flex items-center gap-1">
              <Switch checked={autoTrendlineEnabled} onCheckedChange={onToggleAutoTrendline} className="shrink-0 data-[state=checked]:bg-blue-600" data-testid="switch-auto-trendlines" />
              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-700" title="Auto Trendline Settings" onClick={() => { setOpen(false); onOpenAutoTrendlineSettings(); }} data-testid="btn-auto-trendline-settings">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between py-1.5 px-1">
            <div className="min-w-0 mr-3">
              <div className="text-sm font-medium text-slate-100 leading-tight">Structure book</div>
              <div className="text-xs text-slate-400 leading-tight">Swoop, triangle, down wedge, channel from visible pivots</div>
            </div>
            <div className="flex items-center gap-1">
              <Switch checked={swoopEnabled} onCheckedChange={onToggleSwoop} className="shrink-0 data-[state=checked]:bg-blue-600" data-testid="switch-swoop-tool" />
              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-700" title="Swoop Settings" onClick={() => { setOpen(false); onOpenSwoopSettings(); }} data-testid="btn-swoop-settings">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between py-1.5 px-1">
            <div className="min-w-0 mr-3">
              <div className="text-sm font-medium text-slate-100 leading-tight">Predictive Liquidation</div>
              <div className="text-xs text-slate-400 leading-tight">Profile bars with bullish and bearish zones</div>
            </div>
            <div className="flex items-center gap-1">
              <Switch checked={liquidityHeatmapEnabled} onCheckedChange={onToggleLiquidityHeatmap} className="shrink-0 data-[state=checked]:bg-blue-600" />
              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-700" title="Liquidity Heatmap Settings" onClick={() => { setOpen(false); onOpenLiquidityHeatmapSettings(); }} data-testid="btn-liquidity-heatmap-settings">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between py-1.5 px-1">
            <div className="min-w-0 mr-3">
              <div className="text-sm font-medium text-slate-100 leading-tight">GDS Mini Badge</div>
              <div className="text-xs text-slate-400 leading-tight">Show Genuine Demand Score on chart</div>
            </div>
            <Switch checked={gdsMiniBadgeEnabled} onCheckedChange={onToggleGdsMiniBadge} className="shrink-0 data-[state=checked]:bg-blue-600" />
          </div>
          <div className="flex items-center justify-between py-1.5 px-1">
            <div className="min-w-0 mr-3">
              <div className="text-sm font-medium text-slate-100 leading-tight">Chart Rewind</div>
              <div className="text-xs text-slate-400 leading-tight">Historical playback mode</div>
            </div>
            <div className="flex items-center gap-1">
              <Switch checked={rewindEnabled} onCheckedChange={onToggleRewind} className="shrink-0 data-[state=checked]:bg-blue-600" />
              <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-700" title="Chart Rewind Settings" onClick={() => { setOpen(false); onOpenRewindSettings(); }} data-testid="btn-rewind-settings">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          </>
          )}

          {onOpenTrade && (
            <div className="pt-1 border-t border-slate-700 mt-1">
              <Button variant="ghost" className="w-full justify-start px-1 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-800 hover:text-white" onClick={() => { setOpen(false); onOpenTrade(); }} data-testid="btn-open-trade">
                Trade
                <span className="ml-2 text-xs text-slate-400">Open / manage trades</span>
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
