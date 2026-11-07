// Copyright (c) 2025-2026 BEARTEC (Scott Reynolds). All rights reserved.
import { falconChartStatus, type FalconCandleMeta } from '@/lib/falconChartStatus';

interface Props {
  pair: string;
  candleCount: number;
  isLoading: boolean;
  error: Error | null;
  meta: FalconCandleMeta | null;
  className?: string;
}

/** Compact one-line status for Falcon charts. Sits above the chart; never overlays it. */
export function FalconChartStatusBanner({ pair, candleCount, isLoading, error, meta, className = '' }: Props) {
  const s = falconChartStatus({ pair, candleCount, isLoading, error, meta });
  const tone =
    s.tone === 'error'
      ? 'border-red-500/40 bg-red-500/10 text-red-300'
      : s.tone === 'warn'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
        : 'border-border bg-muted/40 text-muted-foreground';
  return (
    <div
      role="status"
      data-testid="falcon-chart-status"
      data-kind={s.kind}
      className={`rounded-md border px-3 py-1.5 text-xs leading-snug ${tone} ${className}`}
    >
      <span className="font-medium text-foreground/90">{s.title}</span>
      <span className="mx-1.5 opacity-50">·</span>
      <span>{s.detail}</span>
    </div>
  );
}
