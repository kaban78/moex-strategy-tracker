'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';
import { CHART_PALETTES } from './palettes';
import {
  DEFAULT_INTERVAL,
  DEFAULT_RANGE,
  INTERVALS,
  barsForDays,
} from './constants';
import { useChart } from './hooks/use-chart';
import { useChartData } from './hooks/use-chart-data';
import { useChartRange } from './hooks/use-chart-range';
import { useWindowDrag } from './hooks/use-window-drag';
import { ChartHeader } from './chart-header';
import { ChartToolbar } from './chart-toolbar';
import { ChartResizeHandle } from './chart-resize-handle';
import type { Quote } from './types';

interface Props {
  ticker: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PriceChartDialog({ ticker, open, onOpenChange }: Props) {
  const { resolvedTheme } = useTheme();
  const palette = CHART_PALETTES[resolvedTheme === 'light' ? 'light' : 'dark'];

  const [mounted, setMounted] = useState(false);
  const [intervalValue, setIntervalValue] = useState<number>(DEFAULT_INTERVAL);
  const [rangeDays, setRangeDays] = useState<number>(DEFAULT_RANGE);

  const { pos, dim, onPanelMouseDown, onResizeMouseDown } =
    useWindowDrag(open);

  const { hostRef, chartRef, seriesRef, chartReady, hover } = useChart(
    open,
    palette,
  );

  const maxDays = useMemo(() => {
    const meta = INTERVALS.find((i) => i.value === intervalValue);
    return meta ? meta.maxDays : 365;
  }, [intervalValue]);

  const {
    loading,
    error,
    allData,
    barCount,
    updatedAt,
    dataLengthRef,
    firstDataLoaded,
  } = useChartData({
    open,
    chartReady,
    ticker,
    intervalValue,
    maxDays,
    chartRef,
    seriesRef,
  });

  const applyRange = useChartRange({
    open,
    chartReady,
    firstDataLoaded,
    rangeDays,
    intervalValue,
    chartRef,
    dataLengthRef,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setIntervalValue(DEFAULT_INTERVAL);
    setRangeDays(DEFAULT_RANGE);
  }, [open, ticker]);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Double-click — reset
  useEffect(() => {
    if (!open || !chartReady) return;
    const host = hostRef.current;
    if (!host) return;
    const handler = () => applyRange(rangeDays, intervalValue);
    host.addEventListener('dblclick', handler);
    return () => host.removeEventListener('dblclick', handler);
  }, [open, chartReady, hostRef, applyRange, rangeDays, intervalValue]);

  const quote: Quote | null = useMemo(() => {
    if (allData.length === 0) return null;
    const bars = barsForDays(rangeDays, intervalValue);
    const from = Math.max(0, allData.length - bars);
    const first = allData[from];
    const last = allData[allData.length - 1];
    if (!first || !last) return null;
    return {
      price: last.close,
      change:
        first.open > 0 ? ((last.close - first.open) / first.open) * 100 : 0,
      changeAbs: last.close - first.open,
    };
  }, [allData, rangeDays, intervalValue]);

  if (!mounted || !open || !ticker) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/60"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        className="absolute border rounded-lg shadow-2xl flex flex-col overflow-hidden"
        style={{
          width: dim.w,
          height: dim.h,
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
          backgroundColor: palette.bg,
          color: palette.fg,
          borderColor: palette.border,
        }}
        onMouseDown={onPanelMouseDown}
      >
        <ChartHeader
          ticker={ticker}
          palette={palette}
          hover={hover}
          quote={quote}
          barCount={barCount}
          updatedAt={updatedAt}
          onClose={() => onOpenChange(false)}
        />

        <ChartToolbar
          palette={palette}
          intervalValue={intervalValue}
          rangeDays={rangeDays}
          onIntervalChange={setIntervalValue}
          onRangeChange={setRangeDays}
        />

        <div
          ref={hostRef}
          className="flex-1 min-h-0 relative"
          data-no-drag
          style={{ backgroundColor: palette.bg }}
        >
          {loading && !chartReady && (
            <div
              className="absolute inset-0 flex items-center justify-center text-sm pointer-events-none"
              style={{ color: palette.crosshairLabel }}
            >
              загрузка...
            </div>
          )}
          {error && (
            <div className="absolute top-2 left-2 text-xs text-destructive pointer-events-none">
              {error}
            </div>
          )}
        </div>

        <ChartResizeHandle
          palette={palette}
          onMouseDown={onResizeMouseDown}
        />
      </div>
    </div>,
    document.body,
  );
}
