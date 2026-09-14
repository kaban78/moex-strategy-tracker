'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from 'next-themes';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from 'lightweight-charts';
import { moexIssueUrl } from '@/lib/moex/links';
import { getCached, setCached } from '@/lib/moex/history-cache';
import { formatRub } from '@/lib/format';

const INTERVALS = [
  { label: '1ч', value: 60, maxDays: 365 },
  { label: '1д', value: 24, maxDays: 3650 },
  { label: '1н', value: 7, maxDays: 3650 },
  { label: '1м', value: 31, maxDays: 3650 },
] as const;

const RANGES = [
  { label: '1м', days: 30 },
  { label: '3м', days: 90 },
  { label: '6м', days: 180 },
  { label: '1г', days: 365 },
  { label: '2г', days: 730 },
  { label: '5л', days: 1825 },
  { label: 'Все', days: 99999 },
] as const;

const DEFAULT_INTERVAL = 24;
const DEFAULT_RANGE = 365;
const POLL_MS = 60_000;

interface Palette {
  bg: string;
  fg: string;
  border: string;
  grid: string;
  up: string;
  down: string;
  crosshairLabel: string;
}

const PALETTES: Record<'dark' | 'light', Palette> = {
  dark: {
    bg: '#1e1e1e',
    fg: '#e5e5e5',
    border: '#4a4a4a',
    grid: '#333333',
    up: '#22c55e',
    down: '#ef4444',
    crosshairLabel: '#5a5a5a',
  },
  light: {
    bg: '#ffffff',
    fg: '#171717',
    border: '#d4d4d4',
    grid: '#f0f0f0',
    up: '#16a34a',
    down: '#dc2626',
    crosshairLabel: '#a3a3a3',
  },
};

interface Candle {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Props {
  ticker: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Hover {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

function barsForDays(days: number, interval: number): number {
  const tradingRatio = 250 / 365;
  const perTradingDay: Record<number, number> = {
    1: 8 * 60,
    10: 8 * 6,
    60: 8,
    24: 1,
    7: 1 / 5,
    31: 1 / 22,
  };
  const ratio = perTradingDay[interval] ?? 1;
  return Math.max(2, Math.round(days * tradingRatio * ratio));
}

export function PriceChartDialog({ ticker, open, onOpenChange }: Props) {
  const { resolvedTheme } = useTheme();
  const palette: Palette =
    PALETTES[resolvedTheme === 'light' ? 'light' : 'dark'];

  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intervalValue, setIntervalValue] = useState<number>(DEFAULT_INTERVAL);
  const [rangeDays, setRangeDays] = useState<number>(DEFAULT_RANGE);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dim, setDim] = useState({ w: 1180, h: 720 });
  const [allData, setAllData] = useState<Candle[]>([]);
  const [hover, setHover] = useState<Hover | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [barCount, setBarCount] = useState(0);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const dataLengthRef = useRef(0);
  const rangeRef = useRef<number>(DEFAULT_RANGE);
  const intervalRef = useRef<number>(DEFAULT_INTERVAL);
  const dragRef = useRef({ active: false, sx: 0, sy: 0, bx: 0, by: 0 });
  const resizeRef = useRef({ active: false, sx: 0, sy: 0, bw: 0, bh: 0 });

  rangeRef.current = rangeDays;
  intervalRef.current = intervalValue;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setPos({ x: 0, y: 0 });
    setHover(null);
    setAllData([]);
    setBarCount(0);
    dataLengthRef.current = 0;
    setIntervalValue(DEFAULT_INTERVAL);
    setRangeDays(DEFAULT_RANGE);
  }, [open, ticker]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let raf = 0;

    const init = () => {
      const host = hostRef.current;
      if (!host) return;
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w < 20 || h < 20) {
        raf = requestAnimationFrame(init);
        return;
      }

      const chart = createChart(host, {
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: palette.bg },
          textColor: palette.fg,
          fontSize: 11,
          fontFamily: 'inherit',
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: palette.grid, style: 1 },
          horzLines: { color: palette.grid, style: 1 },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: palette.border,
            width: 1,
            style: 2,
            labelBackgroundColor: palette.crosshairLabel,
          },
          horzLine: {
            color: palette.border,
            width: 1,
            style: 2,
            labelBackgroundColor: palette.crosshairLabel,
          },
        },
        rightPriceScale: { borderColor: palette.border },
        timeScale: {
          borderColor: palette.border,
          timeVisible: false,
          secondsVisible: false,
          barSpacing: 6,
          minBarSpacing: 0.05,
          fixLeftEdge: false,
          fixRightEdge: false,
          lockVisibleTimeRangeOnResize: true,
          rightOffset: 0,
        },
        handleScroll: {
          mouseWheel: true,
          pressedMouseMove: true,
          horzTouchDrag: true,
          vertTouchDrag: false,
        },
        handleScale: {
          mouseWheel: true,
          pinch: true,
          axisPressedMouseMove: true,
        },
        localization: {
          priceFormatter: (p: number) => formatRub(p),
        },
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: palette.up,
        downColor: palette.down,
        borderUpColor: palette.up,
        borderDownColor: palette.down,
        wickUpColor: palette.up,
        wickDownColor: palette.down,
        priceLineVisible: false,
        lastValueVisible: true,
      });

      chart.subscribeCrosshairMove((param) => {
        if (!param.time || !param.seriesData) {
          setHover(null);
          return;
        }
        const d = param.seriesData.get(series) as
          | CandlestickData
          | undefined;
        if (d && typeof d.open === 'number') {
          setHover({
            time: String(param.time),
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
          });
        } else {
          setHover(null);
        }
      });

      chartRef.current = chart;
      seriesRef.current = series;

      setChartReady(true);
    };

    raf = requestAnimationFrame(init);

    return () => {
      cancelAnimationFrame(raf);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
      seriesRef.current = null;
      setChartReady(false);
    };
  }, [open, palette]);

  const applyRange = useCallback((days: number, iv: number) => {
    const chart = chartRef.current;
    const length = dataLengthRef.current;
    if (!chart || length === 0) return;
    const bars = barsForDays(days, iv);
    const show = Math.min(length, bars);
    const from = Math.max(0, length - show);
    chart.timeScale().setVisibleLogicalRange({ from, to: length - 1 });
  }, []);

  useEffect(() => {
    if (!open || !chartReady || !ticker) return;
    let cancelled = false;
    let firstLoad = true;

    const meta = INTERVALS.find((i) => i.value === intervalValue);
    const maxDays = meta ? meta.maxDays : 365;

    chartRef.current?.applyOptions({
      timeScale: {
        timeVisible: intervalValue < 24,
        secondsVisible: false,
      },
    });

    const applyData = (raw: Candle[]) => {
      const chart = chartRef.current;
      const series = seriesRef.current;
      if (!chart || !series || raw.length === 0) return;

      const formatted: CandlestickData<Time>[] = raw.map((c) => ({
        time: c.time as Time,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));

      const prevRange = chart.timeScale().getVisibleLogicalRange();
      series.setData(formatted);
      dataLengthRef.current = raw.length;
      setAllData(raw);
      setBarCount(raw.length);

      if (firstLoad) {
        firstLoad = false;
        requestAnimationFrame(() => {
          applyRange(rangeRef.current, intervalRef.current);
        });
      } else if (prevRange) {
        chart.timeScale().setVisibleLogicalRange(prevRange);
      }
    };

    const load = async (): Promise<void> => {
      // 1) Клиентский кэш — мгновенно.
      const cached = getCached(ticker, intervalValue, maxDays);
      if (cached && cached.length > 0 && firstLoad) {
        setError(null);
        applyData(cached);
        setUpdatedAt(new Date());
        firstLoad = false;
        return;
      }

      // 2) Сеть — БЕЗ cache-busting. Пусть браузер и Next.js кэшируют.
      try {
        const r = await fetch(
          `/api/history/${encodeURIComponent(ticker)}?interval=${intervalValue}&days=${maxDays}`,
        );
        const j = await r.json();
        if (cancelled) return;
        if (!j.ok) {
          setError(j.error ?? 'ошибка загрузки');
          return;
        }
        const raw: Candle[] = j.data ?? [];
        if (raw.length === 0) {
          setError('нет данных');
          return;
        }
        setError(null);
        setCached(ticker, intervalValue, maxDays, raw);
        applyData(raw);
        setUpdatedAt(new Date());
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'ошибка');
        }
      }
    };

    setLoading(true);
    setError(null);
    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });

    const timer = window.setInterval(() => {
      void load();
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open, chartReady, ticker, intervalValue, applyRange]);

  useEffect(() => {
    if (!open || !chartReady) return;
    applyRange(rangeDays, intervalValue);
  }, [rangeDays, intervalValue, open, chartReady, applyRange]);

  useEffect(() => {
    if (!open || !chartReady) return;
    const host = hostRef.current;
    if (!host) return;
    const handler = () => {
      applyRange(rangeRef.current, intervalRef.current);
    };
    host.addEventListener('dblclick', handler);
    return () => host.removeEventListener('dblclick', handler);
  }, [open, chartReady, applyRange]);

  useEffect(() => {
    if (!open) return;

    function onMove(e: MouseEvent) {
      if (dragRef.current.active) {
        const d = dragRef.current;
        setPos({
          x: d.bx + (e.clientX - d.sx),
          y: d.by + (e.clientY - d.sy),
        });
      } else if (resizeRef.current.active) {
        const r = resizeRef.current;
        setDim({
          w: Math.max(600, r.bw + (e.clientX - r.sx)),
          h: Math.max(400, r.bh + (e.clientY - r.sy)),
        });
      }
    }
    function onUp() {
      dragRef.current.active = false;
      resizeRef.current.active = false;
      document.body.style.userSelect = '';
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [open]);

  function onPanelMouseDown(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.closest('a, button, input, select, textarea, [data-no-drag]')) return;
    dragRef.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      bx: pos.x,
      by: pos.y,
    };
    document.body.style.userSelect = 'none';
  }

  function onResizeMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    resizeRef.current = {
      active: true,
      sx: e.clientX,
      sy: e.clientY,
      bw: dim.w,
      bh: dim.h,
    };
    document.body.style.userSelect = 'none';
  }

  const quote = useMemo(() => {
    if (allData.length === 0) return null;
    const bars = barsForDays(rangeDays, intervalValue);
    const from = Math.max(0, allData.length - bars);
    const first = allData[from];
    const last = allData[allData.length - 1];
    if (!first || !last) return null;
    const firstOpen = first.open;
    const lastClose = last.close;
    return {
      price: lastClose,
      change:
        firstOpen > 0 ? ((lastClose - firstOpen) / firstOpen) * 100 : 0,
      changeAbs: lastClose - firstOpen,
    };
  }, [allData, rangeDays, intervalValue]);

  if (!mounted || !open) return null;

  const headerPrice = hover?.close ?? quote?.price ?? 0;
  const headerChange = quote?.change ?? 0;
  const headerChangeAbs = quote?.changeAbs ?? 0;

  const chipBase = 'px-3 py-1 text-xs rounded-md border transition-colors';
  function chipStyle(active: boolean): React.CSSProperties {
    return active
      ? {
          backgroundColor: palette.fg,
          color: palette.bg,
          borderColor: palette.fg,
        }
      : {
          backgroundColor: 'transparent',
          color: palette.fg,
          borderColor: palette.border,
        };
  }

  const modal = (
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
        <div
          className="flex items-baseline gap-4 flex-wrap px-4 py-3 border-b cursor-move shrink-0"
          style={{
            backgroundColor: palette.bg,
            borderBottomColor: palette.border,
            color: palette.fg,
          }}
        >
          <span className="font-mono text-xl" data-no-drag>
            {ticker}
          </span>
          {headerPrice > 0 && (
            <>
              <span className="text-base">{formatRub(headerPrice)}</span>
              <span
                className={
                  'text-sm ' +
                  (headerChange >= 0 ? 'text-green-500' : 'text-red-500')
                }
              >
                {headerChange >= 0 ? '+' : ''}
                {headerChange.toFixed(2)}% ({headerChange >= 0 ? '+' : ''}
                {formatRub(headerChangeAbs)})
              </span>
            </>
          )}
          {hover && (
            <span className="text-xs" style={{ color: palette.crosshairLabel }}>
              O {formatRub(hover.open)} · H {formatRub(hover.high)} · L{' '}
              {formatRub(hover.low)} · C {formatRub(hover.close)}
            </span>
          )}
          <div className="ml-auto flex gap-3 items-center">
            {updatedAt && (
              <span
                className="text-xs"
                style={{ color: palette.crosshairLabel }}
              >
                {barCount} бар ·{' '}
                {updatedAt.toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            )}
            <a
              href={ticker ? moexIssueUrl(ticker) : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline decoration-dotted underline-offset-4 hover:text-blue-500"
              style={{ color: palette.crosshairLabel }}
              data-no-drag
            >
              MOEX →
            </a>
            <button
              type="button"
              data-no-drag
              onClick={() => onOpenChange(false)}
              className="text-2xl leading-none px-2 -mt-1 opacity-70 hover:opacity-100"
              style={{ color: palette.fg }}
              aria-label="закрыть"
            >
              ×
            </button>
          </div>
        </div>

        <div
          className="flex gap-1 items-center flex-wrap px-4 py-2 border-b shrink-0"
          style={{
            backgroundColor: palette.bg,
            borderBottomColor: palette.border,
          }}
        >
          <span className="text-xs mr-2" style={{ color: palette.crosshairLabel }}>
            свечи:
          </span>
          {INTERVALS.map((i) => (
            <button
              key={i.value}
              type="button"
              data-no-drag
              onClick={() => setIntervalValue(i.value)}
              className={chipBase}
              style={chipStyle(intervalValue === i.value)}
            >
              {i.label}
            </button>
          ))}
        </div>

        <div
          className="flex gap-1 items-center flex-wrap px-4 py-2 border-b shrink-0"
          style={{
            backgroundColor: palette.bg,
            borderBottomColor: palette.border,
          }}
        >
          <span className="text-xs mr-2" style={{ color: palette.crosshairLabel }}>
            период:
          </span>
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              data-no-drag
              onClick={() => setRangeDays(r.days)}
              className={chipBase}
              style={chipStyle(rangeDays === r.days)}
            >
              {r.label}
            </button>
          ))}
          <span
            className="text-xs ml-auto"
            style={{ color: palette.crosshairLabel }}
          >
            колесо — зум · тяни — скролл · 2× клик — сброс
          </span>
        </div>

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

        <div
          onMouseDown={onResizeMouseDown}
          className="absolute bottom-0 right-0 w-5 h-5 cursor-nwse-resize group"
          aria-label="изменить размер"
        >
          <svg
            viewBox="0 0 20 20"
            className="w-full h-full group-hover:opacity-100 opacity-60"
            style={{ color: palette.fg }}
          >
            <line
              x1="6"
              y1="18"
              x2="18"
              y2="6"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="12"
              y1="18"
              x2="18"
              y2="12"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
