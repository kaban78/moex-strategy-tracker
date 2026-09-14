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

describe('rebalance', () => {
  it('покупает самую недобранную бумагу', () => {
    const universe = [
      makeTicker({ ticker: 'A', lotSize: 10, price: 100 }),
      makeTicker({ ticker: 'B', lotSize: 10, price: 100 }),
    ];
    const drifts: Drift[] = [
      {
        ticker: 'A',
        currentWeight: 0.7,
        targetWeight: 0.5,
        delta: 0.2,
        currentValue: 7_000,
        targetValue: 5_000,
      },
      {
        ticker: 'B',
        currentWeight: 0.3,
        targetWeight: 0.5,
        delta: -0.2,
        currentValue: 3_000,
        targetValue: 5_000,
      },
    ];
    const r = rebalance({ drifts, universe, cash: 2_000 });
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0].ticker).toBe('B');
    expect(r.actions[0].side).toBe('buy');
    expect(r.actions[0].lots).toBe(2);
    expect(r.buyValue).toBe(2_000);
    expect(r.cashLeft).toBe(0);
  });

  it('не покупает, если кэша не хватает на лот', () => {
    const universe = [makeTicker({ ticker: 'A', lotSize: 10, price: 1000 })];
    const drifts: Drift[] = [
      {
        ticker: 'A',
        currentWeight: 0,
        targetWeight: 1,
        delta: -1,
        currentValue: 0,
        targetValue: 100_000,
      },
    ];
    const r = rebalance({ drifts, universe, cash: 5_000 });
    expect(r.actions).toHaveLength(0);
    expect(r.cashLeft).toBe(5_000);
  });

  it('не покупает сверх целевого веса', () => {
    const universe = [makeTicker({ ticker: 'A', lotSize: 10, price: 100 })];
    const drifts: Drift[] = [
      {
        ticker: 'A',
        currentWeight: 0.9,
        targetWeight: 1.0,
        delta: -0.1,
        currentValue: 9_000,
        targetValue: 10_000,
      },
    ];
    const r = rebalance({ drifts, universe, cash: 10_000 });
    // Нужно 1000 руб = 1 лот, кэша хватает, но больше не нужно
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0].lots).toBe(1);
    expect(r.cashLeft).toBe(9_000);
  });

  it('продаёт при перевесе выше порога и отсутствии кэша', () => {
    const universe = [makeTicker({ ticker: 'A', lotSize: 10, price: 100 })];
    const drifts: Drift[] = [
      {
        ticker: 'A',
        currentWeight: 1.0,
        targetWeight: 0.5,
        delta: 0.5,
        currentValue: 10_000,
        targetValue: 5_000,
      },
    ];
    const r = rebalance({ drifts, universe, cash: 0 });
    expect(r.actions).toHaveLength(1);
    expect(r.actions[0].side).toBe('sell');
    expect(r.actions[0].lots).toBe(5);
    expect(r.sellValue).toBe(5_000);
  });

  it('не продаёт при перевесе ниже порога', () => {
    const universe = [makeTicker({ ticker: 'A', lotSize: 10, price: 100 })];
    const drifts: Drift[] = [
      {
        ticker: 'A',
        currentWeight: 0.53,
        targetWeight: 0.5,
        delta: 0.03,
        currentValue: 5_300,
        targetValue: 5_000,
      },
    ];
    const r = rebalance({ drifts, universe, cash: 0 });
    expect(r.actions).toHaveLength(0);
  });

  it('не продаёт, пока есть свободный кэш', () => {
    const universe = [
      makeTicker({ ticker: 'A', lotSize: 10, price: 100 }),
      makeTicker({ ticker: 'B', lotSize: 10, price: 100 }),
    ];
    const drifts: Drift[] = [
      {
        ticker: 'A',
        currentWeight: 0.8,
        targetWeight: 0.5,
        delta: 0.3,
        currentValue: 8_000,
        targetValue: 5_000,
      },
      {
        ticker: 'B',
        currentWeight: 0.2,
        targetWeight: 0.5,
        delta: -0.3,
        currentValue: 2_000,
        targetValue: 5_000,
      },
    ];
    const r = rebalance({ drifts, universe, cash: 3_000 });
    // Кэша хватает, чтобы добрать B — продавать A не нужно
    const sells = r.actions.filter((a) => a.side === 'sell');
    expect(sells).toHaveLength(0);
  });
});
