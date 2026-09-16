// language: TypeScript, target: backtest metrics
//
// Метрики в формате банковской отчётности:
//   - XIRR (Money-Weighted Return) — годовая доходность с учётом
//     времени пополнений. Главная метрика.
//   - Абсолютная доходность в деньгах = finalValue − totalInvested.
//   - Max drawdown на NAV-кривой (стоимость единицы капитала).
//   - Tracking error vs бенчмарк.
//
// Плюс «price CAGR» индексов: чистая доходность цены без пополнений.

import type {
  BacktestParams,
  BacktestMetrics,
  MonthSnapshot,
} from './types';
import { xirr, flowsFromSnapshots } from './xirr';

/**
 * Строит NAV-кривую: нормализованная стоимость единицы капитала.
 * Учитывает пополнения через вычитание contribution из end value.
 */
function buildNav(
  snapshots: MonthSnapshot[],
  valueKey: 'totalValue' | 'benchmarkValue' | 'benchmarkTotalReturnValue' | 'depositValue',
): number[] {
  if (snapshots.length === 0) return [];

  const nav: number[] = [1];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const cur = snapshots[i];
    const contribution = cur.invested - prev.invested;
    const prevValue = prev[valueKey];
    if (prevValue <= 0) {
      nav.push(nav[i - 1]);
      continue;
    }
    const ret = (cur[valueKey] - contribution - prevValue) / prevValue;
    const safeRet = Number.isFinite(ret) ? ret : 0;
    nav.push(nav[i - 1] * (1 + safeRet));
  }
  return nav;
}

function maxDrawdownFromNav(nav: number[]): number {
  if (nav.length < 2) return 0;
  let peak = nav[0];
  let maxDd = 0;
  for (const v of nav) {
    if (v > peak) peak = v;
    if (peak > 0) {
      const dd = (peak - v) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

function trackingError(
  snapshots: MonthSnapshot[],
  benchmarkKey: 'benchmarkValue' | 'benchmarkTotalReturnValue',
): number {
  if (snapshots.length < 3) return 0;

  const diffs: number[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const cur = snapshots[i];
    const contribution = cur.invested - prev.invested;
    if (prev.totalValue <= 0 || prev[benchmarkKey] <= 0) continue;

    const portRet =
      (cur.totalValue - contribution - prev.totalValue) / prev.totalValue;
    const benchRet =
      (cur[benchmarkKey] - contribution - prev[benchmarkKey]) /
      prev[benchmarkKey];

    if (Number.isFinite(portRet) && Number.isFinite(benchRet)) {
      diffs.push(portRet - benchRet);
    }
  }

  if (diffs.length < 2) return 0;
  const mean = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  const variance =
    diffs.reduce((s, d) => s + (d - mean) ** 2, 0) / (diffs.length - 1);
  return Math.sqrt(variance) * Math.sqrt(12);
}

/**
 * CAGR индекса: чистая доходность цены без пополнений.
 */
function priceCagr(
  snapshots: MonthSnapshot[],
  key: 'imoexPrice' | 'mcftrPrice',
): number {
  if (snapshots.length < 2) return 0;

  let first: number | null = null;
  let firstDate = '';
  for (const s of snapshots) {
    if (s[key] > 0) {
      first = s[key];
      firstDate = s.date;
      break;
    }
  }
  let last: number | null = null;
  let lastDate = '';
  for (let i = snapshots.length - 1; i >= 0; i--) {
    if (snapshots[i][key] > 0) {
      last = snapshots[i][key];
      lastDate = snapshots[i].date;
      break;
    }
  }
  if (first == null || last == null || first <= 0 || last <= 0) return 0;

  const days =
    (new Date(lastDate + 'T00:00:00Z').getTime() -
      new Date(firstDate + 'T00:00:00Z').getTime()) /
    (24 * 3600 * 1000);
  const years = days / 365.25;
  if (years <= 0) return 0;

  return Math.pow(last / first, 1 / years) - 1;
}

interface SeriesMetrics {
  finalValue: number;
  totalInvested: number;
  absoluteReturn: number;
  xirr: number;
  maxDrawdown: number;
}

function seriesMetrics(
  snapshots: MonthSnapshot[],
  valueKey: 'totalValue' | 'benchmarkValue' | 'benchmarkTotalReturnValue' | 'depositValue',
): SeriesMetrics {
  if (snapshots.length === 0) {
    return { finalValue: 0, totalInvested: 0, absoluteReturn: 0, xirr: NaN, maxDrawdown: 0 };
  }
  const last = snapshots[snapshots.length - 1];
  const finalValue = last[valueKey];
  const totalInvested = last.invested;
  const flows = flowsFromSnapshots(
    snapshots.map((s) => ({ date: s.date, invested: s.invested })),
    finalValue,
  );
  const nav = buildNav(snapshots, valueKey);

  return {
    finalValue,
    totalInvested,
    absoluteReturn: finalValue - totalInvested,
    xirr: xirr(flows),
    maxDrawdown: maxDrawdownFromNav(nav),
  };
}

export function computeMetrics(
  snapshots: MonthSnapshot[],
  _params: BacktestParams,
): BacktestMetrics {
  const empty: BacktestMetrics = {
    imoexPriceCagr: 0,
    mcftrPriceCagr: 0,
    portfolio: { finalValue: 0, totalInvested: 0, absoluteReturn: 0, xirr: NaN, maxDrawdown: 0 },
    imoexDca: { finalValue: 0, totalInvested: 0, absoluteReturn: 0, xirr: NaN, maxDrawdown: 0 },
    mcftrDca: { finalValue: 0, totalInvested: 0, absoluteReturn: 0, xirr: NaN, maxDrawdown: 0 },
    deposit: { finalValue: 0, totalInvested: 0, absoluteReturn: 0, xirr: NaN, maxDrawdown: 0 },
    trackingError: 0,
  };
  if (snapshots.length === 0) return empty;

  return {
    imoexPriceCagr: priceCagr(snapshots, 'imoexPrice'),
    mcftrPriceCagr: priceCagr(snapshots, 'mcftrPrice'),
    portfolio: seriesMetrics(snapshots, 'totalValue'),
    imoexDca: seriesMetrics(snapshots, 'benchmarkValue'),
    mcftrDca: seriesMetrics(snapshots, 'benchmarkTotalReturnValue'),
    deposit: seriesMetrics(snapshots, 'depositValue'),
    trackingError: trackingError(snapshots, 'benchmarkTotalReturnValue'),
  };
}
