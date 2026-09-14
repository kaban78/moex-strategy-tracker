// language: TypeScript, target: weight → lots conversion
// Превращает целевые веса в целые лоты при заданном капитале.
// Округление вниз — консервативно, не превышаем целевой вес.
// Остаток кэша — cash drag, учитывается при ребалансировке.
//
// Это информационный инструмент. Не является инвестиционной рекомендацией.
// См. src/lib/legal/disclaimers.ts.

import type { Ticker, TargetWeight } from '@/types';

export interface AllocateOptions {
  /** Стоимость портфеля, руб. */
  portfolioValue: number;
  /** Свободный кэш сверх портфеля, руб. По умолчанию 0. */
  cash?: number;
}

export interface Allocation {
  ticker: string;
  /** Целевой вес, 0..1. */
  targetWeight: number;
  /** Цена одного лота, руб. */
  lotCost: number;
  /** Целевое число лотов до округления. */
  targetLots: number;
  /** Фактическое число лотов (округлено вниз). */
  lots: number;
  /** Стоимость позиции в лотах, руб. */
  value: number;
  /** Фактический вес после округления, 0..1. */
  actualWeight: number;
  /** Отклонение фактического веса от целевого: actual − target. */
  roundingDrift: number;
}

export interface AllocationResult {
  allocations: Allocation[];
  /** Сумма вложенного в лоты, руб. */
  invested: number;
  /** Остаток кэша после покупки всех лотов, руб. */
  cashLeft: number;
  /** Суммарный rounding drift по модулю, 0..1. */
  totalRoundingDrift: number;
}

/**
 * Раскладывает целевые веса по целым лотам.
 *
 * Для каждой бумаги:
 *   target_value = portfolioValue * weight
 *   target_lots  = target_value / lotCost
 *   lots         = floor(target_lots)
 *
 * Округление вниз. Остаток остаётся в кэше — cash drag.
 * При ребалансировке остаток распределяется по самому недобранному лоту.
 */
export function allocateLots(
  holdings: TargetWeight[],
  universe: Ticker[],
  options: AllocateOptions,
): AllocationResult {
  const cash = options.cash ?? 0;
  const total = options.portfolioValue + cash;

  const byTicker = new Map(universe.map((t) => [t.ticker, t]));
  const allocations: Allocation[] = [];

  for (const h of holdings) {
    const t = byTicker.get(h.ticker);
    if (!t) continue;

    const lotCost = t.lotSize * t.price;
    if (lotCost <= 0) continue;

    const targetValue = total * h.weight;
    const targetLots = targetValue / lotCost;
    const lots = Math.floor(targetLots);
    const value = lots * lotCost;
    const actualWeight = value / total;

    allocations.push({
      ticker: h.ticker,
      targetWeight: h.weight,
      lotCost,
      targetLots,
      lots,
      value,
      actualWeight,
      roundingDrift: actualWeight - h.weight,
    });
  }

  const invested = allocations.reduce((s, a) => s + a.value, 0);
  const cashLeft = total - invested;
  const totalRoundingDrift = allocations.reduce(
    (s, a) => s + Math.abs(a.roundingDrift),
    0,
  );

  return {
    allocations,
    invested,
    cashLeft,
    totalRoundingDrift,
  };
}
