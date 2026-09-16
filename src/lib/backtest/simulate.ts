// language: TypeScript, target: backtest simulation loop
//
// Симуляция репликации IMOEX:
//   - Ребалансировка раз в месяц (композиция IMOEX на первое число).
//   - Снапшот стоимости — каждый торговый день (для точной просадки).
//   - Дивиденды — прокси через разницу доходностей MCFTR и IMOEX за день.

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
import { fetchKeyRate, rateOn } from '@/lib/cbr/client';

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

function diffDays(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.max(1, Math.round((db - da) / (24 * 3600 * 1000)));
}

/**
 * Дневная дивидендная доходность IMOEX:
 *   mcftr_ret_1d − imoex_ret_1d
 * Если отрицательная — дивидендов не было.
 */
function dailyDividendYield(
  dateNow: string,
  datePrev: string,
  imoexNow: number | null,
  imoexPrev: number | null,
  mcftrNow: number | null,
  mcftrPrev: number | null,
): number {
  if (!imoexNow || !imoexPrev || !mcftrNow || !mcftrPrev) return 0;
  if (imoexPrev <= 0 || mcftrPrev <= 0) return 0;
  const imoexRet = imoexNow / imoexPrev - 1;
  const mcftrRet = mcftrNow / mcftrPrev - 1;
  const y = mcftrRet - imoexRet;
  return y > 0 ? y : 0;
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

  // Собираем композиции индекса на каждое первое число месяца.
  // Если ISS не отдал композицию — берём предыдущую доступную.
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

  // Вклад: загружаем ключевую ставку ЦБ и симулируем вклад с ежедневной
  // капитализацией по текущей ставке.
  let keyRate: Awaited<ReturnType<typeof fetchKeyRate>> = [];
  try {
    keyRate = await fetchKeyRate(params.startDate, params.endDate);
    console.log('[backtest] key rate points:', keyRate.length);
  } catch (e) {
    console.log('[backtest] key rate fetch failed:', e);
  }

  let depositValue = params.initialCapital;

  // Указатель на текущий «рабочий» состав для дней между ребалансировками.
  const monthStartSet = new Set(monthStartDates);
  let currentUniverse: Ticker[] = universes.get(monthStartDates[0]) ?? [];
  const lotByTicker = new Map(
    currentUniverse.map((t) => [t.ticker, t.lotSize]),
  );

  let holdings: Holding[] = [];
  let cash = params.initialCapital;
  let invested = params.initialCapital;
  let currentOmission = 0;

  let imoexLots = 0;
  let imoexCash = params.initialCapital;
  let mcftrLots = 0;
  let mcftrCash = params.initialCapital;

  // Для первого дня купим бенчмарки целиком.
  let benchmarkInitialized = false;

  const snapshots: MonthSnapshot[] = [];
  let prevDate: string | null = null;

  for (const date of calendar) {
    // Только дни в диапазоне [startDate, endDate].
    if (date < params.startDate || date > params.endDate) continue;

    // Смена месяца — ребалансировка.
    if (monthStartSet.has(date)) {
      const u = universes.get(date) ?? [];
      if (u.length > 0) {
        currentUniverse = u;
        lotByTicker.clear();
        for (const t of u) lotByTicker.set(t.ticker, t.lotSize);

        // Пополнение в начале месяца (кроме самого первого дня).
        if (prevDate !== null) {
          cash += params.monthlyTopUp;
          invested += params.monthlyTopUp;
          imoexCash += params.monthlyTopUp;
          mcftrCash += params.monthlyTopUp;
        }

        // Целевой портфель и ребалансировка.
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

    // Бенчмарк: покупаем IMOEX и MCFTR в первый день.
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

    // Дивиденды — прокси: разница дневной доходности MCFTR и IMOEX.
    if (prevDate) {
      const dayGap = diffDays(prevDate, date);
      const yield1d = dailyDividendYield(
        date,
        prevDate,
        priceOnSeries(imoexPrices, date),
        priceOnSeries(imoexPrices, prevDate),
        priceOnSeries(mcftrPrices, date),
        priceOnSeries(mcftrPrices, prevDate),
      );
      // Умножаем на gap: если между точками выходные, берём пропорцию.
      // Но в календаре только торговые дни, gap=1 почти всегда.
      if (yield1d > 0 && dayGap === 1) {
        const posVal = positionsValue(holdings, currentUniverse, prices, date);
        cash += posVal * yield1d;
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
    // Пополнение вклада в начале месяца.
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

    // Логи раз в квартал: сравнение портфель/бенчмарк/цены.
    if (snapshots.length % 60 === 0) {
      console.log(
        '[backtest]',
        date,
        '| portfolio:',
        totalValue.toFixed(0),
        '| IMOEX sim:',
        imoexValue.toFixed(0),
        '| MCFTR sim:',
        mcftrValue.toFixed(0),
        '| imoexPrice:',
        imoexPrice ?? 'null',
        '| mcftrPrice:',
        mcftrPrice ?? 'null',
        '| positions:',
        holdings.length,
      );
    }

    prevDate = date;
  }

  const firstImoex = snapshots.find((s) => s.imoexPrice > 0);
  const lastImoex = [...snapshots].reverse().find((s) => s.imoexPrice > 0);
  const firstMcftr = snapshots.find((s) => s.mcftrPrice > 0);
  const lastMcftr = [...snapshots].reverse().find((s) => s.mcftrPrice > 0);
  console.log('[backtest] IMOEX first:', firstImoex?.date, firstImoex?.imoexPrice);
  console.log('[backtest] IMOEX last:', lastImoex?.date, lastImoex?.imoexPrice);
  console.log('[backtest] MCFTR first:', firstMcftr?.date, firstMcftr?.mcftrPrice);
  console.log('[backtest] MCFTR last:', lastMcftr?.date, lastMcftr?.mcftrPrice);

  const metrics = computeMetrics(snapshots, params);
  return { params, snapshots, metrics };
}
