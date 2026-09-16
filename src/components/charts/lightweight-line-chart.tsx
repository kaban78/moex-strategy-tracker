'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  LineSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type LineData,
  type LineStyle,
  type Time,
} from 'lightweight-charts';
import { formatRub } from '@/lib/format';

export interface LineSeriesConfig {
  data: Array<{ time: string; value: number }>;
  color: string;
  width?: 1 | 2 | 3 | 4;
  dashed?: boolean;
  title?: string;
  lastValueVisible?: boolean;
}

export type PriceFormatter = 'rub' | 'percent';

interface Props {
  series: LineSeriesConfig[];
  height?: number;
  priceFormatter?: PriceFormatter;
}

const FORMATTERS: Record<PriceFormatter, (v: number) => string> = {
  rub: (v) => formatRub(v),
  percent: (v) => v.toFixed(2) + '%',
};

/**
 * Обёртка lightweight-charts для линейных графиков.
 * Одна настройка темы, один конфиг crosshair, разные серии.
 */
export function LightweightLineChart({
  series,
  height = 440,
  priceFormatter = 'rub',
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || series.length === 0) return;

    let raf = 0;
    const init = () => {
      if (!hostRef.current) return;
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w < 20 || h < 20) {
        raf = requestAnimationFrame(init);
        return;
      }

      const chart = createChart(host, {
        autoSize: true,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#a3a3a3',
          fontSize: 11,
          fontFamily: 'inherit',
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: '#333', style: 1 },
          horzLines: { color: '#333', style: 1 },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: '#555',
            width: 1,
            style: 2,
            labelBackgroundColor: '#5a5a5a',
          },
          horzLine: {
            color: '#555',
            width: 1,
            style: 2,
            labelBackgroundColor: '#5a5a5a',
          },
        },
        rightPriceScale: { borderColor: '#4a4a4a' },
        timeScale: {
          borderColor: '#4a4a4a',
          timeVisible: false,
          secondsVisible: false,
          fixLeftEdge: true,
          fixRightEdge: true,
        },
        localization: {
          priceFormatter: FORMATTERS[priceFormatter],
        },
      });

      for (const s of series) {
        const line = chart.addSeries(LineSeries, {
          color: s.color,
          lineWidth: s.width ?? 2,
          lineStyle: s.dashed ? (2 as LineStyle) : (0 as LineStyle),
          priceLineVisible: false,
          lastValueVisible: s.lastValueVisible ?? false,
          title: s.title,
        });

        const data: LineData<Time>[] = s.data.map((p) => ({
          time: p.time as Time,
          value: p.value,
        }));
        line.setData(data);
      }

      chart.timeScale().fitContent();
      chartRef.current = chart;
    };

    raf = requestAnimationFrame(init);

    return () => {
      cancelAnimationFrame(raf);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [series, priceFormatter]);

  if (series.length === 0) return null;

  return <div ref={hostRef} className="w-full" style={{ height }} />;
}
