// language: TypeScript, target: Next.js App Router API route
// POST /api/tinkoff/operations
// Body: { token, accountId, from?, till? }
// Возвращает нормализованные операции за период (по умолчанию 3 года).

import { NextRequest, NextResponse } from 'next/server';
import { fetchOperations, fetchTickerMaps } from '@/lib/tinkoff/client';
import { normalizeOperations } from '@/lib/tinkoff/parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_YEARS = 5;

interface Body {
  token?: string;
  accountId?: string;
  from?: string;
  till?: string;
}

function isValidDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v);
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
  const accountId = body.accountId?.trim();
  if (!token || token.length < 20) {
    return NextResponse.json(
      { ok: false, error: 'token required' },
      { status: 400 },
    );
  }
  if (!accountId) {
    return NextResponse.json(
      { ok: false, error: 'accountId required' },
      { status: 400 },
    );
  }

  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setUTCFullYear(defaultFrom.getUTCFullYear() - DEFAULT_YEARS);

  const from = body.from && isValidDate(body.from)
    ? body.from
    : defaultFrom.toISOString().slice(0, 10);
  const till = body.till && isValidDate(body.till)
    ? body.till
    : today.toISOString().slice(0, 10);

  if (from >= till) {
    return NextResponse.json(
      { ok: false, error: 'from must be < till' },
      { status: 400 },
    );
  }

  try {
    const [rawOps, maps] = await Promise.all([
      fetchOperations(token, accountId, from, till),
      fetchTickerMaps(token),
    ]);

    const operations = normalizeOperations(rawOps, maps.uidToTicker);

    return NextResponse.json({
      ok: true,
      count: operations.length,
      from,
      till,
      operations,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}
