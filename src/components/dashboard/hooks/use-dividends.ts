'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Position, Ticker } from '@/types';
import type { TinkoffDividend } from '@/lib/tinkoff/types';
import {
  computeDividends,
  type DividendSummary,
} from '@/lib/engine/dividends';
import { useTinkoff } from '@/stores/tinkoff';

interface DividendsResponse {
  ok: boolean;
  dividendsByTicker?: Record<string, TinkoffDividend[]>;
  errors?: { ticker: string; error: string }[];
  error?: string;
}

interface Params {
  positions: Position[];
  universe: Ticker[];
  portfolioValue: number;
}

export interface UseDividendsResult {
  summary: DividendSummary | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  enabled: boolean;
}

export function useDividends({
  positions,
  universe,
  portfolioValue,
}: Params): UseDividendsResult {
  const { token } = useTinkoff();
  const [summary, setSummary] = useState<DividendSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabled = Boolean(token) && positions.length > 0;

  const refresh = useCallback(async () => {
    if (!token || positions.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const tickers = positions.map((p) => p.ticker);
      const res = await fetch('/api/tinkoff/dividends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, tickers }),
      });
      const j = (await res.json()) as DividendsResponse;
      if (!j.ok) {
        setError(j.error ?? 'ошибка загрузки');
        return;
      }
      const map = new Map<string, TinkoffDividend[]>(
        Object.entries(j.dividendsByTicker ?? {}),
      );
      setSummary(
        computeDividends({
          positions,
          universe,
          dividendsByTicker: map,
          portfolioValue,
        }),
      );
      // Частичный провал — сообщаем тикеры, но показываем данные.
      if (j.errors && j.errors.length > 0) {
        setError(
          `не удалось загрузить: ${j.errors.length} тикер(ов). Остальные данные показаны.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ошибка сети');
    } finally {
      setLoading(false);
    }
  }, [token, positions, universe, portfolioValue]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
  }, [enabled, refresh]);

  return { summary, loading, error, refresh, enabled };
}
