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
    imoexPrice: benchmarkValue > 0 ? 100 : 0,
    mcftrPrice: benchmarkTotalReturnValue > 0 ? 100 : 0,
    depositValue: totalValue,
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
    expect(m.portfolio.finalValue).toBe(0);
    expect(m.imoexDca.finalValue).toBe(0);
    expect(m.deposit.finalValue).toBe(0);
  });

  it('max drawdown на NAV-кривой', () => {
    const snaps = [
      makeSnapshot('2020-01-01', 100_000, 100_000, 100_000, 100_000),
      makeSnapshot('2020-06-01', 150_000, 150_000, 160_000, 100_000),
      makeSnapshot('2020-12-01', 90_000, 90_000, 100_000, 100_000),
    ];
    const m = computeMetrics(snaps, params);
    // NAV: 1 → 1.5 → 0.9. DD = (1.5−0.9)/1.5 = 0.4
    expect(m.portfolio.maxDrawdown).toBeCloseTo(0.4, 3);
  });

  it('MCFTR финальная стоимость ≥ IMOEX при росте', () => {
    const snaps = [
      makeSnapshot('2020-01-01', 100_000, 100_000, 100_000, 100_000),
      makeSnapshot('2024-01-01', 150_000, 150_000, 200_000, 100_000),
    ];
    const m = computeMetrics(snaps, params);
    expect(m.mcftrDca.finalValue).toBeGreaterThan(m.imoexDca.finalValue);
  });

  it('absoluteReturn = finalValue − totalInvested', () => {
    const snaps = [
      makeSnapshot('2020-01-01', 100_000, 100_000, 100_000, 100_000),
      makeSnapshot('2024-01-01', 220_000, 200_000, 230_000, 100_000),
    ];
    const m = computeMetrics(snaps, params);
    expect(m.portfolio.absoluteReturn).toBe(120_000);
  });

  it('tracking error ноль когда портфель совпадает с MCFTR', () => {
    const snaps = [
      makeSnapshot('2020-01-01', 100_000, 100_000, 100_000, 100_000),
      makeSnapshot('2020-02-01', 105_000, 105_000, 105_000, 100_000),
      makeSnapshot('2020-03-01', 110_000, 110_000, 110_000, 100_000),
      makeSnapshot('2020-04-01', 115_000, 115_000, 115_000, 100_000),
    ];
    const m = computeMetrics(snaps, params);
    expect(m.trackingError).toBeCloseTo(0, 6);
  });

  it('XIRR считается для потока с пополнениями', () => {
    // Ровный рост ~10% годовых с ежемесячными пополнениями.
    const snaps: MonthSnapshot[] = [];
    let total = 100_000;
    let invested = 100_000;
    for (let m = 0; m < 24; m++) {
      const iso = new Date(Date.UTC(2020, m, 1))
        .toISOString()
        .slice(0, 10);
      if (m > 0) {
        total += 10_000;
        invested += 10_000;
      }
      total *= 1.008; // ~10% годовых в месяц
      snaps.push(
        makeSnapshot(
          iso,
          Math.round(total),
          Math.round(total),
          Math.round(total),
          invested,
        ),
      );
    }
    const m = computeMetrics(snaps, params);
    expect(m.portfolio.xirr).toBeGreaterThan(0.05);
    expect(m.portfolio.xirr).toBeLessThan(0.2);
  });
});
