// language: TypeScript, target: IMOEX index replication via optimized sampling
// Репликация IMOEX cap-weight. Задача: минимизировать tracking error
// при ограничении целых лотов.
//
// Это информационный инструмент. Не является инвестиционной рекомендацией.
// См. src/lib/legal/disclaimers.ts.

import type { Ticker, TargetWeight } from '@/types';

export interface BuildPortfolioOptions {
  /** Стоимость портфеля, руб. */
  portfolioValue: number;
  /**
   * Относительный порог лотности. Бумага проходит, если её лот
   * не превышает lotToTargetRatio × целевую стоимость позиции.
   * По умолчанию 2.5 — лот может быть до 2.5× больше целевой.
   */
  lotToTargetRatio?: number;
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
  holdings: TargetWeight[];
  omitted: OmittedTicker[];
  omissionWeight: number;
  estimatedTrackingError: number;
}

const DEFAULTS = {
  lotToTargetRatio: 2.5,
  coverageThreshold: 0.99,
  maxHoldings: 30,
} as const;

/**
 * Собирает портфель, повторяющий IMOEX, с учётом ограничения целых лотов.
 *
 * Фильтр лотности — относительный:
 *   lotCost <= portfolioValue × (indexWeight / totalWeight) × lotToTargetRatio
 *
 * Это гарантирует, что крупные бумаги (LKOH 18%) не отсекаются,
 * а мелкие с дорогими лотами (PHOR 0.62%, лот 5543 руб.) — отсеиваются.
 *
 * Корреляционный фильтр не применяется — для репликации индекса держим
 * всё, что в индексе.
 */
export function buildPortfolio(
  universe: Ticker[],
  options: BuildPortfolioOptions,
): BuildPortfolioResult {
  const lotToTargetRatio =
    options.lotToTargetRatio ?? DEFAULTS.lotToTargetRatio;
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

  const sorted = [...universe].sort((a, b) => b.indexWeight - a.indexWeight);
  const totalWeight = sorted.reduce((s, t) => s + t.indexWeight, 0);

  const omitted: OmittedTicker[] = [];

  // Lot-feasibility с относительным порогом.
  const feasible = sorted.filter((t) => {
    const normalizedWeight = t.indexWeight / totalWeight;
    const targetValue = options.portfolioValue * normalizedWeight;
    const lotCost = t.lotSize * t.price;
    if (lotCost > targetValue * lotToTargetRatio) {
      omitted.push({
        ticker: t.ticker,
        weight: t.indexWeight,
        reason: 'lot_too_expensive',
      });
      return false;
    }
    return true;
  });

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

  const heldWeight = holdings.reduce((s, t) => s + t.indexWeight, 0);
  const targetWeights: TargetWeight[] =
    heldWeight > 0
      ? holdings.map((t) => ({
          ticker: t.ticker,
          weight: t.indexWeight / heldWeight,
        }))
      : [];

  const omissionWeight =
    totalWeight > 0
      ? omitted.reduce((s, o) => s + o.weight, 0) / totalWeight
      : 0;

  const estimatedTrackingError = estimateTrackingError(omitted, totalWeight);

  return {
    holdings: targetWeights,
    omitted,
    omissionWeight,
    estimatedTrackingError,
  };
}

/**
 * Оценка tracking error от пропущенных бумаг.
 *
 * TE ~ sigma_idio × sqrt(sum w_i^2)
 *
 * где w_i — нормализованный вес пропущенной бумаги (0..1).
 * Пропущенные веса распределены по N бумагам и частично гасят
 * друг друга (диверсификация остатка).
 *
 * Линейная формула omission × sigma завышает TE в sqrt(N) раз.
 *
 * idio_vol = 0.30 — средняя идиосинкратическая волатильность на MOEX.
 * roundingError = 0.005 — ошибка от лотного округления.
 */
function estimateTrackingError(
  omitted: OmittedTicker[],
  totalWeight: number,
): number {
  if (totalWeight <= 0 || omitted.length === 0) {
    return 0.005;
  }
  const idioVol = 0.3;
  const sumSquares = omitted.reduce(
    (s, o) => s + (o.weight / totalWeight) ** 2,
    0,
  );
  const fromOmission = Math.sqrt(sumSquares) * idioVol;
  const roundingError = 0.005;
  return Math.sqrt(fromOmission ** 2 + roundingError ** 2);
}

export interface OptimalNOptions {
  portfolioValue: number;
  minPositionValue?: number;
  maxHoldings?: number;
}

export function optimalN(options: OptimalNOptions): number {
  const minPositionValue = options.minPositionValue ?? 5_000;
  const maxHoldings = options.maxHoldings ?? 30;
  const byLot = Math.floor(options.portfolioValue / minPositionValue);
  return Math.max(5, Math.min(byLot, maxHoldings));
}
