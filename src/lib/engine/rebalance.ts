// language: TypeScript, target: rebalance via top-ups
// Распределение свободного кэша по недобранным позициям.
//
// Ключевой принцип: пока есть кэш — только покупки, без продаж.
// Это даёт ноль комиссий за продажу и ноль НДФЛ на реализованную прибыль.
// Продажи — только когда кэша нет вообще.
//
// Это информационный инструмент. Не является инвестиционной рекомендацией.
// См. src/lib/legal/disclaimers.ts.

import type { Ticker } from '@/types';
import type { Drift } from './drift';

export interface RebalanceOptions {
  drifts: Drift[];
  universe: Ticker[];
  /** Свободный кэш для распределения, руб. */
  cash: number;
  /** Порог для продажи переобранных позиций, 0..1. По умолчанию 0.05. */
  sellThreshold?: number;
}

export interface RebalanceAction {
  ticker: string;
  side: 'buy' | 'sell';
  lots: number;
  /** Стоимость операции, руб. */
  cost: number;
}

export interface RebalanceResult {
  /** Рекомендуемые операции: сначала покупки, потом продажи. */
  actions: RebalanceAction[];
  /** Кэш, оставшийся нераспределённым, руб. */
  cashLeft: number;
  /** Суммарная стоимость покупок, руб. */
  buyValue: number;
  /** Суммарная стоимость продаж, руб. */
  sellValue: number;
}

const DEFAULT_SELL_THRESHOLD = 0.05;

/**
 * Распределяет свободный кэш по недобранным позициям.
 *
 * Фаза 1 — покупки. Сортировка drifts по delta (возрастание):
 *   самые недобранные сверху. Greedy: покупаем столько лотов,
 *   сколько влезает в кэш и не превышает целевой вес.
 *
 * Фаза 2 — продажи. Только если исходный кэш был равен нулю.
 *   Пока есть кэш — ребалансируем только покупками (налоговая
 *   оптимизация). Продажи фиксируют прибыль → НДФЛ. Не делаем
 *   этого, пока можно обойтись пополнением.
 */
export function rebalance(options: RebalanceOptions): RebalanceResult {
  const sellThreshold = options.sellThreshold ?? DEFAULT_SELL_THRESHOLD;
  const tickerMap = new Map(options.universe.map((t) => [t.ticker, t]));
  const actions: RebalanceAction[] = [];

  let remaining = options.cash;

  // Фаза 1 — покупки.
  const underweight = [...options.drifts]
    .filter((d) => d.delta < 0)
    .sort((a, b) => a.delta - b.delta);

  for (const d of underweight) {
    if (remaining <= 0) break;
    const t = tickerMap.get(d.ticker);
    if (!t) continue;

    const lotCost = t.lotSize * t.price;
    if (lotCost <= 0 || lotCost > remaining) continue;

    const neededValue = d.targetValue - d.currentValue;
    if (neededValue <= 0) continue;

    const neededLots = Math.floor(neededValue / lotCost);
    const affordableLots = Math.floor(remaining / lotCost);
    const lots = Math.min(neededLots, affordableLots);
    if (lots <= 0) continue;

    const cost = lots * lotCost;
    remaining -= cost;

    actions.push({
      ticker: d.ticker,
      side: 'buy',
      lots,
      cost,
    });
  }

  // Фаза 2 — продажи. Только если кэша не было изначально.
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

      actions.push({
        ticker: d.ticker,
        side: 'sell',
        lots,
        cost,
      });
    }
  }

  const buyValue = actions
    .filter((a) => a.side === 'buy')
    .reduce((s, a) => s + a.cost, 0);
  const sellValue = actions
    .filter((a) => a.side === 'sell')
    .reduce((s, a) => s + a.cost, 0);

  return { actions, cashLeft: remaining, buyValue, sellValue };
}
