'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createChart,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
} from 'lightweight-charts';
import { formatRub } from '@/lib/format';
import type { ChartPalette } from '../palettes';
import type { Hover } from '../types';

export interface UseChartResult {
  hostRef: React.RefObject<HTMLDivElement | null>;
  chartRef: React.RefObject<IChartApi | null>;
  seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>;
  chartReady: boolean;
  hover: Hover | null;
}

/**
 * Инициализирует lightweight-charts в контейнере.
 * Пересоздаёт chart при смене палитры (переключение темы).
 */
export function useChart(
  open: boolean,
  palette: ChartPalette,
): UseChartResult {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [hover, setHover] = useState<Hover | null>(null);

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

  return { hostRef, chartRef, seriesRef, chartReady, hover };
}
