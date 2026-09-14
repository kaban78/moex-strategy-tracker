import { describe, it, expect } from 'vitest';
import { buildPortfolio } from '@/lib/universe/select';
import type { Ticker } from '@/types';

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

describe('buildPortfolio', () => {
  it('пропускает бумаги с лотом больше относительного порога', () => {
    const universe = [
      makeTicker({ ticker: 'A', indexWeight: 30, lotSize: 10, price: 100 }),
      makeTicker({ ticker: 'B', indexWeight: 20, lotSize: 10, price: 10_000 }),
      makeTicker({ ticker: 'C', indexWeight: 50, lotSize: 10, price: 200 }),
    ];
    const r = buildPortfolio(universe, { portfolioValue: 100_000 });
    const tickers = r.holdings.map((h) => h.ticker);
    expect(tickers).toContain('A');
    expect(tickers).toContain('C');
    expect(tickers).not.toContain('B');
    expect(r.omitted.find((o) => o.ticker === 'B')?.reason).toBe(
      'lot_too_expensive',
    );
  });

  it('пропускает дорогую бумагу даже с большим весом', () => {
    const universe = [
      makeTicker({ ticker: 'LKOH', indexWeight: 18, lotSize: 1, price: 5_508 }),
    ];
    const r = buildPortfolio(universe, { portfolioValue: 100_000 });
    expect(r.holdings).toHaveLength(1);
    expect(r.holdings[0].ticker).toBe('LKOH');
  });

  it('пропускает мелкую бумагу с дорогим лотом', () => {
    const universe = [
      makeTicker({ ticker: 'BIG', indexWeight: 99.38, lotSize: 1, price: 100 }),
      makeTicker({
        ticker: 'PHOR',
        indexWeight: 0.62,
        lotSize: 1,
        price: 5_543,
      }),
    ];
    const r = buildPortfolio(universe, { portfolioValue: 100_000 });
    const tickers = r.holdings.map((h) => h.ticker);
    expect(tickers).toContain('BIG');
    expect(tickers).not.toContain('PHOR');
    expect(r.omitted.find((o) => o.ticker === 'PHOR')?.reason).toBe(
      'lot_too_expensive',
    );
  });

  it('перенормирует веса на удержанные бумаги', () => {
    const universe = [
      makeTicker({ ticker: 'A', indexWeight: 60 }),
      makeTicker({ ticker: 'B', indexWeight: 30 }),
      makeTicker({ ticker: 'C', indexWeight: 10, lotSize: 10, price: 100_000 }),
    ];
    const r = buildPortfolio(universe, { portfolioValue: 100_000 });
    const a = r.holdings.find((h) => h.ticker === 'A')!;
    const b = r.holdings.find((h) => h.ticker === 'B')!;
    expect(a.weight).toBeCloseTo(60 / 90, 5);
    expect(b.weight).toBeCloseTo(30 / 90, 5);
    expect(a.weight + b.weight).toBeCloseTo(1, 5);
  });

  it('оценка TE через sqrt(sum w^2), а не линейно', () => {
    const universe: Ticker[] = [];
    for (let i = 0; i < 16; i++) {
      universe.push(
        makeTicker({
          ticker: 'OMIT' + i,
          indexWeight: 23 / 16,
          lotSize: 10,
          price: 100_000,
        }),
      );
    }
    universe.push(makeTicker({ ticker: 'BIG', indexWeight: 77 }));
    const r = buildPortfolio(universe, { portfolioValue: 100_000 });
    expect(r.estimatedTrackingError).toBeLessThan(0.025);
    expect(r.estimatedTrackingError).toBeGreaterThan(0.01);
  });

  it('считает omission weight', () => {
    const universe = [
      makeTicker({ ticker: 'A', indexWeight: 50 }),
      makeTicker({ ticker: 'B', indexWeight: 40 }),
      makeTicker({ ticker: 'C', indexWeight: 10, lotSize: 10, price: 100_000 }),
    ];
    const r = buildPortfolio(universe, { portfolioValue: 100_000 });
    expect(r.omissionWeight).toBeCloseTo(0.1, 2);
  });

  it('пустая вселенная возвращает пустой результат', () => {
    const r = buildPortfolio([], { portfolioValue: 100_000 });
    expect(r.holdings).toEqual([]);
    expect(r.omitted).toEqual([]);
    expect(r.omissionWeight).toBe(0);
  });

  it('соблюдает maxHoldings', () => {
    const universe = Array.from({ length: 10 }, (_, i) =>
      makeTicker({ ticker: 'T' + i, indexWeight: 10 }),
    );
    const r = buildPortfolio(universe, {
      portfolioValue: 10_000_000,
      maxHoldings: 3,
      coverageThreshold: 1.0,
    });
    expect(r.holdings.length).toBeLessThanOrEqual(3);
  });
});
