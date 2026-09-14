import { describe, it, expect } from 'vitest';
import { computeDrift } from '@/lib/engine/drift';
import type { Position, Ticker, TargetWeight } from '@/types';

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

describe('computeDrift', () => {
  it('считает нулевой drift при точном совпадении', () => {
    const universe = [makeTicker({ ticker: 'A', lotSize: 10, price: 100 })];
    const positions: Position[] = [{ ticker: 'A', lots: 10 }];
    const target: TargetWeight[] = [{ ticker: 'A', weight: 1 }];
    const r = computeDrift({ positions, universe, targetWeights: target });
    expect(r.drifts[0].delta).toBeCloseTo(0, 5);
    expect(r.totalValue).toBe(10_000);
  });

  it('отрицательный delta при недоборе', () => {
    const universe = [makeTicker({ ticker: 'A', lotSize: 10, price: 100 })];
    const positions: Position[] = [{ ticker: 'A', lots: 5 }];
    const target: TargetWeight[] = [{ ticker: 'A', weight: 1 }];
    const r = computeDrift({ positions, universe, targetWeights: target });
    // value = 5000, target = 1 * 5000 = 5000, но weight = 1.0
    // На самом деле target = 1 от 5000 = 5000, current = 5000 → drift 0
    expect(r.drifts[0].delta).toBeCloseTo(0, 5);
  });

  it('недобор по бумаге, которой нет в позициях', () => {
    const universe = [
      makeTicker({ ticker: 'A', lotSize: 10, price: 100 }),
      makeTicker({ ticker: 'B', lotSize: 10, price: 100 }),
    ];
    const positions: Position[] = [{ ticker: 'A', lots: 10 }];
    const target: TargetWeight[] = [
      { ticker: 'A', weight: 0.5 },
      { ticker: 'B', weight: 0.5 },
    ];
    const r = computeDrift({ positions, universe, targetWeights: target });
    const a = r.drifts.find((d) => d.ticker === 'A')!;
    const b = r.drifts.find((d) => d.ticker === 'B')!;
    expect(a.delta).toBeCloseTo(0.5, 5);
    expect(b.delta).toBeCloseTo(-0.5, 5);
  });

  it('учитывает кэш в общем портфеле', () => {
    const universe = [makeTicker({ ticker: 'A', lotSize: 10, price: 100 })];
    const positions: Position[] = [{ ticker: 'A', lots: 5 }];
    const target: TargetWeight[] = [{ ticker: 'A', weight: 0.5 }];
    const r = computeDrift({
      positions,
      universe,
      targetWeights: target,
      cash: 5_000,
    });
    expect(r.totalValue).toBe(10_000);
    // current = 5000/10000 = 0.5, target = 0.5 → drift 0
    expect(r.drifts[0].delta).toBeCloseTo(0, 5);
  });

  it('считает turnover', () => {
    const universe = [
      makeTicker({ ticker: 'A', lotSize: 10, price: 100 }),
      makeTicker({ ticker: 'B', lotSize: 10, price: 100 }),
    ];
    const positions: Position[] = [{ ticker: 'A', lots: 10 }];
    const target: TargetWeight[] = [
      { ticker: 'A', weight: 0.5 },
      { ticker: 'B', weight: 0.5 },
    ];
    const r = computeDrift({ positions, universe, targetWeights: target });
    expect(r.turnover).toBeCloseTo(0.5, 5);
    expect(r.maxDrift).toBeCloseTo(0.5, 5);
  });

  it('возвращает пустой результат при нулевом портфеле', () => {
    const r = computeDrift({
      positions: [],
      universe: [],
      targetWeights: [],
    });
    expect(r.drifts).toEqual([]);
    expect(r.totalValue).toBe(0);
  });
});
