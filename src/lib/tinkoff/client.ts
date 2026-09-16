// language: TypeScript, target: T-Invest REST client
// Клиент T-Invest API через REST.
// Документация: https://tinkoff.github.io/investAPI/
//
// Токен передаётся извне при каждом вызове. Не хранится в модуле.

import type {
  TinkoffAccount,
  TinkoffPortfolio,
  TinkoffPosition,
  TinkoffDividend,
  GetDividendsResponse,
} from './types';

const BASE = 'https://invest-public-api.tinkoff.ru/rest';

const SERVICE_USERS = 'tinkoff.public.invest.api.contract.v1.UsersService';
const SERVICE_OPS =
  'tinkoff.public.invest.api.contract.v1.OperationsService';
const SERVICE_INSTRUMENTS =
  'tinkoff.public.invest.api.contract.v1.InstrumentsService';

interface RequestOptions {
  token: string;
  path: string;
  body: Record<string, unknown>;
}

async function post<T>({ token, path, body }: RequestOptions): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch (cause) {
    const c = cause as { message?: string; cause?: unknown };
    const inner = c.cause
      ? (c.cause as { message?: string; code?: string })
      : null;
    const detail = [c.message, inner?.code, inner?.message]
      .filter(Boolean)
      .join(' / ');
    throw new Error(`T-Invest fetch failed: ${detail || 'unknown'}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `T-Invest ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  return (await res.json()) as T;
}

export interface AccountsResponse {
  accounts: TinkoffAccount[];
}

export async function fetchAccounts(token: string): Promise<TinkoffAccount[]> {
  const data = await post<AccountsResponse>({
    token,
    path: `${SERVICE_USERS}/GetAccounts`,
    body: {},
  });
  return data.accounts ?? [];
}

export interface PortfolioResponse {
  accountId: string;
  positions: TinkoffPosition[];
  totalAmountPortfolio?: TinkoffPortfolio['totalAmountPortfolio'];
  expectedYield?: TinkoffPortfolio['expectedYield'];
}

export async function fetchPortfolio(
  token: string,
  accountId: string,
): Promise<PortfolioResponse> {
  const data = await post<PortfolioResponse>({
    token,
    path: `${SERVICE_OPS}/GetPortfolio`,
    body: { accountId, currency: 'RUB' },
  });
  return {
    accountId: data.accountId ?? accountId,
    positions: data.positions ?? [],
    totalAmountPortfolio: data.totalAmountPortfolio,
    expectedYield: data.expectedYield,
  };
}

export interface InstrumentShort {
  uid: string;
  ticker: string;
  classCode: string;
  instrumentType: string;
  name: string;
}

export interface SharesResponse {
  instruments: InstrumentShort[];
}

/**
 * Возвращает карту uid → MOEX SECID для всех акций.
 * Используется для нормализации портфеля: T-Invest даёт uid, нам нужен тикер.
 */
export async function fetchSharesUidMap(
  token: string,
): Promise<Map<string, string>> {
  const data = await post<SharesResponse>({
    token,
    path: `${SERVICE_INSTRUMENTS}/Shares`,
    body: { instrumentStatus: 'INSTRUMENT_STATUS_BASE' },
  });

  const map = new Map<string, string>();
  for (const inst of data.instruments ?? []) {
    if (!inst.uid || !inst.ticker) continue;
    map.set(inst.uid, inst.ticker);
  }
  return map;
}


/**
 * Дивиденды по бумаге. Принимает instrumentUid (не ticker).
 * Опциональные from/to — ISO-8601 (например "2020-01-01T00:00:00Z").
 */
export async function fetchDividends(
  token: string,
  instrumentUid: string,
  from?: string,
  to?: string,
): Promise<TinkoffDividend[]> {
  const body: Record<string, unknown> = { instrumentId: instrumentUid };
  if (from) body.from = from;
  if (to) body.to = to;

  const data = await post<GetDividendsResponse>({
    token,
    path: `${SERVICE_INSTRUMENTS}/GetDividends`,
    body,
  });
  return data.dividends ?? [];
}

interface TickerMapCache {
  at: number;
  map: Map<string, string>;
}

let tickerMapCache: TickerMapCache | null = null;
let tickerMapInFlight: Promise<Map<string, string>> | null = null;

const TICKER_MAP_TTL = 6 * 60 * 60 * 1000; // 6 часов

/**
 * Карта ticker → instrumentUid для всех акций T-Invest.
 *
 * Кэшируется в памяти процесса на 6 часов. Также блокирует
 * одновременные запросы от нескольких тикеров — иначе 46 параллельных
 * вызовов ловят HTTP 429.
 */
export async function fetchSharesTickerMap(
  _token: string,
): Promise<Map<string, string>> {
  const now = Date.now();
  if (tickerMapCache && now - tickerMapCache.at < TICKER_MAP_TTL) {
    return tickerMapCache.map;
  }
  if (tickerMapInFlight) {
    return tickerMapInFlight;
  }

  tickerMapInFlight = (async () => {
    try {
      const data = await post<SharesResponse>({
        token: _token,
        path: `${SERVICE_INSTRUMENTS}/Shares`,
        body: { instrumentStatus: 'INSTRUMENT_STATUS_BASE' },
      });

      const map = new Map<string, string>();
      for (const inst of data.instruments ?? []) {
        if (!inst.uid || !inst.ticker) continue;
        map.set(inst.ticker, inst.uid);
      }
      tickerMapCache = { at: Date.now(), map };
      return map;
    } finally {
      tickerMapInFlight = null;
    }
  })();

  return tickerMapInFlight;
}
