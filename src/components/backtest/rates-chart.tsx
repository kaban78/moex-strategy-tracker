'use client';

import type { RatePoint } from '@/lib/cbr/client';
import { LightweightLineChart, type LineSeriesConfig } from '@/components/charts/lightweight-line-chart';

interface Props {
  keyRate: RatePoint[];
  depositRate: RatePoint[];
}

export function RatesChart({ keyRate, depositRate }: Props) {
  if (keyRate.length === 0 && depositRate.length === 0) {
    return (
      <div className="w-full h-[260px] flex items-center justify-center text-sm text-muted-foreground">
        нет данных по ставкам
      </div>
    );
  }

  const series: LineSeriesConfig[] = [
    {
      data: keyRate.map((p) => ({ time: p.date, value: p.value })),
      color: '#ef4444',
      width: 2,
      title: 'Ключевая ставка',
    },
    {
      data: depositRate.map((p) => ({ time: p.date, value: p.value })),
      color: '#3b82f6',
      width: 2,
      title: 'Вклады топ-10',
    },
  ];

  return (
    <LightweightLineChart series={series} height={260} priceFormatter="percent" />
  );
}
