// language: TypeScript, target: MOEX ISS response parsing

import type { Ticker } from '@/types';

export interface IssTable {
  columns: string[];
  data: unknown[][];
}

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

export interface IssIndexRow {
  indexid: string;
  tradedate: string;
  ticker: string;
  shortnames: string;
  secids: string;
  weight: number;
  tradingsession: number;
  trade_session_date: string;
}

export interface IssSecurityRow {
  SECID: string;
  SHORTNAME: string;
  LOTSIZE: number;
  PREVPRICE: number;
}

export interface IssMarketDataRow {
  SECID: string;
  LAST: number;
  VALTODAY: number;
}

export interface IssCandleRow {
  begin: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  value: number;
}

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

    result.push({
      ticker: w.ticker,
      name: w.shortnames || sec.SHORTNAME,
      lotSize: sec.LOTSIZE || 1,
      price,
      avgDailyVolume: md?.VALTODAY ?? 0,
      indexWeight: w.weight,
    });
  }
  return result;
}

/**
 * Свеча для lightweight-charts.
 * time: string "YYYY-MM-DD" для дневных+, или Unix timestamp (сек) для внутридневных.
 */
export interface Candle {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/**
 * MOEX ISS интервалы: 1, 10 (мин), 60 (час), 24 (день), 7 (неделя), 31 (месяц).
 * intraday = interval < 24 → время с часовым поясом.
 *
 * begin в ответе — MSK (UTC+3). Parsed как будто это UTC (Z),
 * чтобы lightweight-charts показывал время в MSK.
 */
export function parseCandles(rows: IssCandleRow[], interval: number): Candle[] {
  const intraday = interval < 24;
  const out: Candle[] = [];
  const seen = new Set<number | string>();

  for (const r of rows) {
    if (
      typeof r.open !== 'number' || r.open <= 0 ||
      typeof r.high !== 'number' || r.high <= 0 ||
      typeof r.low !== 'number' || r.low <= 0 ||
      typeof r.close !== 'number' || r.close <= 0 ||
      typeof r.begin !== 'string' || r.begin.length === 0
    ) {
      continue;
    }

    let time: number | string;
    if (intraday) {
      const ts = Math.floor(
        new Date(r.begin.replace(' ', 'T') + 'Z').getTime() / 1000,
      );
      if (!Number.isFinite(ts)) continue;
      time = ts;
    } else {
      time = r.begin.slice(0, 10);
    }

    if (seen.has(time)) continue;
    seen.add(time);

    out.push({
      time,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
    });
  }

  return out;
}
