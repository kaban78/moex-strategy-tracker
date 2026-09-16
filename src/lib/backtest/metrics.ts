// language: TypeScript, target: backtest metrics
// Метрики бэктеста: CAGR, max drawdown, tracking error.

import type {
  BacktestParams,
  BacktestMetrics,
  MonthSnapshot,
} from './types';

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.max(1, Math.round((db - da) / (24 * 3600 * 1000)));
}

/**
 * CAGR: годовая доходность на вложенный капитал.
 * Учитывает пополнения через денежно-взвешенную аппроксимацию.
 */
function cagr(
  firstDate: string,
  lastDate: string,
  totalInvested: number,
  finalValue: number,
): number {
  if (totalInvested <= 0 || finalValue <= 0) return 0;
  const years = daysBetween(firstDate, lastDate) / 365.25;
  if (years <= 0) return 0;
  return Math.pow(finalValue / totalInvested, 1 / years) - 1;
}

function maxDrawdown(snapshots: MonthSnapshot[]): number {
  let peak = 0;
  let maxDd = 0;
  for (const s of snapshots) {
    if (s.totalValue > peak) peak = s.totalValue;
    if (peak > 0) {
      const dd = (peak - s.totalValue) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

function benchmarkMaxDrawdown(snapshots: MonthSnapshot[]): number {
  let peak = 0;
  let maxDd = 0;
  for (const s of snapshots) {
    if (s.benchmarkValue > peak) peak = s.benchmarkValue;
    if (peak > 0) {
      const dd = (peak - s.benchmarkValue) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

/**
 * Tracking error: стандартное отклонение разности месячных доходностей
 * портфеля и бенчмарка, приведённое к годовым.
 */
function trackingError(snapshots: MonthSnapshot[]): number {
  if (snapshots.length < 3) return 0;

  const diffs: number[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const cur = snapshots[i];
    if (prev.totalValue <= 0 || prev.benchmarkValue <= 0) continue;

    const portRet = cur.totalValue / prev.totalValue - 1;
    const benchRet = cur.benchmarkValue / prev.benchmarkValue - 1;
    diffs.push(portRet - benchRet);
  }

  if (diffs.length < 2) return 0;
  const mean = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  const variance =
    diffs.reduce((s, d) => s + (d - mean) ** 2, 0) / (diffs.length - 1);
  const monthlyStd = Math.sqrt(variance);
  return monthlyStd * Math.sqrt(12);
}

export function computeMetrics(
  snapshots: MonthSnapshot[],
  params: BacktestParams,
): BacktestMetrics {
  if (snapshots.length === 0) {
    return {
      finalValue: 0,
      totalInvested: 0,
      totalReturn: 0,
      cagr: 0,
      maxDrawdown: 0,
      trackingError: 0,
      benchmarkFinalValue: 0,
      benchmarkCagr: 0,
      benchmarkMaxDrawdown: 0,
    };
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const totalInvested = last.invested;
  const finalValue = last.totalValue;
  const benchmarkFinalValue = last.benchmarkValue;

  const totalReturn =
    totalInvested > 0 ? (finalValue - totalInvested) / totalInvested : 0;

  return {
    finalValue,
    totalInvested,
    totalReturn,
    cagr: cagr(first.date, last.date, totalInvested, finalValue),
    maxDrawdown: maxDrawdown(snapshots),
    trackingError: trackingError(snapshots),
    benchmarkFinalValue,
    benchmarkCagr: cagr(
      first.date,
      last.date,
      totalInvested,
      benchmarkFinalValue,
    ),
    benchmarkMaxDrawdown: benchmarkMaxDrawdown(snapshots),
  };
}
