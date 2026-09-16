// language: TypeScript, target: historical IMOEX universe
// Загрузка состава IMOEX на дату с картой переименований тикеров.

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

/**
 * Переименования тикеров: старый → новый.
 * Нужно потому, что композиция IMOEX на 2020 использует старые SECID,
 * а securities ISS отдаёт по новым. Цены при этом грузятся по СТАРОМУ
 * тикеру — MOEX хранит историю под ним.
 */
const RENAMED: Record<string, string> = {
  TCSG: 'T',
  YNDX: 'YDEX',
  FIVE: 'X5',
};

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

export async function fetchCompositionOn(
  date: string,
): Promise<IssIndexRow[]> {
  const json = await fetchIss(
    '/statistics/engines/stock/markets/index/analytics/IMOEX.json',
    { date, limit: '200' },
    86400,
  );
  const rows = parseIssTable<IssIndexRow>(json.analytics);
  return rows.filter((r) => r.tradedate === date);
}

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
 *
 * Старые тикеры ищутся в TQBR через карту RENAMED, но lotSize и тикер
 * итоговый — СТАРЫЙ (TCSG), потому что цены в бэктесте будут грузиться
 * по нему. Так сохраняем корректность истории.
 */
export async function fetchUniverseOn(date: string): Promise<Ticker[]> {
  const weights = await fetchCompositionOn(date);
  if (weights.length === 0) return [];

  const originalTickers = weights.map((w) => w.ticker);

  // Для поиска в TQBR используем современные тикеры, но потом
  // привязываем их к оригинальным (историческим) в композиции.
  const lookupTickers = new Set<string>();
  for (const t of originalTickers) {
    lookupTickers.add(RENAMED[t] ?? t);
  }

  const { securities, marketData } = await fetchCurrentTradingData(
    Array.from(lookupTickers),
  );

  // Переиндексируем securities и marketData обратно на оригинальные тикеры.
  const securitiesByOriginal = new Map<string, IssSecurityRow>();
  const marketDataByOriginal = new Map<string, IssMarketDataRow>();

  for (const orig of originalTickers) {
    const modern = RENAMED[orig] ?? orig;
    const sec = securities.find((s) => s.SECID === modern);
    if (sec) {
      // Копируем с оригинальным SECID — чтобы mergeTickers нашёл.
      securitiesByOriginal.set(orig, { ...sec, SECID: orig });
    }
    const md = marketData.find((m) => m.SECID === modern);
    if (md) {
      marketDataByOriginal.set(orig, { ...md, SECID: orig });
    }
  }

  const result = mergeTickers(
    weights,
    Array.from(securitiesByOriginal.values()),
    Array.from(marketDataByOriginal.values()),
  );

  // Диагностика: сколько бумаг потеряно
  if (result.length < originalTickers.length) {
    const lost = originalTickers.filter(
      (t) => !result.some((r) => r.ticker === t),
    );
    if (process.env.NODE_ENV !== 'production') console.log(
      '[universe]',
      date,
      'composition:',
      originalTickers.length,
      'merged:',
      result.length,
      'lost:',
      lost.join(','),
    );
  }

  return result;
}
