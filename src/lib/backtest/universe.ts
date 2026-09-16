// language: TypeScript, target: historical IMOEX universe
// Загрузка состава IMOEX на конкретную дату.
//
// MOEX ISS отдаёт состав через analytics с параметром date=YYYY-MM-DD.
// Работает только для торговых дней. Для выходных используем nearestTradingDay.

import type { Ticker } from '@/types';
import {
  parseIssTable,
  mergeTickers,
  type IssTable,
  type IssIndexRow,
  type IssSecurityRow,
  type IssMarketDataRow,
} from '@/lib/moex/parse';

const ISS_BASE = 'https://iss.moex.com/iss';
const USER_AGENT =
  'moex-strategy-tracker/0.1 (personal use, informational tool)';

interface IssJson {
  [key: string]: IssTable | undefined;
}

async function fetchIss(
  path: string,
  params: Record<string, string>,
  revalidate: number,
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

/**
 * Состав IMOEX на конкретную дату (торговый день).
 * Возвращает только тикеры + веса. Цены и лоты тянем отдельно.
 */
export async function fetchCompositionOn(
  date: string,
): Promise<IssIndexRow[]> {
  const json = await fetchIss(
    '/statistics/engines/stock/markets/index/analytics/IMOEX.json',
    { date, limit: '200' },
    86400, // состав на дату не меняется, кэш сутки
  );
  const rows = parseIssTable<IssIndexRow>(json.analytics);
  return rows.filter((r) => r.tradedate === date);
}

/**
 * Для набора тикеров тянет текущие лоты и последние цены.
 * Используется ТОЛЬКО для получения lotSize — цены в бэктесте
 * берём из historical candles.
 */
export async function fetchCurrentTradingData(
  tickers: string[],
): Promise<{
  securities: IssSecurityRow[];
  marketData: IssMarketDataRow[];
}> {
  if (tickers.length === 0) {
    return { securities: [], marketData: [] };
  }
  const json = await fetchIss(
    '/engines/stock/markets/shares/boards/TQBR/securities.json',
    { securities: tickers.join(','), marketdata: 'VALTODAY' },
    3600,
  );
  return {
    securities: parseIssTable<IssSecurityRow>(json.securities),
    marketData: parseIssTable<IssMarketDataRow>(json.marketdata),
  };
}

/**
 * Полный Ticker[] для состава индекса на дату.
 * lotSize и price из текущих данных ISS — для бэктеста нам нужны только
 * lotSize и тикер; цена перезапишется исторической свечой.
 */
export async function fetchUniverseOn(date: string): Promise<Ticker[]> {
  const weights = await fetchCompositionOn(date);
  if (weights.length === 0) return [];
  const tickers = weights.map((w) => w.ticker);
  const { securities, marketData } = await fetchCurrentTradingData(tickers);
  return mergeTickers(weights, securities, marketData);
}
