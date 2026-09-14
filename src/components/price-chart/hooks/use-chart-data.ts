'use client';

import { useEffect, useRef, useState } from 'react';
import type { IChartApi, ISeriesApi, Time, CandlestickData } from 'lightweight-charts';
import { getCached, setCached } from '@/lib/moex/history-cache';
import { POLL_MS } from '../constants';
import type { Candle } from '../types';

interface Params {
  open: boolean;
  chartReady: boolean;
  ticker: string | null;
  intervalValue: number;
  maxDays: number;
  chartRef: React.RefObject<IChartApi | null>;
  seriesRef: React.RefObject<ISeriesApi<'Candlestick'> | null>;
}

interface Result {
  loading: boolean;
  error: string | null;
  allData: Candle[];
  barCount: number;
  updatedAt: Date | null;
  dataLengthRef: React.RefObject<number>;
  firstDataLoaded: boolean;
}

/**
 * Загружает свечи: клиентский кэш → API → polling каждые POLL_MS.
 * Сохраняет данные в series. Возвращает состояние для UI.
 */
export function useChartData({
  open,
  chartReady,
  ticker,
  intervalValue,
  maxDays,
  chartRef,
  seriesRef,
}: Params): Result {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allData, setAllData] = useState<Candle[]>([]);
  const [barCount, setBarCount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [firstDataLoaded, setFirstDataLoaded] = useState(false);
  const dataLengthRef = useRef(0);

  useEffect(() => {
    if (!open || !chartReady || !ticker) return;
    let cancelled = false;
    let first = true;

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

      if (first) {
        first = false;
        setFirstDataLoaded(true);
      } else if (prevRange) {
        chart.timeScale().setVisibleLogicalRange(prevRange);
      }
    };

    const load = async (): Promise<void> => {
      const cached = getCached(ticker, intervalValue, maxDays);
      if (cached && cached.length > 0 && first) {
        setError(null);
        applyData(cached);
        setUpdatedAt(new Date());
        first = false;
        return;
      }

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
  }, [open, chartReady, ticker, intervalValue, maxDays, chartRef, seriesRef]);

  return {
    loading,
    error,
    allData,
    barCount,
    updatedAt,
    dataLengthRef,
    firstDataLoaded,
  };
}
