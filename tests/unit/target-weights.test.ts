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
    indexWeight: 1,
    ...overrides,
  };
}

describe('allocateLots', () => {
  it('округляет вниз до целых лотов', () => {
    const universe = [makeTicker({ ticker: 'A', lotSize: 10, price: 100 })];
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
    const a = r.allocations.find((x) => x.ticker === 'A')!;
    const b = r.allocations.find((x) => x.ticker === 'B')!;
    expect(a.lots).toBe(5);
    expect(b.lots).toBe(2);
    expect(r.cashLeft).toBe(1_000);
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
