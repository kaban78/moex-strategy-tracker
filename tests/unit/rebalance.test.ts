import { describe, it, expect } from 'vitest';
import { rebalance } from '@/lib/engine/rebalance';
import type { Drift } from '@/lib/engine/drift';
import type { Ticker } from '@/types';

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

function makeDrift(
  ticker: string,
  currentValue: number,
  targetValue: number,
): Drift {
  const total = Math.max(currentValue, targetValue, 1);
  return {
    ticker,
    currentWeight: currentValue / total,
    targetWeight: targetValue / total,
    delta: (currentValue - targetValue) / total,
    currentValue,
    targetValue,
  };
}

describe('rebalance', () => {
  it('покупает самую недобранную бумагу', () => {
    const universe = [
      makeTicker({ ticker: 'A', lotSize: 10, price: 100 }),
      makeTicker({ ticker: 'B', lotSize: 10, price: 100 }),
    ];
    const drifts: Drift[] = [
      makeDrift('A', 7_000, 5_000),
      makeDrift('B', 3_000, 5_000),
    ];
    const r = rebalance({ drifts, universe, cash: 2_000 });
    const buys = r.actions.filter((a) => a.side === 'buy');
    expect(buys.length).toBeGreaterThanOrEqual(1);
    expect(buys[0].ticker).toBe('B');
  });

  it('не покупает, если кэша не хватает на лот', () => {
    const universe = [makeTicker({ ticker: 'A', lotSize: 10, price: 1000 })];
    const drifts: Drift[] = [makeDrift('A', 0, 100_000)];
    const r = rebalance({ drifts, universe, cash: 500 });
    expect(r.actions).toHaveLength(0);
    expect(r.cashLeft).toBe(500);
  });

  it('greedy закрывает крупные дефициты', () => {
    const universe = [
      makeTicker({ ticker: 'A', lotSize: 10, price: 100 }),
      makeTicker({ ticker: 'B', lotSize: 10, price: 100 }),
    ];
    const drifts: Drift[] = [
      makeDrift('A', 1_500, 5_000),
      makeDrift('B', 1_500, 5_000),
    ];
    const r = rebalance({ drifts, universe, cash: 5_000 });
    // A: 3 лота, B: 2 лота (greedy распределяет 5000)
    expect(r.buyValue).toBe(5_000);
    expect(r.cashLeft).toBe(0);
  });

  it('top-up уменьшает cash drag когда greedy оставил остаток', () => {
    // A: лот 1000, gap 100 (недобор меньше лота)
    // B: лот 2000, gap 3000
    // cash 5000
    // greedy: B → 1 лот (2000), остаток 3000.
    //   A: floor(100/1000)=0, пропускается.
    // top-up: покупает B (gap 1000, score 0.5), потом A (gap 100, score 0.1).
    const universe = [
      makeTicker({ ticker: 'A', lotSize: 1, price: 1000 }),
      makeTicker({ ticker: 'B', lotSize: 2, price: 1000 }),
    ];
    const drifts: Drift[] = [
      makeDrift('A', 0, 100),
      makeDrift('B', 0, 3000),
    ];
    const withoutTopUp = rebalance({
      drifts,
      universe,
      cash: 5000,
      allowTopUp: false,
    });
    const withTopUp = rebalance({ drifts, universe, cash: 5000 });

    expect(withoutTopUp.cashLeft).toBe(3000);
    expect(withTopUp.cashLeft).toBe(0);
    expect(withTopUp.buyValue).toBeGreaterThan(withoutTopUp.buyValue);
  });

  it('продаёт при перевесе выше порога и отсутствии кэша', () => {
    const universe = [makeTicker({ ticker: 'A', lotSize: 10, price: 100 })];
    const drifts: Drift[] = [makeDrift('A', 10_000, 5_000)];
    const r = rebalance({ drifts, universe, cash: 0 });
    const sells = r.actions.filter((a) => a.side === 'sell');
    expect(sells).toHaveLength(1);
    expect(sells[0].lots).toBe(5);
  });

  it('не продаёт, если есть свободный кэш', () => {
    const universe = [
      makeTicker({ ticker: 'A', lotSize: 10, price: 100 }),
      makeTicker({ ticker: 'B', lotSize: 10, price: 100 }),
    ];
    const drifts: Drift[] = [
      makeDrift('A', 8_000, 5_000),
      makeDrift('B', 2_000, 5_000),
    ];
    const r = rebalance({ drifts, universe, cash: 3_000 });
    const sells = r.actions.filter((a) => a.side === 'sell');
    expect(sells).toHaveLength(0);
  });

  it('top-up не покупает дороже, чем осталось', () => {
    const universe = [
      makeTicker({ ticker: 'A', lotSize: 10, price: 500 }),
      makeTicker({ ticker: 'B', lotSize: 10, price: 100 }),
    ];
    const drifts: Drift[] = [
      makeDrift('A', 0, 10_000),
      makeDrift('B', 0, 10_000),
    ];
    // A lotCost = 5000, B lotCost = 1000. cash 6000.
    // greedy: A → 1 лот (5000), B → 1 лот (1000). Остаток 0.
    const r = rebalance({ drifts, universe, cash: 6_000 });
    expect(r.cashLeft).toBeLessThan(1_000);
  });
});
