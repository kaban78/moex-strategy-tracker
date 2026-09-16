// language: TypeScript, target: Next.js App Router API route
// POST /api/backtest
// Body: BacktestParams
// Response: { ok: true, result: BacktestResult }
//
// Бэктест может идти 20-60 секунд: нужно загрузить состав индекса
// на ~80 месячных дат и цены по ~50 тикерам. Next.js API-роут
// держит соединение пока функция не вернёт результат.
//
// Кэш: результаты в памяти процесса. Ключ — JSON params.
// Это безопасно, потому что params детерминированны.

import { NextRequest, NextResponse } from 'next/server';
import { runBacktest } from '@/lib/backtest/simulate';
import type { BacktestParams } from '@/lib/backtest/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CacheEntry {
  at: number;
  result: unknown;
}

const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function validate(body: unknown): body is BacktestParams {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.startDate === 'string' &&
    typeof b.endDate === 'string' &&
    typeof b.initialCapital === 'number' &&
    typeof b.monthlyTopUp === 'number' &&
    typeof b.commissionRate === 'number' &&
    b.initialCapital > 0 &&
    b.monthlyTopUp >= 0 &&
    b.commissionRate >= 0 &&
    b.startDate < b.endDate
  );
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid JSON' },
      { status: 400 },
    );
  }

  if (!validate(body)) {
    return NextResponse.json(
      { ok: false, error: 'invalid params' },
      { status: 400 },
    );
  }

  const key = JSON.stringify(body);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json({ ok: true, result: cached.result, cached: true });
  }

  try {
    const result = await runBacktest(body);
    cache.set(key, { at: Date.now(), result });
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}
