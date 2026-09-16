// language: TypeScript, target: T-Invest instruments
// Справочник инструментов: Shares, GetDividends.
// Карты uid → ticker и ticker → uid кэшируются в памяти процесса.

import { post, SERVICE_INSTRUMENTS } from './http';
import type { TinkoffDividend, GetDividendsResponse } from './types';

export interface InstrumentShort {
  uid: string;
  ticker: string;
  classCode: string;
  instrumentType: string;
  name: string;
}

interface SharesResponse {
  instruments: InstrumentShort[];
}

interface UidMaps {
  uidToTicker: Map<string, string>;
  tickerToUid: Map<string, string>;
}

interface CacheEntry {
  at: number;
  maps: UidMaps;
}

const TICKER_MAP_TTL = 6 * 60 * 60 * 1000;

let cache: CacheEntry | null = null;
let inFlight: Promise<UidMaps> | null = null;

/**
 * Карты uid ↔ ticker для всех акций T-Invest.
 *
 * Кэшируется в памяти процесса на 6 часов. Также блокирует
 * одновременные запросы — иначе 46 параллельных вызовов ловят HTTP 429.
 */
export async function fetchTickerMaps(_token: string): Promise<UidMaps> {
  const now = Date.now();
  if (cache && now - cache.at < TICKER_MAP_TTL) {
    return cache.maps;
  }
  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const data = await post<SharesResponse>({
        token: _token,
        path: `${SERVICE_INSTRUMENTS}/Shares`,
        body: { instrumentStatus: 'INSTRUMENT_STATUS_BASE' },
      });

      const uidToTicker = new Map<string, string>();
      const tickerToUid = new Map<string, string>();
      for (const inst of data.instruments ?? []) {
        if (!inst.uid || !inst.ticker) continue;
        uidToTicker.set(inst.uid, inst.ticker);
        tickerToUid.set(inst.ticker, inst.uid);
      }
      const maps = { uidToTicker, tickerToUid };
      cache = { at: Date.now(), maps };
      return maps;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
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
