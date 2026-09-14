import { describe, it, expect } from 'vitest';
import { buildPortfolio, optimalN } from '@/lib/universe/select';
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

describe('buildPortfolio', () => {
  it('пропускает бумаги с дорогим лотом', () => {
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

  it('считает omission weight', () => {
    const universe = [
      makeTicker({ ticker: 'A', indexWeight: 50 }),
      makeTicker({ ticker: 'B', indexWeight: 40 }),
      makeTicker({ ticker: 'C', indexWeight: 10, lotSize: 10, price: 100_000 }),
    ];
    const r = buildPortfolio(universe, { portfolioValue: 100_000 });
    expect(r.omissionWeight).toBeCloseTo(0.10, 2);
  });

  it('останавливается на coverage threshold', () => {
    const universe = [
      makeTicker({ ticker: 'A', indexWeight: 70 }),
      makeTicker({ ticker: 'B', indexWeight: 20 }),
      makeTicker({ ticker: 'C', indexWeight: 10 }),
    ];
    const r = buildPortfolio(universe, {
      portfolioValue: 1_000_000,
      coverageThreshold: 0.85,
    });
    // A+B = 90% > 85%, C не нужна
    const tickers = r.holdings.map((h) => h.ticker);
    expect(tickers).toEqual(['A', 'B']);
    expect(r.omitted.find((o) => o.ticker === 'C')?.reason).toBe(
      'below_coverage_cutoff',
    );
  });

  it('пустая вселенная возвращает пустой результат', () => {
    const r = buildPortfolio([], { portfolioValue: 100_000 });
    expect(r.holdings).toEqual([]);
    expect(r.omitted).toEqual([]);
    expect(r.omissionWeight).toBe(0);
  });

  it('соблюдает maxHoldings', () => {
    const universe = Array.from({ length: 10 }, (_, i) =>
      makeTicker({ ticker: `T${i}`, indexWeight: 10 }),
    );
    const r = buildPortfolio(universe, {
      portfolioValue: 10_000_000,
      maxHoldings: 3,
      coverageThreshold: 1.0,
    });
    expect(r.holdings.length).toBeLessThanOrEqual(3);
  });
});

describe('optimalN', () => {
  it('ограничен лотностью при малом портфеле', () => {
    expect(optimalN({ portfolioValue: 50_000 })).toBe(10);
  });

  it('ограничен потолком при большом портфеле', () => {
    expect(optimalN({ portfolioValue: 10_000_000 })).toBe(30);
  });

  it('не опускается ниже 5', () => {
    expect(optimalN({ portfolioValue: 10_000 })).toBe(5);
  });
});
