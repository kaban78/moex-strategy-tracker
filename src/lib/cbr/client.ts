// language: TypeScript, target: CBR RF SOAP client
//
// Ключевая ставка ЦБ РФ и средняя ставка по вкладам топ-10 банков.
// Источник: cbr.ru, SOAP-сервисы DailyInfo и SecInfo.
//
// Формат ответа (проверено 2026-09):
//   <KeyRateXMLResult>
//     <KeyRate><KR><DT>...</DT><Rate>21.00</Rate></KR>...</KeyRate>
//   </KeyRateXMLResult>
// Внутри KR — вложенные теги, не атрибуты.

import { XMLParser } from 'fast-xml-parser';

const DAILY_INFO = 'https://www.cbr.ru/dailyinfowebserv/dailyinfo.asmx';
const SEC_INFO = 'https://www.cbr.ru/secinfo/secinfo.asmx';

const USER_AGENT =
  'moex-strategy-tracker/0.1 (personal use, informational tool)';

const CACHE_TTL = 6 * 60 * 60 * 1000;

export interface RatePoint {
  date: string;
  value: number;
}

interface CacheEntry<T> {
  at: number;
  data: T;
}

const keyRateCache = new Map<string, CacheEntry<RatePoint[]>>();
const depositRateCache = new Map<string, CacheEntry<RatePoint[]>>();

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'KR' || name === 'Avgprocstav',
  trimValues: true,
  parseTagValue: false,
});

async function soapRequest(
  url: string,
  action: string,
  body: string,
): Promise<string> {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:xsd="http://www.w3.org/2001/XMLSchema"
  xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>${body}</soap:Body>
</soap:Envelope>`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: action,
      'User-Agent': USER_AGENT,
    },
    body: envelope,
    next: { revalidate: 21600 },
  });

  if (!res.ok) {
    throw new Error(`CBR ${action} → HTTP ${res.status}`);
  }
  return await res.text();
}

function isoToCbrDate(iso: string): string {
  return `${iso}T00:00:00`;
}

interface KrRow {
  DT?: string | { '#text'?: string };
  Rate?: string | number | { '#text'?: string | number };
}

function pickText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && '#text' in v) {
    const t = (v as { '#text'?: unknown })['#text'];
    return typeof t === 'string' || typeof t === 'number' ? String(t) : '';
  }
  return '';
}

function krRowsToPoints(rows: unknown): RatePoint[] {
  if (!Array.isArray(rows)) return [];
  const points: RatePoint[] = [];
  for (const raw of rows) {
    const r = raw as KrRow;
    const dateStr = pickText(r.DT).slice(0, 10);
    const rate = Number(pickText(r.Rate));
    if (dateStr && Number.isFinite(rate)) {
      points.push({ date: dateStr, value: rate });
    }
  }
  points.sort((a, b) => a.date.localeCompare(b.date));
  return points;
}

export async function fetchKeyRate(
  from: string,
  till: string,
): Promise<RatePoint[]> {
  const key = `${from}|${till}`;
  const cached = keyRateCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data;

  const body = `<KeyRateXML xmlns="http://web.cbr.ru/">
    <fromDate>${isoToCbrDate(from)}</fromDate>
    <ToDate>${isoToCbrDate(till)}</ToDate>
  </KeyRateXML>`;

  const xml = await soapRequest(
    DAILY_INFO,
    'http://web.cbr.ru/KeyRateXML',
    body,
  );

  const parsed = parser.parse(xml);
  const result =
    parsed?.['soap:Envelope']?.['soap:Body']?.['KeyRateXMLResponse']?.[
      'KeyRateXMLResult'
    ];

  // result.KeyRate.KR[] — массив записей.
  const keyRateObj = result?.KeyRate as { KR?: unknown } | undefined;
  const points = krRowsToPoints(keyRateObj?.KR);

  keyRateCache.set(key, { at: Date.now(), data: points });
  return points;
}

export async function fetchDepositRate(
  from: string,
  till: string,
): Promise<RatePoint[]> {
  const key = `${from}|${till}`;
  const cached = depositRateCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) return cached.data;

  const body = `<Avgprocstav xmlns="http://web.cbr.ru/">
    <DateFrom>${isoToCbrDate(from)}</DateFrom>
    <DateTo>${isoToCbrDate(till)}</DateTo>
  </Avgprocstav>`;

  const xml = await soapRequest(
    SEC_INFO,
    'http://web.cbr.ru/Avgprocstav',
    body,
  );

  const parsed = parser.parse(xml);
  const result =
    parsed?.['soap:Envelope']?.['soap:Body']?.['AvgprocstavResponse']?.[
      'AvgprocstavResult'
    ];

  // result — объект с массивом Avgprocstav.
  const points = krRowsToPoints(result?.Avgprocstav);

  depositRateCache.set(key, { at: Date.now(), data: points });
  return points;
}

export function rateOn(points: RatePoint[], date: string): number | null {
  if (points.length === 0) return null;
  if (date < points[0].date) return null;

  let lo = 0;
  let hi = points.length - 1;
  let best: number | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].date <= date) {
      best = points[mid].value;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}
