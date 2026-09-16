// language: TypeScript, target: backtest metrics

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

/**
 * Max drawdown на нормализованной кривой.
 * Нормализация — totalValue / invested. Так пополнения не маскируют
 * просадки: если портфель упал на 30% относительно вложенного,
 * drawdown будет 0.30, а не 0.
 */
function maxDrawdownNormalized(snapshots: MonthSnapshot[]): number {
  let peak = 0;
  let maxDd = 0;
  for (const s of snapshots) {
    if (s.invested <= 0) continue;
    const norm = s.totalValue / s.invested;
    if (norm > peak) peak = norm;
    if (peak > 0) {
      const dd = (peak - norm) / peak;
      if (dd > maxDd) maxDd = dd;
    }
  }
  return maxDd;
}

function maxDrawdownNormalizedBenchmark(
  snapshots: MonthSnapshot[],
  key: 'benchmarkValue' | 'benchmarkTotalReturnValue',
): number {
  let peak = 0;
  let maxDd = 0;
  for (const s of snapshots) {
    if (s.invested <= 0) continue;
    const norm = s[key] / s.invested;
    if (norm > peak) peak = norm;
    if (peak > 0) {
      const dd = (peak - norm) / peak;
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
    if (prev.totalValue <= 0 || prev[benchmarkKey] <= 0) continue;

    const portRet = cur.totalValue / prev.totalValue - 1;
    const benchRet = cur[benchmarkKey] / prev[benchmarkKey] - 1;
    diffs.push(portRet - benchRet);
  }

  if (diffs.length < 2) return 0;
  const mean = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  const variance =
    diffs.reduce((s, d) => s + (d - mean) ** 2, 0) / (diffs.length - 1);
  return Math.sqrt(variance) * Math.sqrt(12);
}

export function computeMetrics(
  snapshots: MonthSnapshot[],
  _params: BacktestParams,
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
      benchmarkTotalReturnFinalValue: 0,
      benchmarkTotalReturnCagr: 0,
      benchmarkTotalReturnMaxDrawdown: 0,
    };
  }

  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const totalInvested = last.invested;
  const finalValue = last.totalValue;
  const bFinal = last.benchmarkValue;
  const btrFinal = last.benchmarkTotalReturnValue;

  const totalReturn =
    totalInvested > 0 ? (finalValue - totalInvested) / totalInvested : 0;

  return {
    finalValue,
    totalInvested,
    totalReturn,
    cagr: cagr(first.date, last.date, totalInvested, finalValue),
    maxDrawdown: maxDrawdownNormalized(snapshots),
    trackingError: trackingError(snapshots, 'benchmarkTotalReturnValue'),
    benchmarkFinalValue: bFinal,
    benchmarkCagr: cagr(first.date, last.date, totalInvested, bFinal),
    benchmarkMaxDrawdown: maxDrawdownNormalizedBenchmark(
      snapshots,
      'benchmarkValue',
    ),
    benchmarkTotalReturnFinalValue: btrFinal,
    benchmarkTotalReturnCagr: cagr(
      first.date,
      last.date,
      totalInvested,
      btrFinal,
    ),
    benchmarkTotalReturnMaxDrawdown: maxDrawdownNormalizedBenchmark(
      snapshots,
      'benchmarkTotalReturnValue',
    ),
  };
}
