// language: TypeScript, target: backtest simulation loop
// Симуляция портфеля, повторяющего IMOEX, с ежемесячной ребалансировкой.
//
// Это информационный инструмент. Не является инвестиционной рекомендацией.
// См. src/lib/legal/disclaimers.ts.

import type { Position, Ticker } from '@/types';
import { buildPortfolio } from '@/lib/universe/select';
import { computeDrift } from '@/lib/engine/drift';
import { rebalance } from '@/lib/engine/rebalance';
import {
  getTradingDays,
  monthStarts,
} from './calendar';
import { fetchUniverseOn } from './universe';
import { fetchPrices, fetchIndexPrices, priceOn } from './prices';
import type {
  BacktestParams,
  BacktestResult,
  MonthSnapshot,
} from './types';
import { computeMetrics } from './metrics';

interface Holding {
  ticker: string;
  lots: number;
}

function positionsValue(
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

function holdingsToPositions(holdings: Holding[]): Position[] {
  return holdings.map((h) => ({ ticker: h.ticker, lots: h.lots }));
}

/**
 * Главный цикл бэктеста. На каждой месячной точке:
 *   1. Получаем состав IMOEX на дату.
 *   2. Считаем текущую стоимость портфеля.
 *   3. Добавляем пополнение.
 *   4. Считаем целевые веса через buildPortfolio.
 *   5. Через rebalance получаем список операций.
 *   6. Выполняем операции с комиссией.
 *   7. Сохраняем снапшот.
 */
export async function runBacktest(
  params: BacktestParams,
): Promise<BacktestResult> {
  const calendar = await getTradingDays(params.startDate, params.endDate);
  const days = monthStarts(params.startDate, params.endDate, calendar);
  if (days.length === 0) {
    throw new Error('нет торговых дней в указанном периоде');
  }

  // Собираем состав на каждую месячную дату и объединяем тикеры.
  const universes = new Map<string, Ticker[]>();
  const allTickers = new Set<string>();
  for (const d of days) {
    const u = await fetchUniverseOn(d);
    universes.set(d, u);
    for (const t of u) allTickers.add(t.ticker);
  }

  // Все цены за период — один раз.
  const prices = await fetchPrices(
    Array.from(allTickers),
    params.startDate,
    params.endDate,
  );

  // Цены IMOEX — отдельный эндпоинт, кладём в ту же карту под ключом IMOEX.
  const imoexPrices = await fetchIndexPrices(
    params.startDate,
    params.endDate,
  );
  prices.set('IMOEX', imoexPrices);

  let holdings: Holding[] = [];
  let cash = params.initialCapital;
  let invested = params.initialCapital;

  // Бенчмарк: та же сумма в IMOEX, покупаем на первой дате.
  let benchmarkLots = 0;
  let benchmarkCash = params.initialCapital;
  const firstDate = days[0];
  const firstUniverse = universes.get(firstDate) ?? [];
  const firstPrice = priceOn(prices, 'IMOEX', firstDate);

  const snapshots: MonthSnapshot[] = [];

  for (let i = 0; i < days.length; i++) {
    const date = days[i];
    const universe = universes.get(date) ?? [];
    if (universe.length === 0) continue;

    // Пополнение (кроме первого месяца — там стартовый капитал).
    if (i > 0) {
      cash += params.monthlyTopUp;
      invested += params.monthlyTopUp;
      benchmarkCash += params.monthlyTopUp;
    }

    // Текущая стоимость.
    const posValue = positionsValue(holdings, universe, prices, date);
    const totalValue = posValue + cash;

    // Целевой портфель.
    const plan = buildPortfolio(universe, { portfolioValue: totalValue });

    // Drift текущих позиций vs целевых.
    const drift = computeDrift({
      positions: holdingsToPositions(holdings),
      universe,
      targetWeights: plan.holdings,
      cash,
    });

    // Ребалансировка.
    const rb = rebalance({
      drifts: drift.drifts,
      universe,
      cash,
    });

    // Выполняем операции с учётом комиссии.
    const lotByTicker = new Map(universe.map((t) => [t.ticker, t.lotSize]));
    for (const action of rb.actions) {
      const price = priceOn(prices, action.ticker, date);
      if (price == null) continue;
      const lotSize = lotByTicker.get(action.ticker) ?? 1;
      const lotCost = lotSize * price;

      if (action.side === 'buy') {
        const gross = action.lots * lotCost;
        const commission = gross * params.commissionRate;
        if (gross + commission > cash) continue;
        cash -= gross + commission;
        const existing = holdings.find((h) => h.ticker === action.ticker);
        if (existing) existing.lots += action.lots;
        else holdings.push({ ticker: action.ticker, lots: action.lots });
      } else {
        const gross = action.lots * lotCost;
        const commission = gross * params.commissionRate;
        const existing = holdings.find((h) => h.ticker === action.ticker);
        if (!existing) continue;
        const lots = Math.min(action.lots, existing.lots);
        existing.lots -= lots;
        cash += gross - commission;
        if (existing.lots <= 0) {
          holdings = holdings.filter((h) => h.ticker !== action.ticker);
        }
      }
    }

    // Убираем нулевые позиции.
    holdings = holdings.filter((h) => h.lots > 0);

    // Бенчмарк: покупаем IMOEX по цене на дату.
    const imoexPrice =
      priceOn(prices, 'IMOEX', date) ?? firstPrice ?? null;
    if (imoexPrice && imoexPrice > 0 && benchmarkCash > 0) {
      const lots = Math.floor(benchmarkCash / imoexPrice);
      benchmarkLots += lots;
      benchmarkCash -= lots * imoexPrice;
    }

    const newPosValue = positionsValue(holdings, universe, prices, date);
    const newTotal = newPosValue + cash;
    const benchmarkValue =
      benchmarkLots * (imoexPrice ?? 0) + benchmarkCash;

    snapshots.push({
      date,
      positionsValue: newPosValue,
      cash,
      totalValue: newTotal,
      invested,
      benchmarkValue,
      positionsCount: holdings.length,
      omissionWeight: plan.omissionWeight,
    });
  }

  const metrics = computeMetrics(snapshots, params);

  return { params, snapshots, metrics };
}
