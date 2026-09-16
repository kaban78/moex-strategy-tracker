// language: TypeScript, target: backtest simulation loop
//
// Симуляция портфеля, повторяющего IMOEX, с ежемесячной ребалансировкой.
// Дивиденды начисляются как прирост MCFTR над IMOEX за месяц:
// это даёт прокси дивидендной доходности индекса без необходимости
// тянуть дивиденды каждой бумаги.

import type { Position, Ticker } from '@/types';
import { buildPortfolio } from '@/lib/universe/select';
import { computeDrift } from '@/lib/engine/drift';
import { rebalance } from '@/lib/engine/rebalance';
import { getTradingDays, monthStarts } from './calendar';
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
 * Цена на дату из плоского ряда { date → price }.
 */
function priceOnSeries(
  series: Map<string, number>,
  date: string,
): number | null {
  if (series.size === 0) return null;
  if (series.has(date)) return series.get(date) ?? null;

  const dates = Array.from(series.keys()).sort();
  if (date < dates[0]) return null;

  let lo = 0;
  let hi = dates.length - 1;
  let best: string | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= date) {
      best = dates[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best ? (series.get(best) ?? null) : null;
}

export async function runBacktest(
  params: BacktestParams,
): Promise<BacktestResult> {
  const calendar = await getTradingDays(params.startDate, params.endDate);
  const days = monthStarts(params.startDate, params.endDate, calendar);
  if (days.length === 0) {
    throw new Error('нет торговых дней в указанном периоде');
  }

  const universes = new Map<string, Ticker[]>();
  const allTickers = new Set<string>();
  for (const d of days) {
    const u = await fetchUniverseOn(d);
    universes.set(d, u);
    for (const t of u) allTickers.add(t.ticker);
  }

  const prices = await fetchPrices(
    Array.from(allTickers),
    params.startDate,
    params.endDate,
  );

  const imoexPrices = await fetchIndexPrices(
    'IMOEX',
    params.startDate,
    params.endDate,
  );
  const mcftrPrices = await fetchIndexPrices(
    'MCFTR',
    params.startDate,
    params.endDate,
  );

  let holdings: Holding[] = [];
  let cash = params.initialCapital;
  let invested = params.initialCapital;

  let imoexLots = 0;
  let imoexCash = params.initialCapital;

  let mcftrLots = 0;
  let mcftrCash = params.initialCapital;

  const snapshots: MonthSnapshot[] = [];

  for (let i = 0; i < days.length; i++) {
    const date = days[i];
    const universe = universes.get(date) ?? [];
    if (universe.length === 0) continue;

    if (i > 0) {
      cash += params.monthlyTopUp;
      invested += params.monthlyTopUp;
      imoexCash += params.monthlyTopUp;
      mcftrCash += params.monthlyTopUp;
    }

    const posValue = positionsValue(holdings, universe, prices, date);
    const totalValue = posValue + cash;

    const plan = buildPortfolio(universe, { portfolioValue: totalValue });

    const drift = computeDrift({
      positions: holdingsToPositions(holdings),
      universe,
      targetWeights: plan.holdings,
      cash,
    });

    const rb = rebalance({ drifts: drift.drifts, universe, cash });

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

    holdings = holdings.filter((h) => h.lots > 0);

    // Начисляем дивиденды на позиции портфеля.
    // Прокси: разница доходностей MCFTR и IMOEX за месяц = дивидендная
    // доходность индекса за тот же месяц.
    if (i > 0) {
      const prevDate = days[i - 1];
      const mcftrNow = priceOnSeries(mcftrPrices, date);
      const mcftrPrev = priceOnSeries(mcftrPrices, prevDate);
      const imoexNow = priceOnSeries(imoexPrices, date);
      const imoexPrev = priceOnSeries(imoexPrices, prevDate);

      if (
        mcftrNow && mcftrPrev && imoexNow && imoexPrev &&
        mcftrPrev > 0 && imoexPrev > 0
      ) {
        const mcftrRet = mcftrNow / mcftrPrev - 1;
        const imoexRet = imoexNow / imoexPrev - 1;
        const impliedYield = mcftrRet - imoexRet;
        if (impliedYield > 0) {
          const currentPosValue = positionsValue(
            holdings,
            universe,
            prices,
            date,
          );
          cash += currentPosValue * impliedYield;
        }
      }
    }

    const imoexPrice = priceOnSeries(imoexPrices, date);
    if (imoexPrice && imoexPrice > 0 && imoexCash > 0) {
      const lots = Math.floor(imoexCash / imoexPrice);
      imoexLots += lots;
      imoexCash -= lots * imoexPrice;
    }

    const mcftrPrice = priceOnSeries(mcftrPrices, date);
    if (mcftrPrice && mcftrPrice > 0 && mcftrCash > 0) {
      const lots = Math.floor(mcftrCash / mcftrPrice);
      mcftrLots += lots;
      mcftrCash -= lots * mcftrPrice;
    }

    const newPosValue = positionsValue(holdings, universe, prices, date);
    const newTotal = newPosValue + cash;
    const imoexValue = imoexLots * (imoexPrice ?? 0) + imoexCash;
    const mcftrValue = mcftrLots * (mcftrPrice ?? 0) + mcftrCash;

    snapshots.push({
      date,
      positionsValue: newPosValue,
      cash,
      totalValue: newTotal,
      invested,
      benchmarkValue: imoexValue,
      benchmarkTotalReturnValue: mcftrValue,
      positionsCount: holdings.length,
      omissionWeight: plan.omissionWeight,
    });
  }

  const metrics = computeMetrics(snapshots, params);
  return { params, snapshots, metrics };
}
