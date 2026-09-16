import { describe, it, expect } from 'vitest';
import { computeMetrics } from '@/lib/backtest/metrics';
import type { MonthSnapshot, BacktestParams } from '@/lib/backtest/types';

function makeSnapshot(
  date: string,
  totalValue: number,
  benchmarkValue: number,
  benchmarkTotalReturnValue: number,
  invested: number,
): MonthSnapshot {
  return {
    date,
    positionsValue: totalValue,
    cash: 0,
    totalValue,
    invested,
    benchmarkValue,
    benchmarkTotalReturnValue,
    positionsCount: 5,
    omissionWeight: 0.05,
  };
}

const params: BacktestParams = {
  startDate: '2020-01-01',
  endDate: '2024-01-01',
  initialCapital: 100_000,
  monthlyTopUp: 10_000,
  commissionRate: 0.0005,
};

describe('computeMetrics', () => {
  it('пустой результат', () => {
    const m = computeMetrics([], params);
    expect(m.finalValue).toBe(0);
  });

  it('нормализованный max drawdown не ноль при падении', () => {
    const snaps = [
      makeSnapshot('2020-01-01', 100_000, 100_000, 100_000, 100_000),
      makeSnapshot('2020-06-01', 150_000, 150_000, 160_000, 100_000),
      makeSnapshot('2020-12-01', 90_000, 90_000, 100_000, 100_000),
    ];
    const m = computeMetrics(snaps, params);
    // Нормализация: 150/100=1.5 → 90/100=0.9. DD = (1.5-0.9)/1.5 = 0.4
    expect(m.maxDrawdown).toBeCloseTo(0.4, 3);
  });

  it('MCFTR всегда ≥ IMOEX при росте', () => {
    const snaps = [
      makeSnapshot('2020-01-01', 100_000, 100_000, 100_000, 100_000),
      makeSnapshot('2024-01-01', 150_000, 150_000, 200_000, 100_000),
    ];
    const m = computeMetrics(snaps, params);
    expect(m.benchmarkTotalReturnFinalValue).toBeGreaterThan(
      m.benchmarkFinalValue,
    );
  });

  it('tracking error по MCFTR', () => {
    const snaps = [
      makeSnapshot('2020-01-01', 100_000, 100_000, 100_000, 100_000),
      makeSnapshot('2020-02-01', 105_000, 105_000, 105_000, 100_000),
      makeSnapshot('2020-03-01', 110_000, 110_000, 110_000, 100_000),
      makeSnapshot('2020-04-01', 115_000, 115_000, 115_000, 100_000),
    ];
    const m = computeMetrics(snaps, params);
    expect(m.trackingError).toBeCloseTo(0, 6);
  });
});
