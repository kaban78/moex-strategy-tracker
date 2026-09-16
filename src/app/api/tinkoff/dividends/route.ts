// language: TypeScript, target: Next.js App Router API route
// POST /api/tinkoff/dividends
//
// T-Invest режет запросы при высокой параллельности. Работаем батчами
// по CONCURRENT штук с retry и backoff.

import { NextRequest, NextResponse } from 'next/server';
import { fetchDividends, fetchTickerMaps } from '@/lib/tinkoff/client';
import type { TinkoffDividend } from '@/lib/tinkoff/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  token?: string;
  tickers?: string[];
}

const CONCURRENT = 4;
const MAX_TICKERS = 60;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchDividendsWithRetry(
  token: string,
  uid: string,
): Promise<TinkoffDividend[]> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fetchDividends(token, uid);
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : '';
      // 429 или 5xx — повторяем. 4xx — выходим сразу.
      const isRetryable =
        msg.includes('429') ||
        msg.includes('500') ||
        msg.includes('502') ||
        msg.includes('503') ||
        msg.includes('504');
      if (!isRetryable || attempt === MAX_RETRIES) break;
      await sleep(RETRY_DELAY_MS * Math.pow(2, attempt));
    }
  }
  throw lastError;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid JSON' },
      { status: 400 },
    );
  }

  const token = body.token?.trim();
  if (!token || token.length < 20) {
    return NextResponse.json(
      { ok: false, error: 'token required' },
      { status: 400 },
    );
  }

  const tickers = (body.tickers ?? []).map((t) => t.toUpperCase().trim());
  if (tickers.length === 0) {
    return NextResponse.json({ ok: true, dividendsByTicker: {} });
  }
  if (tickers.length > MAX_TICKERS) {
    return NextResponse.json(
      { ok: false, error: `too many tickers (max ${MAX_TICKERS})` },
      { status: 400 },
    );
  }

  try {
    const maps = await fetchTickerMaps(token);
    const tok: string = token;

    type Result =
      | { ticker: string; divs: TinkoffDividend[] }
      | { ticker: string; error: string };

    const results: Result[] = new Array(tickers.length);
    let cursor = 0;

    async function worker() {
      while (true) {
        const i = cursor++;
        if (i >= tickers.length) return;
        const ticker = tickers[i];
        const uid = maps.tickerToUid.get(ticker);
        if (!uid) {
          results[i] = { ticker, error: 'instrumentUid not found' };
          continue;
        }
        try {
          const divs = await fetchDividendsWithRetry(tok, uid);
          results[i] = { ticker, divs };
        } catch (e) {
          results[i] = {
            ticker,
            error: e instanceof Error ? e.message : 'fetch error',
          };
        }
      }
    }

    await Promise.all(
      Array.from(
        { length: Math.min(CONCURRENT, tickers.length) },
        () => worker(),
      ),
    );

    const dividendsByTicker: Record<string, TinkoffDividend[]> = {};
    const errors: { ticker: string; error: string }[] = [];

    for (const r of results) {
      if ('error' in r && r.error) {
        errors.push({ ticker: r.ticker, error: r.error });
      } else if ('divs' in r && r.divs) {
        dividendsByTicker[r.ticker] = r.divs;
      }
    }

    return NextResponse.json({
      ok: true,
      dividendsByTicker,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}
