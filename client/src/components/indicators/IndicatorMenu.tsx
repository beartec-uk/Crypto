// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { useState } from 'react';
import { Waves, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useShowOwnerOnlyTools } from '@/hooks/useShowOwnerOnlyTools';
import { OWNER_ONLY_OSCILLATOR_IDS } from '@/constants/ownerOnlyFeatures';
import type { FVGSettings } from '@/types/fvg';
import type { OrderBlockSettings } from '@/types/orderBlock';
import type { BreakerSettings } from '@/types/breaker';
import type { BOSSettings } from '@/types/structureBreak';
import type { LiquiditySettings, PDZoneSettings } from '@/types/liquidity';
import type { MAConfig } from '@/types/chart.types';

const OSCILLATORS = [
  { id: 'rsi', name: 'RSI', description: 'Relative Strength Index (14)' },
  { id: 'macd', name: 'MACD', description: 'MACD (12, 26, 9)' },
  { id: 'waddah', name: 'Waddah Explosion', description: 'MACD momentum + volatility explosion' },
  { id: 'cmf', name: 'CMF', description: 'Chaikin Money Flow (20)' },
  { id: 'volume', name: 'Volume', description: 'Per-candle volume bars (bottom pane)' },
  { id: 'stochRsi', name: 'Stoch RSI', description: 'Stochastic RSI (14)' },
  { id: 'tsi', name: 'TSI', description: 'True Strength Index (25, 13, 7)' },
  { id: 'obv', name: 'OBV', description: 'On Balance Volume' },
  { id: 'mfi', name: 'MFI', description: 'Money Flow Index (14)' },
  { id: 'klinger', name: 'Klinger', description: 'Klinger Oscillator (34, 55, 13)' },
  { id: 'williamsR', name: 'Williams %R', description: 'Williams Percent Range (14)' },
  { id: 'cci', name: 'CCI', description: 'Commodity Channel Index (20)' },
  { id: 'adx', name: 'ADX', description: 'Average Directional Index (14)' },
  { id: 'tideZone', name: 'Tide Zone', description: '4h tide + local energy/tape zones' },
  { id: 'tetherDivergence', name: 'Tether Stretch', description: 'USDT.D stretch (Stretch + / Stretch -) with daily RSI divergence markers +1..+3 / -1..-3' },
];

interface IndicatorMenuProps {
  // OSC
  selectedOscillators: Set<string>;
  onToggleOscillator: (id: string, enabled: boolean) => void;
  onOpenOscillators: () => void;
  // MAs
  emaShow: boolean;
  onEmaToggle: (show: boolean) => void;
  emaConfigs: MAConfig[];
  smaShow: boolean;
  onSmaToggle: (show: boolean) => void;
  smaConfigs: MAConfig[];
  vwapShow: boolean;
  onVwapToggle: (show: boolean) => void;
  onOpenVwapSettings: () => void;
  elderImpulseShow: boolean;
  onElderImpulseToggle: (show: boolean) => void;
  onOpenEmaSma: () => void;
  superTrendEnabled: boolean;
  onToggleSuperTrend: (enabled: boolean) => void;
  onOpenSuperTrendSettings: () => void;
  // SMC
  fvgSettings: FVGSettings;
  onFVGSettingsChange: (s: FVGSettings) => void;
  obSettings: OrderBlockSettings;
  onOBSettingsChange: (s: OrderBlockSettings) => void;
  breakerSettings: BreakerSettings;
  onBreakerSettingsChange: (s: BreakerSettings) => void;
  bosSettings: BOSSettings;
  onBOSSettingsChange: (s: BOSSettings) => void;
  liquiditySettings: LiquiditySettings;
  onLiquiditySettingsChange: (s: LiquiditySettings) => void;
  pdZoneSettings: PDZoneSettings;
  onPDZoneSettingsChange: (s: PDZoneSettings) => void;
  onOpenSmc: () => void;
  className?: string;
}

interface IndicatorRowProps {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function IndicatorRow({ label, description, checked, onCheckedChange }: IndicatorRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5 px-1">
      <div className="min-w-0 mr-3">
        <div className="text-sm font-medium text-slate-100 leading-tight">{label}</div>
        {description && (
          <div className="text-xs text-slate-400 leading-tight truncate">{description}</div>
        )}
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="shrink-0 data-[state=checked]:bg-blue-600"
      />
    </div>
  );
}

export function IndicatorMenu({
  selectedOscillators,
  onToggleOscillator,
  onOpenOscillators,
  emaShow,
  onEmaToggle,
  emaConfigs,
  smaShow,
  onSmaToggle,
  smaConfigs,
  vwapShow,
  onVwapToggle,
  onOpenVwapSettings,
  elderImpulseShow,
  onElderImpulseToggle,
  onOpenEmaSma,
  superTrendEnabled,
  onToggleSuperTrend,
  onOpenSuperTrendSettings,
  fvgSettings,
  onFVGSettingsChange,
  obSettings,
  onOBSettingsChange,
  breakerSettings,
  onBreakerSettingsChange,
  bosSettings,
  onBOSSettingsChange,
  liquiditySettings,
  onLiquiditySettingsChange,
  pdZoneSettings,
  onPDZoneSettingsChange,
  onOpenSmc,
  className,
}: IndicatorMenuProps) {
  const [open, setOpen] = useState(false);
  const showOwnerOnlyTools = useShowOwnerOnlyTools();

  const activeCount =
    selectedOscillators.size +
    (emaShow ? 1 : 0) +
    (smaShow ? 1 : 0) +
    (vwapShow ? 1 : 0) +
    (superTrendEnabled ? 1 : 0) +
    (showOwnerOnlyTools && elderImpulseShow ? 1 : 0) +
    (fvgSettings.enabled ? 1 : 0) +
    (obSettings.enabled ? 1 : 0) +
    (bosSettings.enabled ? 1 : 0) +
    (liquiditySettings.enabled ? 1 : 0) +
    (pdZoneSettings.enabled ? 1 : 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            'relative h-9 w-9 transition-all',
            activeCount > 0
              ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-300 hover:text-white hover:bg-slate-800',
            className,
          )}
          title="Indicators"
          aria-label="Indicators"
        >
          <Waves className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 text-[10px] font-bold text-white flex items-center justify-center">
              {activeCount > 9 ? '9+' : activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        collisionPadding={12}
        className="w-64 max-h-[min(70dvh,var(--radix-popover-content-available-height,70dvh))] overflow-hidden p-0 bg-slate-900 border-slate-700 text-slate-100 flex flex-col"
      >
        <div className="flex items-center justify-between px-2 py-2 border-b border-slate-700 bg-slate-800">
          <span className="text-xs font-semibold text-slate-300">Indicators & SMC</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOpen(false)}
            className="h-5 w-5 p-0 text-slate-400 hover:text-white hover:bg-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Tabs defaultValue="osc" className="min-h-0 flex-1 flex flex-col">
          <TabsList className="w-full rounded-none border-b border-slate-700 bg-slate-900 h-9">
            <TabsTrigger
              value="osc"
              className="flex-1 text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
            >
              OSC
            </TabsTrigger>
            <TabsTrigger
              value="mas"
              className="flex-1 text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
            >
              Trend
            </TabsTrigger>
            <TabsTrigger
              value="smc"
              className="flex-1 text-xs data-[state=active]:bg-slate-800 data-[state=active]:text-white text-slate-400"
            >
              SMC
            </TabsTrigger>
          </TabsList>

          {/* OSC Tab */}
          <TabsContent value="osc" className="m-0 p-2 min-h-0 overflow-y-auto overscroll-contain max-h-[min(52dvh,calc(70dvh-6rem))]">
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Oscillators
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
                title="Configure oscillators"
                onClick={() => { setOpen(false); onOpenOscillators(); }}
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-0.5">
              {OSCILLATORS.filter(
                (osc) =>
                  showOwnerOnlyTools ||
                  !(OWNER_ONLY_OSCILLATOR_IDS as readonly string[]).includes(osc.id),
              ).map(osc => (
                <IndicatorRow
                  key={osc.id}
                  label={osc.name}
                  description={osc.description}
                  checked={selectedOscillators.has(osc.id)}
                  onCheckedChange={checked => onToggleOscillator(osc.id, checked)}
                />
              ))}
            </div>
          </TabsContent>

          {/* Trend Tab */}
          <TabsContent value="mas" className="m-0 p-2 min-h-0 overflow-y-auto overscroll-contain max-h-[min(52dvh,calc(70dvh-6rem))]">
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Moving Averages
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
                title="Configure moving averages"
                onClick={() => { setOpen(false); onOpenEmaSma(); }}
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-0.5">
              <IndicatorRow
                label="EMA"
                description={
                  emaConfigs.length > 1
                    ? `Periods: ${emaConfigs.map(c => c.period).join(', ')}`
                    : emaConfigs.length === 1
                    ? `Period ${emaConfigs[0].period}`
                    : 'Exponential MA'
                }
                checked={emaShow}
                onCheckedChange={onEmaToggle}
              />
              <IndicatorRow
                label="SMA"
                description={
                  smaConfigs.length > 1
                    ? `Periods: ${smaConfigs.map(c => c.period).join(', ')}`
                    : smaConfigs.length === 1
                    ? `Period ${smaConfigs[0].period}`
                    : 'Simple MA'
                }
                checked={smaShow}
                onCheckedChange={onSmaToggle}
              />
              <IndicatorRow
                label="VWAP"
                description="Volume Weighted Average Price"
                checked={vwapShow}
                onCheckedChange={onVwapToggle}
              />
              <div className="flex items-center justify-end px-1 -mt-1 mb-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-slate-500 hover:text-white hover:bg-slate-800"
                  title="Configure VWAP settings"
                  onClick={() => { setOpen(false); onOpenVwapSettings(); }}
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
              <IndicatorRow
                label="SuperTrend"
                description="Standard, ADX, Keltner"
                checked={superTrendEnabled}
                onCheckedChange={onToggleSuperTrend}
              />
              <div className="flex items-center justify-end px-1 -mt-1 mb-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-slate-500 hover:text-white hover:bg-slate-800"
                  title="Configure SuperTrend settings"
                  onClick={() => { setOpen(false); onOpenSuperTrendSettings(); }}
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
              {showOwnerOnlyTools && (
                <IndicatorRow
                  label="Elder Impulse"
                  description="Trend impulse bars (MACD + EMA)"
                  checked={elderImpulseShow}
                  onCheckedChange={onElderImpulseToggle}
                />
              )}
            </div>
          </TabsContent>

          {/* SMC Tab */}
          <TabsContent value="smc" className="m-0 p-2 min-h-0 overflow-y-auto overscroll-contain max-h-[min(52dvh,calc(70dvh-6rem))]">
            <div className="flex items-center justify-between mb-1 px-1">
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wide">
                Smart Money Concepts
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
                title="Configure SMC indicators"
                onClick={() => { setOpen(false); onOpenSmc(); }}
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-0.5">
              <IndicatorRow
                label="FVG"
                description="Fair Value Gaps"
                checked={fvgSettings.enabled}
                onCheckedChange={checked =>
                  onFVGSettingsChange({ ...fvgSettings, enabled: checked })
                }
              />
              <IndicatorRow
                label="Order Blocks"
                description="Institutional order blocks"
                checked={obSettings.enabled}
                onCheckedChange={checked =>
                  onOBSettingsChange({ ...obSettings, enabled: checked })
                }
              />
              <IndicatorRow
                label="Breaker Blocks"
                description="Converted order blocks"
                checked={breakerSettings.enabled}
                onCheckedChange={checked =>
                  onBreakerSettingsChange({ ...breakerSettings, enabled: checked })
                }
              />
              <IndicatorRow
                label="BOS / CHoCH"
                description="Break of Structure"
                checked={bosSettings.enabled}
                onCheckedChange={checked =>
                  onBOSSettingsChange({ ...bosSettings, enabled: checked })
                }
              />
              <IndicatorRow
                label="Liquidity Zones"
                description="Equal highs / lows"
                checked={liquiditySettings.enabled}
                onCheckedChange={checked =>
                  onLiquiditySettingsChange({ ...liquiditySettings, enabled: checked })
                }
              />
              <IndicatorRow
                label="Premium / Discount"
                description="Fibonacci-based zones"
                checked={pdZoneSettings.enabled}
                onCheckedChange={checked =>
                  onPDZoneSettingsChange({ ...pdZoneSettings, enabled: checked })
                }
              />
            </div>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
