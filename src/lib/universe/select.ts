// language: TypeScript, target: IMOEX index replication via optimized sampling
// Репликация IMOEX cap-weight. Задача: минимизировать tracking error
// при ограничении целых лотов. Обоснование см. README → "Репликация IMOEX".
//
// Это информационный инструмент. Не является инвестиционной рекомендацией.
// См. src/lib/legal/disclaimers.ts.

import type { Ticker, TargetWeight } from '@/types';

export interface BuildPortfolioOptions {
  /** Стоимость портфеля, руб. */
  portfolioValue: number;
  /** Максимальная доля одного лота в портфеле, 0..1. По умолчанию 0.05. */
  maxLotFraction?: number;
  /** Порог покрытия индекса по весу, 0..1. По умолчанию 0.99. */
  coverageThreshold?: number;
  /** Жёсткий потолок числа бумаг. По умолчанию 30. */
  maxHoldings?: number;
}

export type OmitReason =
  | 'lot_too_expensive'
  | 'below_coverage_cutoff'
  | 'above_max_holdings';

export interface OmittedTicker {
  ticker: string;
  weight: number;
  reason: OmitReason;
}

export interface BuildPortfolioResult {
  /** Бумаги, которые держим, с перенормированными весами. Сумма = 1. */
  holdings: TargetWeight[];
  /** Бумаги, которые пропустили. */
  omitted: OmittedTicker[];
  /** Суммарный вес пропущенных бумаг, 0..1. */
  omissionWeight: number;
  /** Прогноз tracking error, годовых, 0..1. */
  estimatedTrackingError: number;
}

const DEFAULTS = {
  maxLotFraction: 0.05,
  coverageThreshold: 0.99,
  maxHoldings: 30,
} as const;

/**
 * Собирает портфель, повторяющий IMOEX, с учётом ограничения целых лотов.
 *
 * Алгоритм:
 *   1. Сортировка бумаг по весу в индексе (убывание).
 *   2. Lot-feasibility: отбрасываем бумаги, чей лот дороже maxLotFraction портфеля.
 *   3. Greedy: набираем бумаги сверху вниз до покрытия coverageThreshold
 *      или до maxHoldings.
 *   4. Перенормировка весов на удержанные бумаги.
 *   5. Omission weight и оценка tracking error.
 *
 * Корреляционный фильтр не применяется — для репликации индекса держим
 * всё, что в индексе. См. README → "Корреляции".
 */
export function buildPortfolio(
  universe: Ticker[],
  options: BuildPortfolioOptions,
): BuildPortfolioResult {
  const maxLotFraction = options.maxLotFraction ?? DEFAULTS.maxLotFraction;
  const coverageThreshold =
    options.coverageThreshold ?? DEFAULTS.coverageThreshold;
  const maxHoldings = options.maxHoldings ?? DEFAULTS.maxHoldings;

  if (universe.length === 0) {
    return {
      holdings: [],
      omitted: [],
      omissionWeight: 0,
      estimatedTrackingError: 0,
    };
  }

  // 1. Сортировка по весу в индексе — убывание.
  const sorted = [...universe].sort((a, b) => b.indexWeight - a.indexWeight);

  const totalWeight = sorted.reduce((s, t) => s + t.indexWeight, 0);

  // 2. Lot-feasibility.
  const maxLotCost = options.portfolioValue * maxLotFraction;
  const omitted: OmittedTicker[] = [];

  const feasible = sorted.filter((t) => {
    if (t.lotSize * t.price > maxLotCost) {
      omitted.push({
        ticker: t.ticker,
        weight: t.indexWeight,
        reason: 'lot_too_expensive',
      });
      return false;
    }
    return true;
  });

  // 3. Greedy: набираем сверху вниз до покрытия.
  const targetCoverage = totalWeight * coverageThreshold;
  const holdings: Ticker[] = [];
  let covered = 0;

  for (const t of feasible) {
    if (covered >= targetCoverage) {
      omitted.push({
        ticker: t.ticker,
        weight: t.indexWeight,
        reason: 'below_coverage_cutoff',
      });
      continue;
    }
    if (holdings.length >= maxHoldings) {
      omitted.push({
        ticker: t.ticker,
        weight: t.indexWeight,
        reason: 'above_max_holdings',
      });
      continue;
    }
    holdings.push(t);
    covered += t.indexWeight;
  }

  // 4. Перенормировка весов на удержанные бумаги.
  const heldWeight = holdings.reduce((s, t) => s + t.indexWeight, 0);
  const targetWeights: TargetWeight[] =
    heldWeight > 0
      ? holdings.map((t) => ({
          ticker: t.ticker,
          weight: t.indexWeight / heldWeight,
        }))
      : [];

  // 5. Omission weight и оценка TE.
  const omissionWeight =
    totalWeight > 0
      ? omitted.reduce((s, o) => s + o.weight, 0) / totalWeight
      : 0;
  const estimatedTrackingError = estimateTrackingError(omissionWeight);

  return {
    holdings: targetWeights,
    omitted,
    omissionWeight,
    estimatedTrackingError,
  };
}

/**
 * Грубая оценка tracking error по omission weight.
 *
 * Модель: TE ≈ sqrt(omission_weight² * idio_vol² + rounding²)
 *
 * idio_vol = 0.30 — средняя идиосинкратическая волатильность на MOEX,
 * годовых. Остаток 0.5% — ошибка от лотного округления.
 *
 * Это эвристика, не точная формула. Точная оценка — через бэктест.
 */
function estimateTrackingError(omissionWeight: number): number {
  const idioVol = 0.3;
  const roundingError = 0.005;
  const fromOmission = omissionWeight * idioVol;
  return Math.sqrt(fromOmission ** 2 + roundingError ** 2);
}

/**
 * Динамический выбор целевого N.
 *
 * Для репликации индекса N — не «оптимальное число для диверсификации».
 * Это минимальное число бумаг, при котором покрывается 99% веса индекса
 * и которое физически покупаемо при данном капитале.
 *
 * Возвращает верхнюю границу. Реальное N определяется buildPortfolio
 * по лотам и покрытию.
 */
export interface OptimalNOptions {
  portfolioValue: number;
  /** Минимальный размер осмысленной позиции, руб. По умолчанию 5000. */
  minPositionValue?: number;
  /** Жёсткий потолок. По умолчанию 30. */
  maxHoldings?: number;
}

export function optimalN(options: OptimalNOptions): number {
  const minPositionValue = options.minPositionValue ?? 5_000;
  const maxHoldings = options.maxHoldings ?? 30;
  const byLot = Math.floor(options.portfolioValue / minPositionValue);
  return Math.max(5, Math.min(byLot, maxHoldings));
}
