// language: TypeScript, target: backtest metrics
//
// Используем TWR (Time-Weighted Return) вместо примитивного
// finalValue/totalInvested. При ежемесячных пополнениях простое деление
// занижает доходность: ранние вложения работают дольше.
//
// TWR нейтрален к пополнениям: измеряет доходность единицы капитала
// за период, независимо от того, когда деньги пришли.

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

interface PeriodReturn {
  /** Доходность периода без учёта пополнения, −1..∞. */
  ret: number;
}

/**
 * Разбивает ряд снапшотов на периоды и считает доходность каждого
 * периода с учётом пополнения в начале периода.
 */
function periodReturns(
  snapshots: MonthSnapshot[],
  valueKey: 'totalValue' | 'benchmarkValue' | 'benchmarkTotalReturnValue',
): PeriodReturn[] {
  const out: PeriodReturn[] = [];
  for (let i = 1; i < snapshots.length; i++) {
    const prev = snapshots[i - 1];
    const cur = snapshots[i];
    const contribution = cur.invested - prev.invested;
    const startValue = prev[valueKey] + contribution;
    if (startValue <= 0) continue;
    const ret = (cur[valueKey] - startValue) / startValue;
    if (!Number.isFinite(ret) || ret <= -1) continue;
    out.push({ ret });
  }
  return out;
}

/**
 * TWR — годовая доходность, нейтральная к пополнениям.
 */
function timeWeightedReturn(
  snapshots: MonthSnapshot[],
  valueKey: 'totalValue' | 'benchmarkValue' | 'benchmarkTotalReturnValue',
): number {
  const periods = periodReturns(snapshots, valueKey);
  if (periods.length === 0) return 0;

  let cumLog = 0;
  for (const p of periods) {
    cumLog += Math.log(1 + p.ret);
  }
  const totalReturn = Math.exp(cumLog) - 1;
  const years = periods.length / 12;
  if (years <= 0) return 0;
  return Math.pow(1 + totalReturn, 1 / years) - 1;
}

/**
 * Max drawdown на нормализованной кривой.
 * Нормализация — totalValue / invested. Так пополнения не маскируют
 * просадки: если портфель упал относительно вложенного,
 * drawdown будет видно.
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

/**
 * Tracking error — стандартное отклонение разности доходностей
 * портфеля и бенчмарка, годовое. Использует те же period-return,
 * что и TWR, поэтому пополнения не искажают.
 */
function trackingError(
  snapshots: MonthSnapshot[],
  benchmarkKey: 'benchmarkValue' | 'benchmarkTotalReturnValue',
): number {
  const portPeriods = periodReturns(snapshots, 'totalValue');
  const benchPeriods = periodReturns(snapshots, benchmarkKey);
  const n = Math.min(portPeriods.length, benchPeriods.length);
  if (n < 2) return 0;

  const diffs: number[] = [];
  for (let i = 0; i < n; i++) {
    diffs.push(portPeriods[i].ret - benchPeriods[i].ret);
  }

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

  const last = snapshots[snapshots.length - 1];
  const totalInvested = last.invested;
  const finalValue = last.totalValue;
  const bFinal = last.benchmarkValue;
  const btrFinal = last.benchmarkTotalReturnValue;

  // Total return — простой: (final − invested) / invested.
  // Это "сколько денег заработал", не годовая доходность.
  const totalReturn =
    totalInvested > 0 ? (finalValue - totalInvested) / totalInvested : 0;

  // CAGR/TWR — годовая доходность единицы капитала.
  const twrPortfolio = timeWeightedReturn(snapshots, 'totalValue');
  const twrImoex = timeWeightedReturn(snapshots, 'benchmarkValue');
  const twrMcftr = timeWeightedReturn(snapshots, 'benchmarkTotalReturnValue');

  return {
    finalValue,
    totalInvested,
    totalReturn,
    cagr: twrPortfolio,
    maxDrawdown: maxDrawdownNormalized(snapshots),
    trackingError: trackingError(snapshots, 'benchmarkTotalReturnValue'),
    benchmarkFinalValue: bFinal,
    benchmarkCagr: twrImoex,
    benchmarkMaxDrawdown: maxDrawdownNormalizedBenchmark(
      snapshots,
      'benchmarkValue',
    ),
    benchmarkTotalReturnFinalValue: btrFinal,
    benchmarkTotalReturnCagr: twrMcftr,
    benchmarkTotalReturnMaxDrawdown: maxDrawdownNormalizedBenchmark(
      snapshots,
      'benchmarkTotalReturnValue',
    ),
  };
}
