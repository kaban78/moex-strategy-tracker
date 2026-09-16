import { describe, it, expect } from 'vitest';
import { computeDividends } from '@/lib/engine/dividends';
import type { Position, Ticker } from '@/types';
import type { TinkoffDividend } from '@/lib/tinkoff/types';

function makeTicker(ticker: string, lotSize: number): Ticker {
  return {
    ticker,
    name: ticker,
    lotSize,
    price: 100,
    avgDailyVolume: 1_000_000,
    indexWeight: 1,
  };
}

function makeDividend(
  units: string,
  nano: number,
  recordDate: string,
  paymentDate: string,
): TinkoffDividend {
  return {
    dividendNet: { currency: 'rub', units, nano },
    paymentDate,
    declaredDate: recordDate,
    lastBuyDate: recordDate,
    dividendType: '',
    recordDate,
    regularity: 'Annual',
    closePrice: { currency: 'rub', units: '100', nano: 0 },
    yieldValue: { currency: 'rub', units: '5', nano: 0 },
    createdAt: recordDate,
  };
}

describe('computeDividends', () => {
  const universe: Ticker[] = [
    makeTicker('SBER', 10),
    makeTicker('GAZP', 10),
  ];

  it('считает perShare, perLot, total', () => {
    const positions: Position[] = [{ ticker: 'SBER', lots: 5 }];
    const map = new Map<string, TinkoffDividend[]>([
      ['SBER', [makeDividend('10', 0, '2026-07-20T00:00:00Z', '2026-08-04T00:00:00Z')]],
    ]);
    const r = computeDividends({
      positions,
      universe,
      dividendsByTicker: map,
      portfolioValue: 100_000,
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].perShare).toBe(10);
    expect(r.rows[0].perLot).toBe(100);
    expect(r.rows[0].total).toBe(500);
  });

  it('дивдоходность за 12 месяцев', () => {
    const positions: Position[] = [{ ticker: 'SBER', lots: 10 }];
    const future = new Date(Date.now() - 30 * 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);
    const map = new Map<string, TinkoffDividend[]>([
      ['SBER', [makeDividend('10', 0, future + 'T00:00:00Z', future + 'T00:00:00Z')]],
    ]);
    const r = computeDividends({
      positions,
      universe,
      dividendsByTicker: map,
      portfolioValue: 100_000,
    });
    // 10 руб × 10 лот × 10 акций = 1000 на 100 000 = 1%
    expect(r.last12MonthsAmount).toBe(1_000);
    expect(r.yieldLast12Months).toBeCloseTo(0.01, 4);
  });

  it('игнорирует бумаги без дивидендов', () => {
    const positions: Position[] = [
      { ticker: 'SBER', lots: 5 },
      { ticker: 'GAZP', lots: 5 },
    ];
    const map = new Map<string, TinkoffDividend[]>([
      ['SBER', [makeDividend('10', 0, '2026-07-20T00:00:00Z', '2026-08-04T00:00:00Z')]],
    ]);
    const r = computeDividends({
      positions,
      universe,
      dividendsByTicker: map,
      portfolioValue: 100_000,
    });
    expect(r.payingTickers).toBe(1);
    expect(r.totalTickers).toBe(2);
  });

  it('сортирует по дате отсечки, убывание', () => {
    const positions: Position[] = [{ ticker: 'SBER', lots: 1 }];
    const map = new Map<string, TinkoffDividend[]>([
      [
        'SBER',
        [
          makeDividend('5', 0, '2024-01-01T00:00:00Z', '2024-02-01T00:00:00Z'),
          makeDividend('10', 0, '2026-07-20T00:00:00Z', '2026-08-04T00:00:00Z'),
          makeDividend('7', 0, '2025-01-01T00:00:00Z', '2025-02-01T00:00:00Z'),
        ],
      ],
    ]);
    const r = computeDividends({
      positions,
      universe,
      dividendsByTicker: map,
      portfolioValue: 100_000,
    });
    expect(r.rows.map((row) => row.recordDate)).toEqual([
      '2026-07-20T00:00:00Z',
      '2025-01-01T00:00:00Z',
      '2024-01-01T00:00:00Z',
    ]);
  });

  it('пустой портфель → пустой результат', () => {
    const r = computeDividends({
      positions: [],
      universe,
      dividendsByTicker: new Map(),
      portfolioValue: 0,
    });
    expect(r.rows).toEqual([]);
    expect(r.totalAmount).toBe(0);
    expect(r.last12MonthsAmount).toBe(0);
  });

  it('позиция вне вселенной → lotSize = 1', () => {
    const positions: Position[] = [{ ticker: 'XXX', lots: 3 }];
    const map = new Map<string, TinkoffDividend[]>([
      ['XXX', [makeDividend('10', 0, '2026-07-20T00:00:00Z', '2026-08-04T00:00:00Z')]],
    ]);
    const r = computeDividends({
      positions,
      universe,
      dividendsByTicker: map,
      portfolioValue: 100_000,
    });
    expect(r.rows[0].perLot).toBe(10);
    expect(r.rows[0].total).toBe(30);
  });
});
