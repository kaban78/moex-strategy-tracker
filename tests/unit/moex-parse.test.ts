import { describe, it, expect } from 'vitest';
import {
  parseIssTable,
  latestTradeDate,
  filterByDate,
  mergeTickers,
  type IssIndexRow,
  type IssSecurityRow,
  type IssMarketDataRow,
} from '@/lib/moex/parse';

function makeIndexRow(overrides: Partial<IssIndexRow>): IssIndexRow {
  return {
    indexid: 'IMOEX',
    tradedate: '2026-09-14',
    ticker: 'SBER',
    shortnames: 'Сбербанк',
    secids: 'SBER',
    weight: 12.3,
    tradingsession: 3,
    trade_session_date: '2026-09-14',
    ...overrides,
  };
}

describe('parseIssTable', () => {
  it('превращает таблицу в массив объектов', () => {
    const table = {
      columns: ['a', 'b'],
      data: [
        [1, 'x'],
        [2, 'y'],
      ],
    };
    const rows = parseIssTable<{ a: number; b: string }>(table);
    expect(rows).toEqual([
      { a: 1, b: 'x' },
      { a: 2, b: 'y' },
    ]);
  });

  it('возвращает пустой массив для undefined', () => {
    expect(parseIssTable(undefined)).toEqual([]);
  });

  it('обрабатывает null в данных', () => {
    const table = { columns: ['a', 'b'], data: [[null, 1]] };
    const rows = parseIssTable<{ a: unknown; b: unknown }>(table);
    expect(rows[0]).toEqual({ a: null, b: 1 });
  });
});

describe('latestTradeDate', () => {
  it('находит максимальную дату', () => {
    const rows: IssIndexRow[] = [
      makeIndexRow({ tradedate: '2026-09-10' }),
      makeIndexRow({ tradedate: '2026-09-11' }),
      makeIndexRow({ tradedate: '2026-09-09' }),
    ];
    expect(latestTradeDate(rows)).toBe('2026-09-11');
  });

  it('возвращает null для пустого массива', () => {
    expect(latestTradeDate([])).toBeNull();
  });
});

describe('filterByDate', () => {
  it('оставляет только строки с заданной датой', () => {
    const rows: IssIndexRow[] = [
      makeIndexRow({ tradedate: '2026-09-10', ticker: 'A' }),
      makeIndexRow({ tradedate: '2026-09-11', ticker: 'B' }),
      makeIndexRow({ tradedate: '2026-09-11', ticker: 'C' }),
    ];
    const filtered = filterByDate(rows, '2026-09-11');
    expect(filtered).toHaveLength(2);
    expect(filtered.map((r) => r.ticker)).toEqual(['B', 'C']);
  });
});

describe('mergeTickers', () => {
  const weights: IssIndexRow[] = [
    makeIndexRow({ ticker: 'SBER', shortnames: 'Сбербанк', weight: 12.3 }),
    makeIndexRow({ ticker: 'GAZP', shortnames: 'Газпром', weight: 8.6 }),
  ];

  const securities: IssSecurityRow[] = [
    { SECID: 'SBER', SHORTNAME: 'Сбербанк', LOTSIZE: 10, PREVPRICE: 320 },
    { SECID: 'GAZP', SHORTNAME: 'Газпром', LOTSIZE: 10, PREVPRICE: 130 },
  ];

  const marketData: IssMarketDataRow[] = [
    { SECID: 'SBER', LAST: 325, VALTODAY: 5e9 },
    { SECID: 'GAZP', LAST: 0, VALTODAY: 3e9 },
  ];

  it('мержит данные и берёт LAST как цену', () => {
    const tickers = mergeTickers(weights, securities, marketData);
    expect(tickers).toHaveLength(2);
    const sber = tickers.find((t) => t.ticker === 'SBER')!;
    expect(sber.price).toBe(325);
    expect(sber.lotSize).toBe(10);
    expect(sber.avgDailyVolume).toBe(5e9);
    expect(sber.indexWeight).toBe(12.3);
    expect(sber.name).toBe('Сбербанк');
  });

  it('падает на PREVPRICE, если LAST = 0', () => {
    const tickers = mergeTickers(
      [weights[1]],
      [securities[1]],
      [marketData[1]],
    );
    expect(tickers[0].price).toBe(130);
  });

  it('пропускает бумаги без securities', () => {
    const tickers = mergeTickers(
      [makeIndexRow({ ticker: 'NOPE' })],
      securities,
      marketData,
    );
    expect(tickers).toHaveLength(0);
  });

  it('пропускает бумаги без marketdata, но с PREVPRICE', () => {
    const tickers = mergeTickers([weights[0]], [securities[0]], []);
    expect(tickers).toHaveLength(1);
    expect(tickers[0].price).toBe(320);
  });
});
