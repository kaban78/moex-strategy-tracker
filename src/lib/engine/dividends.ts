// language: TypeScript, target: dividend projection on portfolio
// Проекция дивидендов на портфель: позиция × дивиденд на акцию.
//
// Это информационный инструмент. Не является инвестиционной рекомендацией.
// См. src/lib/legal/disclaimers.ts.

import type { Position, Ticker } from '@/types';
import type { TinkoffDividend } from '@/lib/tinkoff/types';
import { moneyToNumber } from '@/lib/tinkoff/parse';

/** Строка дивидендной таблицы — на одну позицию и одну выплату. */
export interface DividendRow {
  ticker: string;
  /** Дата отсечки (ISO). */
  recordDate: string;
  /** Дата выплаты (ISO). */
  paymentDate: string;
  /** Размер на одну акцию, руб. */
  perShare: number;
  /** Размер на один лот, руб. */
  perLot: number;
  /** Сколько лотов в позиции. */
  lots: number;
  /** Сумма на позицию, руб. */
  total: number;
  /** Регулярность: Annual / Quarter / Semiannual / Month. */
  regularity: string;
}

export interface DividendSummary {
  rows: DividendRow[];
  /** Сумма всех выплат за период, руб. */
  totalAmount: number;
  /** Только последние 12 месяцев, руб. */
  last12MonthsAmount: number;
  /** Дивидендная доходность портфеля за 12 мес, 0..1. */
  yieldLast12Months: number;
  /** Сколько бумаг в портфеле платят дивиденды. */
  payingTickers: number;
  /** Сколько бумаг в портфеле вообще. */
  totalTickers: number;
}

interface ComputeOptions {
  positions: Position[];
  universe: Ticker[];
  /** ticker → массив дивидендов. */
  dividendsByTicker: Map<string, TinkoffDividend[]>;
  /** Стоимость портфеля для расчёта доходности. */
  portfolioValue: number;
}

/**
 * Строит дивидендную таблицу по портфелю.
 *
 * Для каждой позиции:
 *   perShare = dividendNet (руб.)
 *   perLot   = perShare × lotSize
 *   total    = perLot × lots
 *
 * Сортировка строк — по дате отсечки, убывание.
 * last12MonthsAmount — сумма за 365 дней от сегодня.
 */
export function computeDividends(options: ComputeOptions): DividendSummary {
  const { positions, universe, dividendsByTicker, portfolioValue } = options;

  const lotSizeByTicker = new Map(
    universe.map((t) => [t.ticker, t.lotSize]),
  );

  const rows: DividendRow[] = [];
  const oneYearAgo = Date.now() - 365 * 24 * 3600 * 1000;
  let last12MonthsAmount = 0;
  let payingTickers = 0;

  for (const p of positions) {
    const divs = dividendsByTicker.get(p.ticker);
    if (!divs || divs.length === 0) continue;
    payingTickers++;

    const lotSize = lotSizeByTicker.get(p.ticker) ?? 1;

    for (const d of divs) {
      const perShare = moneyToNumber(d.dividendNet);
      if (perShare <= 0) continue;

      const perLot = perShare * lotSize;
      const total = perLot * p.lots;

      rows.push({
        ticker: p.ticker,
        recordDate: d.recordDate,
        paymentDate: d.paymentDate,
        perShare,
        perLot,
        lots: p.lots,
        total,
        regularity: d.regularity,
      });

      const ts = new Date(d.recordDate).getTime();
      if (Number.isFinite(ts) && ts >= oneYearAgo) {
        last12MonthsAmount += total;
      }
    }
  }

  rows.sort(
    (a, b) =>
      new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime(),
  );

  const totalAmount = rows.reduce((s, r) => s + r.total, 0);
  const yieldLast12Months =
    portfolioValue > 0 ? last12MonthsAmount / portfolioValue : 0;

  return {
    rows,
    totalAmount,
    last12MonthsAmount,
    yieldLast12Months,
    payingTickers,
    totalTickers: positions.length,
  };
}
