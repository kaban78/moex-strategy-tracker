// language: TypeScript, target: historical prices for backtest
//
// MOEX ISS отдаёт максимум 100 строк за запрос. Для диапазона 6 лет
// нужно 16 страниц. Используем пагинацию.

import { parseIssTable, type IssTable } from '@/lib/moex/parse';

const ISS_BASE = 'https://iss.moex.com/iss';
const USER_AGENT =
  'moex-strategy-tracker/0.1 (personal use, informational tool)';
const MAX_CONCURRENT = 8;
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

interface IssJson {
  [key: string]: IssTable | undefined;
}

interface HistoryRow {
  TRADEDATE: string;
  CLOSE: number;
}

const priceCache = new Map<string, Map<string, number>>();
const indexPriceCache = new Map<string, Map<string, number>>();

async function fetchPages(
  basePath: string,
  from: string,
  till: string,
  revalidate: number,
): Promise<Map<string, number>> {
  const map = new Map<string, number>();

  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(ISS_BASE + basePath);
    url.searchParams.set('from', from);
    url.searchParams.set('till', till);
    url.searchParams.set('start', String(page * PAGE_SIZE));
    url.searchParams.set('history.columns', 'TRADEDATE,CLOSE');
    url.searchParams.set('iss.meta', 'off');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate },
    });
    if (!res.ok) {
      throw new Error(`MOEX ${basePath} → HTTP ${res.status}`);
    }

    const json = (await res.json()) as IssJson;
    const rows = parseIssTable<HistoryRow>(json.history);
    if (rows.length === 0) break;

    for (const r of rows) {
      if (typeof r.CLOSE === 'number' && r.CLOSE > 0 && r.TRADEDATE) {
        map.set(r.TRADEDATE, r.CLOSE);
      }
    }

    if (rows.length < PAGE_SIZE) break;
  }

  return map;
}

async function fetchTickerPricesFromIss(
  ticker: string,
  from: string,
  till: string,
): Promise<Map<string, number>> {
  return fetchPages(
    `/history/engines/stock/markets/shares/boards/TQBR/securities/${encodeURIComponent(ticker)}.json`,
    from,
    till,
    3600,
  );
}

async function fetchWithThrottle<T>(
  items: string[],
  worker: (item: string) => Promise<T>,
): Promise<T[]> {
  const results: T[] = new Array(items.length);
  let cursor = 0;

  async function run() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  }

  const workers = Array.from(
    { length: Math.min(MAX_CONCURRENT, items.length) },
    () => run(),
  );
  await Promise.all(workers);
  return results;
}

export async function fetchPrices(
  tickers: string[],
  from: string,
  till: string,
): Promise<Map<string, Map<string, number>>> {
  const unique = Array.from(new Set(tickers));
  const result = new Map<string, Map<string, number>>();

  const toLoad: string[] = [];
  for (const t of unique) {
    const cached = priceCache.get(t);
    if (cached) result.set(t, cached);
    else toLoad.push(t);
  }

  if (toLoad.length > 0) {
    const loaded = await fetchWithThrottle(toLoad, (t) =>
      fetchTickerPricesFromIss(t, from, till),
    );
    toLoad.forEach((t, i) => {
      priceCache.set(t, loaded[i]);
      result.set(t, loaded[i]);
    });
  }

  return result;
}

export async function fetchIndexPrices(
  indexCode: string,
  from: string,
  till: string,
): Promise<Map<string, number>> {
  const key = `${indexCode}|${from}|${till}`;
  const cached = indexPriceCache.get(key);
  if (cached) return cached;

  const data = await fetchPages(
    `/history/engines/stock/markets/index/securities/${encodeURIComponent(indexCode)}.json`,
    from,
    till,
    3600,
  );

  if (process.env.NODE_ENV !== 'production') console.log(
    '[backtest:prices]',
    indexCode,
    'loaded:',
    data.size,
    'dates',
    'first:',
    Array.from(data.keys()).sort()[0],
    'last:',
    Array.from(data.keys()).sort().slice(-1)[0],
  );

  indexPriceCache.set(key, data);
  return data;
}

export function priceOn(
  prices: Map<string, Map<string, number>>,
  ticker: string,
  date: string,
): number | null {
  const series = prices.get(ticker);
  if (!series) return null;

  if (series.has(date)) return series.get(date) ?? null;

  const dates = Array.from(series.keys()).sort();
  if (dates.length === 0) return null;
  if (date < dates[0]) return null;

  let lo = 0;
  let hi = dates.length - 1;
  let best: string | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= date) {
      best = dates[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best ? (series.get(best) ?? null) : null;
}


/**
 * Цена на дату из плоского ряда { date → price }.
 * Для индексов (IMOEX, MCFTR), у которых нет ticker-обёртки.
 * Возвращает ближайшее предыдущее значение.
 */
export function priceOnSeries(
  series: Map<string, number>,
  date: string,
): number | null {
  if (series.size === 0) return null;
  if (series.has(date)) return series.get(date) ?? null;

  const dates = Array.from(series.keys()).sort();
  if (date < dates[0]) return null;

  let lo = 0;
  let hi = dates.length - 1;
  let best: string | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= date) {
      best = dates[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best ? (series.get(best) ?? null) : null;
}
