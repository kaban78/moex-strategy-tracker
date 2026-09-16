// language: TypeScript, target: CBR RF SOAP client
// Ключевая ставка ЦБ РФ и средняя ставка по вкладам топ-10 банков.
// Источник: cbr.ru, SOAP-сервисы DailyInfo и SecInfo.
//
// Кэш в памяти процесса: 6 часов.

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
  // YYYY-MM-DD → YYYY-MM-DDT00:00:00
  return `${iso}T00:00:00`;
}

/**
 * Ключевая ставка ЦБ РФ за диапазон.
 * Отдаёт одну точку на каждое изменение ставки.
 */
export async function fetchKeyRate(
  from: string,
  till: string,
): Promise<RatePoint[]> {
  const key = `${from}|${till}`;
  const cached = keyRateCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return cached.data;
  }

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

  const points: RatePoint[] = [];
  const rows = result?.KeyRate?.KR;
  if (Array.isArray(rows)) {
    for (const r of rows) {
      const date = String(r['@_DT'] ?? '').slice(0, 10);
      const rate = Number(r['@_Rate']);
      if (date && Number.isFinite(rate)) {
        points.push({ date, value: rate });
      }
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  keyRateCache.set(key, { at: Date.now(), data: points });
  return points;
}

/**
 * Средняя максимальная ставка по вкладам в рублях
 * в топ-10 банках РФ, % годовых.
 */
export async function fetchDepositRate(
  from: string,
  till: string,
): Promise<RatePoint[]> {
  const key = `${from}|${till}`;
  const cached = depositRateCache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return cached.data;
  }

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

  const points: RatePoint[] = [];
  const rows = result?.Avgprocstav;
  if (Array.isArray(rows)) {
    for (const r of rows) {
      const date = String(r['@_DT'] ?? '').slice(0, 10);
      const rate = Number(r['@_Rate']);
      if (date && Number.isFinite(rate)) {
        points.push({ date, value: rate });
      }
    }
  }

  points.sort((a, b) => a.date.localeCompare(b.date));
  depositRateCache.set(key, { at: Date.now(), data: points });
  return points;
}

/**
 * Ставка на дату — ближайшее предыдущее значение.
 */
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
