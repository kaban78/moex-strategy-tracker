import { describe, it, expect } from 'vitest';
import { computeMetrics } from '@/lib/backtest/metrics';
import type { MonthSnapshot, BacktestParams } from '@/lib/backtest/types';

function makeSnapshot(
  date: string,
  totalValue: number,
  benchmarkValue: number,
  invested: number,
): MonthSnapshot {
  return {
    date,
    positionsValue: totalValue,
    cash: 0,
    totalValue,
    invested,
    benchmarkValue,
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
    expect(m.cagr).toBe(0);
  });

  it('считает total return', () => {
    const snaps = [
      makeSnapshot('2020-01-01', 100_000, 100_000, 100_000),
      makeSnapshot('2024-01-01', 220_000, 200_000, 100_000),
    ];
    const m = computeMetrics(snaps, params);
    expect(m.totalReturn).toBeCloseTo(1.2, 4);
    expect(m.finalValue).toBe(220_000);
  });

  it('CAGR положительный при росте', () => {
    const snaps = [
      makeSnapshot('2020-01-01', 100_000, 100_000, 100_000),
      makeSnapshot('2021-01-01', 115_000, 115_000, 100_000),
    ];
    const m = computeMetrics(snaps, params);
    expect(m.cagr).toBeGreaterThan(0.1);
    expect(m.cagr).toBeLessThan(0.2);
  });

  it('max drawdown', () => {
    const snaps = [
      makeSnapshot('2020-01-01', 100_000, 100_000, 100_000),
      makeSnapshot('2020-06-01', 150_000, 150_000, 100_000),
      makeSnapshot('2020-12-01', 90_000, 90_000, 100_000),
    ];
    const m = computeMetrics(snaps, params);
    // (150 - 90) / 150 = 0.4
    expect(m.maxDrawdown).toBeCloseTo(0.4, 4);
  });

  it('tracking error — ноль когда портфель равен бенчмарку', () => {
    const snaps = [
      makeSnapshot('2020-01-01', 100_000, 100_000, 100_000),
      makeSnapshot('2020-02-01', 105_000, 105_000, 100_000),
      makeSnapshot('2020-03-01', 110_000, 110_000, 100_000),
      makeSnapshot('2020-04-01', 115_000, 115_000, 100_000),
    ];
    const m = computeMetrics(snaps, params);
    expect(m.trackingError).toBeCloseTo(0, 6);
  });

  it('tracking error > 0 когда расходятся', () => {
    const snaps = [
      makeSnapshot('2020-01-01', 100_000, 100_000, 100_000),
      makeSnapshot('2020-02-01', 105_000, 102_000, 100_000),
      makeSnapshot('2020-03-01', 112_000, 106_000, 100_000),
      makeSnapshot('2020-04-01', 118_000, 111_000, 100_000),
    ];
    const m = computeMetrics(snaps, params);
    expect(m.trackingError).toBeGreaterThan(0);
  });
});
