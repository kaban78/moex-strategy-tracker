'use client';

import { useEffect, useRef } from 'react';
import {
  createChart,
  LineSeries,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type LineData,
  type Time,
} from 'lightweight-charts';
import type { RatePoint } from '@/lib/cbr/client';

interface Props {
  keyRate: RatePoint[];
  depositRate: RatePoint[];
}

export function RatesChart({ keyRate, depositRate }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || (keyRate.length === 0 && depositRate.length === 0)) return;

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
          priceFormatter: (p: number) => p.toFixed(2) + '%',
        },
      });

      const keySeries = chart.addSeries(LineSeries, {
        color: '#ef4444',
        lineWidth: 2,
        priceLineVisible: false,
        title: 'Ключевая ставка',
      });

      const depSeries = chart.addSeries(LineSeries, {
        color: '#3b82f6',
        lineWidth: 2,
        priceLineVisible: false,
        title: 'Вклады топ-10',
      });

      keySeries.setData(
        keyRate.map((p) => ({ time: p.date as Time, value: p.value })),
      );
      depSeries.setData(
        depositRate.map((p) => ({ time: p.date as Time, value: p.value })),
      );

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
  }, [keyRate, depositRate]);

  if (keyRate.length === 0 && depositRate.length === 0) {
    return (
      <div className="w-full h-[260px] flex items-center justify-center text-sm text-muted-foreground">
        нет данных по ставкам
      </div>
    );
  }

  return <div ref={hostRef} className="w-full h-[260px]" />;
}
