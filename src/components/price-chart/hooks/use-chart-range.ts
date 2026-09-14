'use client';

import { useCallback, useEffect } from 'react';
import type { IChartApi } from 'lightweight-charts';
import { barsForDays } from '../constants';

interface Params {
  open: boolean;
  chartReady: boolean;
  firstDataLoaded: boolean;
  rangeDays: number;
  intervalValue: number;
  chartRef: React.RefObject<IChartApi | null>;
  dataLengthRef: React.RefObject<number>;
}

/**
 * Управляет видимым диапазоном свечей.
 * - при первой загрузке данных — устанавливает окно под текущий rangeDays
 * - при смене rangeDays/intervalValue — пересчитывает видимое окно
 * - возвращает applyRange для двойного клика
 */
export function useChartRange({
  open,
  chartReady,
  firstDataLoaded,
  rangeDays,
  intervalValue,
  chartRef,
  dataLengthRef,
}: Params): (days: number, iv: number) => void {
  const applyRange = useCallback(
    (days: number, iv: number) => {
      const chart = chartRef.current;
      const length = dataLengthRef.current ?? 0;
      if (!chart || length === 0) return;
      const bars = barsForDays(days, iv);
      const show = Math.min(length, bars);
      const from = Math.max(0, length - show);
      chart.timeScale().setVisibleLogicalRange({ from, to: length - 1 });
    },
    [chartRef, dataLengthRef],
  );

  // Первая установка окна — когда данные загрузились.
  useEffect(() => {
    if (!open || !chartReady || !firstDataLoaded) return;
    requestAnimationFrame(() => applyRange(rangeDays, intervalValue));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstDataLoaded]);

  // Смена диапазона/интервала — без рефетча.
  useEffect(() => {
    if (!open || !chartReady || !firstDataLoaded) return;
    applyRange(rangeDays, intervalValue);
  }, [rangeDays, intervalValue, open, chartReady, firstDataLoaded, applyRange]);

  return applyRange;
}
