// language: TypeScript, target: backtest simulation loop
//
// Симуляция репликации IMOEX:
//   - Ребалансировка раз в месяц (композиция IMOEX на первое число).
//   - Снапшот стоимости — каждый торговый день.
//   - Дивиденды — прокси через разницу доходностей MCFTR и IMOEX за день.

import type { Ticker } from '@/types';
import { buildPortfolio } from '@/lib/universe/select';
import { computeDrift } from '@/lib/engine/drift';
import { rebalance } from '@/lib/engine/rebalance';
import { fetchKeyRate, rateOn } from '@/lib/cbr/client';
import { getTradingDays, monthStarts } from './calendar';
import { fetchUniverseOn } from './universe';
import { fetchPrices, fetchIndexPrices, priceOn, priceOnSeries } from './prices';
import type {
  BacktestParams,
  BacktestResult,
  MonthSnapshot,
} from './types';
import { computeMetrics } from './metrics';
import {
  positionsValue,
  holdingsToPositions,
  diffDays,
  type Holding,
} from './simulate-utils';
import { dailyDividendYield } from './simulate-dividends';

const DEBUG = process.env.NODE_ENV !== 'production';
function log(...args: unknown[]): void {
  if (DEBUG) console.log(...args);
}

export async function runBacktest(
  params: BacktestParams,
): Promise<BacktestResult> {
  const calendar = await getTradingDays(params.startDate, params.endDate);
  if (calendar.length < 2) {
    throw new Error('нет торговых дней в указанном периоде');
  }

  const monthStartDates = monthStarts(
    params.startDate,
    params.endDate,
    calendar,
  );
  if (monthStartDates.length === 0) {
    throw new Error('не удалось построить месячные границы');
  }

  // Композиции индекса на первое число месяца.
  // Если ISS не отдал — берём предыдущую доступную.
  const universes = new Map<string, Ticker[]>();
  const allTickers = new Set<string>();
  let lastGood: Ticker[] = [];

  for (const d of monthStartDates) {
    let u = await fetchUniverseOn(d);
    if (u.length === 0 && lastGood.length > 0) {
      u = lastGood;
    }
    universes.set(d, u);
    if (u.length > 0) lastGood = u;
    for (const t of u) allTickers.add(t.ticker);
  }

  if (allTickers.size === 0) {
    throw new Error('не удалось получить состав IMOEX ни на одну дату');
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

  // Ключевая ставка ЦБ для симуляции вклада.
  let keyRate: Awaited<ReturnType<typeof fetchKeyRate>> = [];
  try {
    keyRate = await fetchKeyRate(params.startDate, params.endDate);
    log('[backtest] key rate points:', keyRate.length);
  } catch (e) {
    log('[backtest] key rate fetch failed:', e);
  }

  // Состояние портфеля.
  let holdings: Holding[] = [];
  let cash = params.initialCapital;
  let invested = params.initialCapital;
  let currentOmission = 0;

  // Бенчмарки: IMOEX (без дивидендов) и MCFTR (с дивидендами).
  let imoexLots = 0;
  let imoexCash = params.initialCapital;
  let mcftrLots = 0;
  let mcftrCash = params.initialCapital;

  // Вклад под ключевую ставку ЦБ.
  let depositValue = params.initialCapital;

  const monthStartSet = new Set(monthStartDates);
  let currentUniverse: Ticker[] = universes.get(monthStartDates[0]) ?? [];
  const lotByTicker = new Map(
    currentUniverse.map((t) => [t.ticker, t.lotSize]),
  );

  let benchmarkInitialized = false;
  const snapshots: MonthSnapshot[] = [];
  let prevDate: string | null = null;

  for (const date of calendar) {
    if (date < params.startDate || date > params.endDate) continue;

    // Смена месяца — ребалансировка.
    if (monthStartSet.has(date)) {
      const u = universes.get(date) ?? [];
      if (u.length > 0) {
        currentUniverse = u;
        lotByTicker.clear();
        for (const t of u) lotByTicker.set(t.ticker, t.lotSize);

        // Пополнение в начале месяца (кроме первого дня).
        if (prevDate !== null) {
          cash += params.monthlyTopUp;
          invested += params.monthlyTopUp;
          imoexCash += params.monthlyTopUp;
          mcftrCash += params.monthlyTopUp;
        }

        const totalValue =
          positionsValue(holdings, currentUniverse, prices, date) + cash;

        const plan = buildPortfolio(currentUniverse, {
          portfolioValue: totalValue,
        });
        currentOmission = plan.omissionWeight;

        const drift = computeDrift({
          positions: holdingsToPositions(holdings),
          universe: currentUniverse,
          targetWeights: plan.holdings,
          cash,
        });

        const rb = rebalance({
          drifts: drift.drifts,
          universe: currentUniverse,
          cash,
        });

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
            const existing = holdings.find(
              (h) => h.ticker === action.ticker,
            );
            if (existing) existing.lots += action.lots;
            else holdings.push({ ticker: action.ticker, lots: action.lots });
          } else {
            const gross = action.lots * lotCost;
            const commission = gross * params.commissionRate;
            const existing = holdings.find(
              (h) => h.ticker === action.ticker,
            );
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
      }
    }

    // Бенчмарки: покупаем в первый день.
    if (!benchmarkInitialized) {
      const ip = priceOnSeries(imoexPrices, date);
      if (ip && ip > 0 && imoexCash > 0) {
        const lots = Math.floor(imoexCash / ip);
        imoexLots += lots;
        imoexCash -= lots * ip;
      }
      const mp = priceOnSeries(mcftrPrices, date);
      if (mp && mp > 0 && mcftrCash > 0) {
        const lots = Math.floor(mcftrCash / mp);
        mcftrLots += lots;
        mcftrCash -= lots * mp;
      }
      benchmarkInitialized = true;
    }

    // Дивиденды — прокси разницы MCFTR и IMOEX.
    if (prevDate) {
      const dayGap = diffDays(prevDate, date);
      const y = dailyDividendYield(
        priceOnSeries(imoexPrices, date),
        priceOnSeries(imoexPrices, prevDate),
        priceOnSeries(mcftrPrices, date),
        priceOnSeries(mcftrPrices, prevDate),
      );
      if (y > 0 && dayGap === 1) {
        const posVal = positionsValue(holdings, currentUniverse, prices, date);
        cash += posVal * y;
      }
    }

    // Вклад: ежедневная капитализация по ключевой ставке.
    if (prevDate) {
      const r = rateOn(keyRate, date);
      if (r != null) {
        const gap = diffDays(prevDate, date);
        const dailyRate = Math.pow(1 + r / 100, 1 / 365) - 1;
        depositValue *= Math.pow(1 + dailyRate, gap);
      }
    }
    if (monthStartSet.has(date) && prevDate !== null) {
      depositValue += params.monthlyTopUp;
    }

    // Снапшот.
    const posValue = positionsValue(holdings, currentUniverse, prices, date);
    const totalValue = posValue + cash;
    const imoexPrice = priceOnSeries(imoexPrices, date);
    const mcftrPrice = priceOnSeries(mcftrPrices, date);
    const imoexValue = imoexLots * (imoexPrice ?? 0) + imoexCash;
    const mcftrValue = mcftrLots * (mcftrPrice ?? 0) + mcftrCash;

    snapshots.push({
      date,
      positionsValue: posValue,
      cash,
      totalValue,
      invested,
      benchmarkValue: imoexValue,
      benchmarkTotalReturnValue: mcftrValue,
      imoexPrice: imoexPrice ?? 0,
      mcftrPrice: mcftrPrice ?? 0,
      depositValue,
      positionsCount: holdings.length,
      omissionWeight: currentOmission,
    });

    // Логи раз в квартал.
    if (snapshots.length % 60 === 0) {
      log(
        '[backtest]',
        date,
        '| portfolio:',
        totalValue.toFixed(0),
        '| IMOEX sim:',
        imoexValue.toFixed(0),
        '| MCFTR sim:',
        mcftrValue.toFixed(0),
        '| positions:',
        holdings.length,
      );
    }

    prevDate = date;
  }

  const metrics = computeMetrics(snapshots, params);
  return { params, snapshots, metrics };
}
