// language: TypeScript, target: MOEX ISS response parsing
// MOEX ISS возвращает таблицы в формате {columns, data}.
// Здесь — чистые функции парсинга. Без сети, тестируемы.

import type { Ticker } from '@/types';

/** Одна таблица ISS. data намеренно unknown[][] — ISS не гарантирует типы. */
export interface IssTable {
  columns: string[];
  data: unknown[][];
}

/**
 * Превращает таблицу ISS в массив объектов.
 * Ключи — из columns, значения — из data построчно.
 */
export function parseIssTable<T = Record<string, unknown>>(
  table: IssTable | undefined | null,
): T[] {
  if (!table || !table.columns || !table.data) return [];
  return table.data.map((row) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < table.columns.length; i++) {
      obj[table.columns[i]] = row[i];
    }
    return obj as T;
  });
}

/**
 * Строка из analytics IMOEX.
 * Реальные колонки ISS (проверено 2026-09-14):
 *   indexid, tradedate, ticker, shortnames, secids, weight,
 *   tradingsession, trade_session_date
 */
export interface IssIndexRow {
  indexid: string;
  tradedate: string;
  ticker: string;
  shortnames: string;
  secids: string;
  /** Вес в индексе, %. */
  weight: number;
  tradingsession: number;
  trade_session_date: string;
}

/** Строка из securities TQBR. */
export interface IssSecurityRow {
  SECID: string;
  SHORTNAME: string;
  LOTSIZE: number;
  PREVPRICE: number;
  FACEVALUE?: number;
}

/** Строка из marketdata TQBR. */
export interface IssMarketDataRow {
  SECID: string;
  LAST: number;
  VALTODAY: number;
}

/**
 * Фильтрует строки analytics по последней дате.
 */
export function latestTradeDate(rows: IssIndexRow[]): string | null {
  if (rows.length === 0) return null;
  return rows.reduce(
    (max, r) => (r.tradedate > max ? r.tradedate : max),
    rows[0].tradedate,
  );
}

export function filterByDate(
  rows: IssIndexRow[],
  date: string,
): IssIndexRow[] {
  return rows.filter((r) => r.tradedate === date);
}

/**
 * Мержит analytics (weight, shortnames) с securities (lotSize, prevprice)
 * и marketdata (LAST, VALTODAY) в Ticker[].
 *
 * Цена: LAST если > 0, иначе PREVPRICE.
 * Имя: из shortnames в analytics — уже там, отдельно тянуть не нужно.
 * mcap/freeFloat/dividendYield — не приходят из ISS analytics.
 *   Движок их не использует (см. buildPortfolio), ставим 0.
 */
export function mergeTickers(
  weights: IssIndexRow[],
  securities: IssSecurityRow[],
  marketData: IssMarketDataRow[],
): Ticker[] {
  const secMap = new Map(securities.map((s) => [s.SECID, s]));
  const mdMap = new Map(marketData.map((m) => [m.SECID, m]));

  const result: Ticker[] = [];
  for (const w of weights) {
    const sec = secMap.get(w.ticker);
    if (!sec) continue;
    const md = mdMap.get(w.ticker);

    const price = md?.LAST && md.LAST > 0 ? md.LAST : sec.PREVPRICE;
    if (!price || price <= 0) continue;

    const lotSize = sec.LOTSIZE || 1;
    const avgDailyVolume = md?.VALTODAY ?? 0;

    result.push({
      ticker: w.ticker,
      name: w.shortnames || sec.SHORTNAME,
      lotSize,
      price,
      avgDailyVolume,
      freeFloat: 0,
      mcap: 0,
      indexWeight: w.weight,
      dividendYield: 0,
    });
  }
  return result;
}
