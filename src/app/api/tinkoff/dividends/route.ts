// language: TypeScript, target: Next.js App Router API route
// POST /api/tinkoff/dividends
// Body: { token, tickers: string[] }
// Response: { ok: true, dividendsByTicker: { [ticker]: TinkoffDividend[] } }
//
// Получает дивиденды по каждой бумаге параллельно.
// Токен не сохраняется на сервере.

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchDividends,
  fetchSharesTickerMap,
} from '@/lib/tinkoff/client';
import type { TinkoffDividend } from '@/lib/tinkoff/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  token?: string;
  tickers?: string[];
}

interface ErrorItem {
  ticker: string;
  error: string;
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
  if (tickers.length > 60) {
    return NextResponse.json(
      { ok: false, error: 'too many tickers (max 60)' },
      { status: 400 },
    );
  }

  try {
    const tickerMap = await fetchSharesTickerMap(token);

    // TS: narrowing token не работает в замыкании worker.
    const tok: string = token;
    const CONCURRENT = 6;
    const results: (
      | { ticker: string; divs: TinkoffDividend[] }
      | { ticker: string; error: string }
    )[] = new Array(tickers.length);

    let cursor = 0;
    async function worker() {
      while (true) {
        const i = cursor++;
        if (i >= tickers.length) return;
        const ticker = tickers[i];
        const uid = tickerMap.get(ticker);
        if (!uid) {
          results[i] = { ticker, error: 'instrumentUid not found' };
          continue;
        }
        try {
          const divs = await fetchDividends(tok, uid);
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
    const errors: ErrorItem[] = [];

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
