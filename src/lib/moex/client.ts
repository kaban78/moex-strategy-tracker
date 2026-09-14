// language: TypeScript, target: MOEX ISS HTTP client
// Клиент MOEX ISS. Бесплатный, без ключа, задержка 15 мин.

import type { Ticker } from '@/types';
import {
  parseIssTable,
  latestTradeDate,
  filterByDate,
  mergeTickers,
  parseCandles,
  type IssTable,
  type IssIndexRow,
  type IssSecurityRow,
  type IssMarketDataRow,
  type IssCandleRow,
  type Candle,
} from './parse';

const ISS_BASE = 'https://iss.moex.com/iss';

const USER_AGENT =
  'moex-strategy-tracker/0.1 (personal use, informational tool)';

interface IssJson {
  [key: string]: IssTable | undefined;
}

async function fetchIss(
  path: string,
  params: Record<string, string> = {},
  revalidate: number = 300,
): Promise<IssJson> {
  const url = new URL(ISS_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set('iss.meta', 'off');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate },
  });
  if (!res.ok) {
    throw new Error(`MOEX ISS ${path} → HTTP ${res.status}`);
  }
  return (await res.json()) as IssJson;
}

export async function fetchIndexWeights(): Promise<IssIndexRow[]> {
  const json = await fetchIss(
    '/statistics/engines/stock/markets/index/analytics/IMOEX.json',
    { limit: '100' },
    300,
  );
  const rows = parseIssTable<IssIndexRow>(json.analytics);
  const date = latestTradeDate(rows);
  if (!date) return [];
  return filterByDate(rows, date);
}

export async function fetchTradingData(
  tickers: string[],
): Promise<{
  securities: IssSecurityRow[];
  marketData: IssMarketDataRow[];
}> {
  const secids = tickers.join(',');
  const json = await fetchIss(
    '/engines/stock/markets/shares/boards/TQBR/securities.json',
    { securities: secids, marketdata: 'VALTODAY' },
    300,
  );
  return {
    securities: parseIssTable<IssSecurityRow>(json.securities),
    marketData: parseIssTable<IssMarketDataRow>(json.marketdata),
  };
}

export async function fetchUniverse(): Promise<Ticker[]> {
  const weights = await fetchIndexWeights();
  if (weights.length === 0) return [];
  const tickers = weights.map((w) => w.ticker);
  const { securities, marketData } = await fetchTradingData(tickers);
  return mergeTickers(weights, securities, marketData);
}

const PAGE_SIZE = 500;
const MAX_PAGES = 8; // 4000 свечей = ~16 лет дневных

/**
 * Свечи по бумаге с параллельной пагинацией.
 *
 * MOEX ISS отдаёт максимум 500 свечей за запрос. Раньше страницы
 * тянулись последовательно — 5+ roundtrip. Теперь параллельно:
 * сначала probe-запрос, потом все остальные страницы одновременно.
 *
 * Для 10 лет дневных свечей (5 страниц) — ~500 мс вместо ~3 сек.
 */
export async function fetchCandles(
  ticker: string,
  interval: number,
  days: number,
): Promise<Candle[]> {
  const till = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - days * 24 * 3600 * 1000)
    .toISOString()
    .slice(0, 10);

  const revalidate = interval < 24 ? 60 : 3600;

  const path = `/engines/stock/markets/shares/boards/TQBR/securities/${encodeURIComponent(ticker)}/candles.json`;

  // Probe — узнать есть ли данные вообще.
  const firstJson = await fetchIss(
    path,
    { from, till, interval: String(interval), start: '0' },
    revalidate,
  );
  const firstRows = parseIssTable<IssCandleRow>(firstJson.candles);
  if (firstRows.length === 0) return [];
  if (firstRows.length < PAGE_SIZE) {
    return parseCandles(firstRows, interval);
  }

  // Параллельно остальные страницы — до MAX_PAGES.
  const requests: Promise<IssCandleRow[]>[] = [];
  for (let p = 1; p < MAX_PAGES; p++) {
    const start = String(p * PAGE_SIZE);
    requests.push(
      fetchIss(
        path,
        { from, till, interval: String(interval), start },
        revalidate,
      ).then((j) => parseIssTable<IssCandleRow>(j.candles)),
    );
  }

  const pages = await Promise.all(requests);
  const all: IssCandleRow[] = [...firstRows];

  for (const rows of pages) {
    if (rows.length === 0) break;
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }

  return parseCandles(all, interval);
}
