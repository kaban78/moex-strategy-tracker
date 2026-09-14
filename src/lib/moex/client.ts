// language: TypeScript, target: MOEX ISS HTTP client
// Клиент MOEX ISS. Бесплатный, без ключа, задержка 15 мин.
// Документация: https://iss.moex.com/iss/reference/

import type { Ticker } from '@/types';
import {
  parseIssTable,
  latestTradeDate,
  filterByDate,
  mergeTickers,
  type IssTable,
  type IssIndexRow,
  type IssSecurityRow,
  type IssMarketDataRow,
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
): Promise<IssJson> {
  const url = new URL(ISS_BASE + path);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set('iss.meta', 'off');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`MOEX ISS ${path} → HTTP ${res.status}`);
  }
  return (await res.json()) as IssJson;
}

/**
 * Состав IMOEX и веса бумаг на последнюю доступную дату.
 */
export async function fetchIndexWeights(): Promise<IssIndexRow[]> {
  const json = await fetchIss(
    '/statistics/engines/stock/markets/index/analytics/IMOEX.json',
    { limit: '100' },
  );

  const rows = parseIssTable<IssIndexRow>(json.analytics);
  const date = latestTradeDate(rows);
  if (!date) return [];
  return filterByDate(rows, date);
}

/**
 * Цены, размеры лотов и дневной оборот по бумагам TQBR.
 */
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
  );

  return {
    securities: parseIssTable<IssSecurityRow>(json.securities),
    marketData: parseIssTable<IssMarketDataRow>(json.marketdata),
  };
}

/**
 * Полный Ticker[] для вселенной IMOEX.
 */
export async function fetchUniverse(): Promise<Ticker[]> {
  const weights = await fetchIndexWeights();
  if (weights.length === 0) return [];

  const tickers = weights.map((w) => w.ticker);
  const { securities, marketData } = await fetchTradingData(tickers);

  return mergeTickers(weights, securities, marketData);
}
