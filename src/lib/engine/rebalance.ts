// language: TypeScript, target: rebalance via top-ups
// Распределение свободного кэша по недобранным позициям.
//
// Два прохода:
//   1. Greedy: покупаем floor(needed) лотов по каждой недобранной позиции.
//   2. Top-up: пока есть кэш и есть недобранные — покупаем 1 лот
//      самой недобранной. Это сливает кэш в рынок.
//
// В конце — агрегация: одна строка на (ticker, side).
//
// Продажи — только если изначально кэша не было.
//
// Это информационный инструмент. Не является инвестиционной рекомендацией.
// См. src/lib/legal/disclaimers.ts.

import type { Ticker } from '@/types';
import type { Drift } from './drift';

export interface RebalanceOptions {
  drifts: Drift[];
  universe: Ticker[];
  cash: number;
  sellThreshold?: number;
  allowTopUp?: boolean;
}

export interface RebalanceAction {
  ticker: string;
  side: 'buy' | 'sell';
  lots: number;
  cost: number;
}

export interface RebalanceResult {
  actions: RebalanceAction[];
  cashLeft: number;
  buyValue: number;
  sellValue: number;
}

const DEFAULT_SELL_THRESHOLD = 0.05;

interface WorkingState {
  ticker: string;
  lotCost: number;
  currentValue: number;
  targetValue: number;
}

interface RawAction {
  ticker: string;
  side: 'buy' | 'sell';
  lots: number;
  cost: number;
}

export function rebalance(options: RebalanceOptions): RebalanceResult {
  const sellThreshold = options.sellThreshold ?? DEFAULT_SELL_THRESHOLD;
  const allowTopUp = options.allowTopUp ?? true;
  const tickerMap = new Map(options.universe.map((t) => [t.ticker, t]));
  const raw: RawAction[] = [];
  let remaining = options.cash;

  const state: WorkingState[] = options.drifts.map((d) => {
    const t = tickerMap.get(d.ticker);
    return {
      ticker: d.ticker,
      lotCost: t ? t.lotSize * t.price : 0,
      currentValue: d.currentValue,
      targetValue: d.targetValue,
    };
  });

  // Проход 1: greedy.
  const underweight = [...state]
    .filter((s) => s.currentValue < s.targetValue && s.lotCost > 0)
    .sort((a, b) => {
      const gapA = a.targetValue - a.currentValue;
      const gapB = b.targetValue - b.currentValue;
      return gapB - gapA;
    });

  for (const s of underweight) {
    if (remaining <= 0) break;
    if (s.lotCost > remaining) continue;

    const gap = s.targetValue - s.currentValue;
    if (gap <= 0) continue;

    const neededLots = Math.floor(gap / s.lotCost);
    const affordableLots = Math.floor(remaining / s.lotCost);
    const lots = Math.min(neededLots, affordableLots);
    if (lots <= 0) continue;

    const cost = lots * s.lotCost;
    remaining -= cost;
    s.currentValue += cost;

    raw.push({ ticker: s.ticker, side: 'buy', lots, cost });
  }

  // Проход 2: top-up по одному лоту.
  if (allowTopUp) {
    while (remaining > 0) {
      let best: WorkingState | null = null;
      let bestScore = 0;

      for (const s of state) {
        if (s.lotCost <= 0 || s.lotCost > remaining) continue;
        const gap = s.targetValue - s.currentValue;
        if (gap <= 0) continue;
        const score = gap / s.lotCost;
        if (score > bestScore) {
          bestScore = score;
          best = s;
        }
      }

      if (!best) break;

      remaining -= best.lotCost;
      best.currentValue += best.lotCost;
      raw.push({
        ticker: best.ticker,
        side: 'buy',
        lots: 1,
        cost: best.lotCost,
      });
    }
  }

  // Продажи.
  if (options.cash === 0) {
    const overweight = options.drifts
      .filter((d) => d.delta > sellThreshold)
      .sort((a, b) => b.delta - a.delta);

    for (const d of overweight) {
      const t = tickerMap.get(d.ticker);
      if (!t) continue;
      const lotCost = t.lotSize * t.price;
      if (lotCost <= 0) continue;
      const excessValue = d.currentValue - d.targetValue;
      if (excessValue < lotCost) continue;
      const lots = Math.floor(excessValue / lotCost);
      if (lots <= 0) continue;
      const cost = lots * lotCost;
      raw.push({ ticker: d.ticker, side: 'sell', lots, cost });
    }
  }

  // Агрегация: (ticker, side) → сумма.
  const map = new Map<string, RebalanceAction>();
  for (const a of raw) {
    const key = a.ticker + '|' + a.side;
    const prev = map.get(key);
    if (prev) {
      prev.lots += a.lots;
      prev.cost += a.cost;
    } else {
      map.set(key, { ...a });
    }
  }

  const actions = Array.from(map.values()).sort((a, b) => b.cost - a.cost);

  const buyValue = actions
    .filter((a) => a.side === 'buy')
    .reduce((s, a) => s + a.cost, 0);
  const sellValue = actions
    .filter((a) => a.side === 'sell')
    .reduce((s, a) => s + a.cost, 0);

  return { actions, cashLeft: remaining, buyValue, sellValue };
}
