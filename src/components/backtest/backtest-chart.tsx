'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  LineSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from 'lightweight-charts';
import type { MonthSnapshot } from '@/lib/backtest/types';
import { formatRub } from '@/lib/format';

interface Props {
  snapshots: MonthSnapshot[];
}

export function BacktestChart({ snapshots }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || snapshots.length === 0) return;

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
          vertLine: { color: '#555', width: 1, style: 2, labelBackgroundColor: '#5a5a5a' },
          horzLine: { color: '#555', width: 1, style: 2, labelBackgroundColor: '#5a5a5a' },
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
          priceFormatter: (p: number) => formatRub(p),
        },
      });

      const invested = chart.addSeries(LineSeries, {
        color: '#737373',
        lineWidth: 1,
        lineStyle: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        title: 'Вложено',
      });

      const benchmark = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 2,
        priceLineVisible: false,
        title: 'IMOEX',
      });

      const portfolio = chart.addSeries(LineSeries, {
        color: '#22c55e',
        lineWidth: 2,
        priceLineVisible: false,
        title: 'Портфель',
      });

      const toLine = (key: keyof MonthSnapshot): LineData<Time>[] =>
        snapshots.map((s) => ({
          time: s.date as Time,
          value: Number(s[key]),
        }));

      invested.setData(toLine('invested'));
      benchmark.setData(toLine('benchmarkValue'));
      portfolio.setData(toLine('totalValue'));

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
  }, [snapshots]);

  if (snapshots.length === 0) return null;

  return <div ref={hostRef} className="w-full h-[440px]" />;
}
