// language: TypeScript, target: Next.js App Router API route
// GET /api/history/[ticker]?interval=24&days=3650
//
// Ответ кэшируется на 5 минут (серверный ISR-кэш + fetch-кэш в client.ts).
// Не делай force-dynamic — ломает кэш.

import { NextRequest, NextResponse } from 'next/server';
import { fetchCandles } from '@/lib/moex/client';

export const runtime = 'nodejs';
export const revalidate = 300;

const ALLOWED_INTERVALS = new Set([1, 10, 60, 24, 7, 31]);

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await ctx.params;
  if (!ticker || ticker.length > 16) {
    return NextResponse.json(
      { ok: false, error: 'invalid ticker' },
      { status: 400 },
    );
  }

  const intervalRaw = parseInt(
    req.nextUrl.searchParams.get('interval') ?? '24',
    10,
  );
  const interval = ALLOWED_INTERVALS.has(intervalRaw) ? intervalRaw : 24;

  const daysRaw = parseInt(
    req.nextUrl.searchParams.get('days') ?? '3650',
    10,
  );
  const days = Math.min(
    Math.max(Number.isFinite(daysRaw) ? daysRaw : 3650, 1),
    3650,
  );

  try {
    const data = await fetchCandles(ticker, interval, days);
    return NextResponse.json(
      {
        ok: true,
        ticker,
        interval,
        days,
        count: data.length,
        updatedAt: new Date().toISOString(),
        data,
      },
      {
        headers: {
          'Cache-Control':
            'public, s-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}
