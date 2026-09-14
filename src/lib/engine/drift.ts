// language: TypeScript, target: portfolio drift
// Отклонение текущего портфеля от целевых весов.
//
// Это информационный инструмент. Не является инвестиционной рекомендацией.
// См. src/lib/legal/disclaimers.ts.

import type { Position, Ticker, TargetWeight } from '@/types';

export interface Drift {
  ticker: string;
  /** Текущий вес в портфеле, 0..1. */
  currentWeight: number;
  /** Целевой вес, 0..1. */
  targetWeight: number;
  /** currentWeight − targetWeight. Отрицательное = недобор. */
  delta: number;
  /** Текущая стоимость позиции, руб. */
  currentValue: number;
  /** Целевая стоимость позиции, руб. */
  targetValue: number;
}

export interface DriftResult {
  drifts: Drift[];
  /** Суммарная стоимость портфеля, руб. */
  totalValue: number;
  /** Максимальное |delta|, 0..1. */
  maxDrift: number;
  /** Сумма |delta| / 2 — сколько нужно торговать для полной ребалансировки, 0..1. */
  turnover: number;
}

export interface ComputeDriftOptions {
  positions: Position[];
  universe: Ticker[];
  targetWeights: TargetWeight[];
  /** Свободный кэш сверх позиций, руб. По умолчанию 0. */
  cash?: number;
}

/**
 * Считает отклонение текущего портфеля от целевых весов.
 *
 * Включает в портфель бумаги из target, даже если их нет в позициях —
 * покажет дефицит по ним.
 * Бумаги в позициях, но не в target, учитываются как «перевес на 100%»:
 * их текущий вес есть, целевой — 0.
 */
export function computeDrift(options: ComputeDriftOptions): DriftResult {
  const { positions, universe, targetWeights } = options;
  const cash = options.cash ?? 0;

  const tickerMap = new Map(universe.map((t) => [t.ticker, t]));
  const targetMap = new Map(targetWeights.map((w) => [w.ticker, w.weight]));

  // 1. Текущая стоимость позиций.
  const currentValues = new Map<string, number>();
  for (const p of positions) {
    const t = tickerMap.get(p.ticker);
    if (!t) continue;
    const value = p.lots * t.lotSize * t.price;
    currentValues.set(p.ticker, value);
  }

  const positionsValue = Array.from(currentValues.values()).reduce(
    (s, v) => s + v,
    0,
  );
  const totalValue = positionsValue + cash;

  if (totalValue <= 0) {
    return { drifts: [], totalValue: 0, maxDrift: 0, turnover: 0 };
  }

  // 2. Объединение тикеров: позиции ∪ target.
  const allTickers = new Set<string>([
    ...currentValues.keys(),
    ...targetWeights.map((w) => w.ticker),
  ]);

  const drifts: Drift[] = [];
  for (const ticker of allTickers) {
    const currentValue = currentValues.get(ticker) ?? 0;
    const targetWeight = targetMap.get(ticker) ?? 0;
    const currentWeight = currentValue / totalValue;
    const targetValue = targetWeight * totalValue;
    const delta = currentWeight - targetWeight;

    drifts.push({
      ticker,
      currentWeight,
      targetWeight,
      delta,
      currentValue,
      targetValue,
    });
  }

  const maxDrift = drifts.reduce((m, d) => Math.max(m, Math.abs(d.delta)), 0);
  const turnover = drifts.reduce((s, d) => s + Math.abs(d.delta), 0) / 2;

  return { drifts, totalValue, maxDrift, turnover };
}
