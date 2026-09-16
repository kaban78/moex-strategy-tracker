// language: TypeScript, target: trading calendar
// Торговый календарь MOEX. Строится из истории SBER — он торгуется
// с 2013 без длинных пауз, его даты совпадают с торговыми днями MOEX.
//
// ISS отдаёт максимум 100 записей за запрос. Используем пагинацию через
// параметр start, чтобы собрать полный диапазон.

import { parseIssTable, type IssTable } from '@/lib/moex/parse';

const ISS_BASE = 'https://iss.moex.com/iss';
const USER_AGENT =
  'moex-strategy-tracker/0.1 (personal use, informational tool)';
const PAGE_SIZE = 100;
const MAX_PAGES = 60;

interface IssJson {
  [key: string]: IssTable | undefined;
}

interface HistoryRow {
  TRADEDATE: string;
}

const cache = new Map<string, string[]>();

async function fetchPage(
  from: string,
  till: string,
  start: number,
): Promise<string[]> {
  const url = new URL(
    `${ISS_BASE}/history/engines/stock/markets/shares/boards/TQBR/securities/SBER.json`,
  );
  url.searchParams.set('from', from);
  url.searchParams.set('till', till);
  url.searchParams.set('start', String(start));
  url.searchParams.set('history.columns', 'TRADEDATE');
  url.searchParams.set('iss.meta', 'off');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': USER_AGENT },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`MOEX calendar ${from}..${till} → HTTP ${res.status}`);
  }
  const json = (await res.json()) as IssJson;
  const rows = parseIssTable<HistoryRow>(json.history);
  return rows.map((r) => r.TRADEDATE).filter(Boolean);
}

async function fetchTradingDaysFromIss(
  from: string,
  till: string,
): Promise<string[]> {
  const all: string[] = [];
  let start = 0;
  for (let p = 0; p < MAX_PAGES; p++) {
    const page = await fetchPage(from, till, start);
    if (page.length === 0) break;
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    start += page.length;
  }
  return Array.from(new Set(all)).sort();
}

export async function getTradingDays(
  from: string,
  till: string,
): Promise<string[]> {
  const key = `${from}|${till}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const days = await fetchTradingDaysFromIss(from, till);
  cache.set(key, days);
  return days;
}

export function nearestTradingDay(
  target: string,
  calendar: string[],
): string | null {
  if (calendar.length === 0) return null;
  if (target < calendar[0]) return null;

  let lo = 0;
  let hi = calendar.length - 1;
  let best: string | null = null;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (calendar[mid] <= target) {
      best = calendar[mid];
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

export function monthStarts(
  from: string,
  till: string,
  calendar: string[],
): string[] {
  const result: string[] = [];
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(till + 'T00:00:00Z');

  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
  );
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    const trading = nearestTradingDay(iso, calendar);
    if (trading && (!result.length || result[result.length - 1] !== trading)) {
      result.push(trading);
    }
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return result;
}
