'use client';

import type { MonthSnapshot } from '@/lib/backtest/types';
import { LightweightLineChart, type LineSeriesConfig } from '@/components/charts/lightweight-line-chart';

interface Props {
  snapshots: MonthSnapshot[];
}

export function BacktestChart({ snapshots }: Props) {
  if (snapshots.length === 0) return null;

  const series: LineSeriesConfig[] = [
    {
      data: snapshots.map((s) => ({ time: s.date, value: s.invested })),
      color: '#737373',
      width: 1,
      dashed: true,
      title: 'Вложено',
    },
    {
      data: snapshots.map((s) => ({ time: s.date, value: s.benchmarkValue })),
      color: '#3b82f6',
      width: 1,
      title: 'IMOEX',
    },
    {
      data: snapshots.map((s) => ({
        time: s.date,
        value: s.benchmarkTotalReturnValue,
      })),
      color: '#8b5cf6',
      width: 1,
      title: 'MCFTR',
    },
    {
      data: snapshots.map((s) => ({ time: s.date, value: s.totalValue })),
      color: '#22c55e',
      width: 2,
      title: 'Портфель',
    },
  ];

  return <LightweightLineChart series={series} height={440} />;
}
