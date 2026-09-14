import { describe, it, expect } from 'vitest';
import { allocateLots } from '@/lib/engine/target-weights';
import type { Ticker, TargetWeight } from '@/types';

function makeTicker(overrides: Partial<Ticker>): Ticker {
  return {
    ticker: 'TEST',
    name: 'Test',
    lotSize: 10,
    price: 100,
    avgDailyVolume: 50_000_000,
    freeFloat: 0.5,
    mcap: 1_000_000_000,
    indexWeight: 1,
    dividendYield: 0.05,
    ...overrides,
  };
}

describe('allocateLots', () => {
  it('округляет вниз до целых лотов', () => {
    const universe = [makeTicker({ ticker: 'A', lotSize: 10, price: 100 })];
    // lotCost = 1000, portfolio = 5000, weight = 1 → target = 5 лотов
    const r = allocateLots(
      [{ ticker: 'A', weight: 1 }],
      universe,
      { portfolioValue: 5_000 },
    );
    expect(r.allocations[0].lots).toBe(5);
    expect(r.allocations[0].value).toBe(5_000);
    expect(r.cashLeft).toBe(0);
  });

  it('оставляет остаток в кэше при неполном лоте', () => {
    const universe = [makeTicker({ ticker: 'A', lotSize: 10, price: 100 })];
    // lotCost = 1000, portfolio = 5500 → 5 лотов, остаток 500
    const r = allocateLots(
      [{ ticker: 'A', weight: 1 }],
      universe,
      { portfolioValue: 5_500 },
    );
    expect(r.allocations[0].lots).toBe(5);
    expect(r.cashLeft).toBe(500);
  });

  it('считает rounding drift', () => {
    const universe = [makeTicker({ ticker: 'A', lotSize: 10, price: 100 })];
    // portfolio = 5500, weight = 1 → target 5.5 лотов, floor = 5
    // actual weight = 5000/5500 ≈ 0.909
    const r = allocateLots(
      [{ ticker: 'A', weight: 1 }],
      universe,
      { portfolioValue: 5_500 },
    );
    expect(r.allocations[0].roundingDrift).toBeCloseTo(0.909 - 1, 3);
  });

  it('распределяет по нескольким бумагам', () => {
    const universe = [
      makeTicker({ ticker: 'A', lotSize: 10, price: 100 }),
      makeTicker({ ticker: 'B', lotSize: 10, price: 200 }),
    ];
    const holdings: TargetWeight[] = [
      { ticker: 'A', weight: 0.5 },
      { ticker: 'B', weight: 0.5 },
    ];
    const r = allocateLots(holdings, universe, { portfolioValue: 10_000 });
    // A: target 5000 / 1000 = 5 лотов
    // B: target 5000 / 2000 = 2.5 → 2 лота
    const a = r.allocations.find((x) => x.ticker === 'A')!;
    const b = r.allocations.find((x) => x.ticker === 'B')!;
    expect(a.lots).toBe(5);
    expect(b.lots).toBe(2);
    expect(r.cashLeft).toBe(1000);
  });

  it('учитывает cash в общем капитале', () => {
    const universe = [makeTicker({ ticker: 'A', lotSize: 10, price: 100 })];
    const r = allocateLots(
      [{ ticker: 'A', weight: 1 }],
      universe,
      { portfolioValue: 5_000, cash: 2_000 },
    );
    expect(r.allocations[0].lots).toBe(7);
    expect(r.cashLeft).toBe(0);
  });

  it('игнорирует бумаги, которых нет в universe', () => {
    const universe = [makeTicker({ ticker: 'A' })];
    const r = allocateLots(
      [
        { ticker: 'A', weight: 0.5 },
        { ticker: 'MISSING', weight: 0.5 },
      ],
      universe,
      { portfolioValue: 5_000 },
    );
    expect(r.allocations).toHaveLength(1);
    expect(r.allocations[0].ticker).toBe('A');
  });
});
