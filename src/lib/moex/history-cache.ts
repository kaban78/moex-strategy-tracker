// language: TypeScript, target: MOEX history client cache
// Простой in-memory кэш дневных/часовых свечей на 60 секунд.
// Живёт в модуле — общий для всех компонентов, переживает открытие/закрытие графика.

import type { Candle } from './parse';

const TTL_MS = 60_000;

interface Entry {
  at: number;
  data: Candle[];
}

const cache = new Map<string, Entry>();

function key(ticker: string, interval: number, days: number): string {
  return `${ticker}|${interval}|${days}`;
}

export function getCached(
  ticker: string,
  interval: number,
  days: number,
): Candle[] | null {
  const k = key(ticker, interval, days);
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.at > TTL_MS) {
    cache.delete(k);
    return null;
  }
  return e.data;
}

export function setCached(
  ticker: string,
  interval: number,
  days: number,
  data: Candle[],
): void {
  cache.set(key(ticker, interval, days), { at: Date.now(), data });
}

/**
 * Тихо тянет данные в кэш, не бросает наверх.
 * Вызывается на hover/focus по тикеру.
 */
export async function prefetchHistory(
  ticker: string,
  interval: number,
  days: number,
): Promise<void> {
  if (getCached(ticker, interval, days)) return;
  try {
    const r = await fetch(
      `/api/history/${encodeURIComponent(ticker)}?interval=${interval}&days=${days}`,
    );
    const j = await r.json();
    if (j.ok && Array.isArray(j.data)) {
      setCached(ticker, interval, days, j.data as Candle[]);
    }
  } catch {
    // сетевая ошибка — игнорируем, диалог сам сходит за данными
  }
}
