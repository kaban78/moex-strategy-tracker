// language: TypeScript, target: backtest utility functions
// Мелкие утилиты: оценка стоимости портфеля, работа с датами.

import type { Position, Ticker } from '@/types';
import { priceOn } from './prices';

export interface Holding {
  ticker: string;
  lots: number;
}

export function positionsValue(
  holdings: Holding[],
  universe: Ticker[],
  prices: Map<string, Map<string, number>>,
  date: string,
): number {
  const lotByTicker = new Map(universe.map((t) => [t.ticker, t.lotSize]));
  let sum = 0;
  for (const h of holdings) {
    const price = priceOn(prices, h.ticker, date);
    if (price == null) continue;
    const lotSize = lotByTicker.get(h.ticker) ?? 1;
    sum += h.lots * lotSize * price;
  }
  return sum;
}

export function holdingsToPositions(holdings: Holding[]): Position[] {
  return holdings.map((h) => ({ ticker: h.ticker, lots: h.lots }));
}

export function diffDays(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.max(1, Math.round((db - da) / (24 * 3600 * 1000)));
}
