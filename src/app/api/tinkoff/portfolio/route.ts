// language: TypeScript, target: Next.js App Router API route
// POST /api/tinkoff/portfolio
// Body: { token: string, accountId: string }
// Response: {
//   ok: true,
//   positions: Position[],           // нормализованные, только акции MOEX
//   rawCount: number,                // сколько всего позиций было
//   skippedCount: number,            // сколько отброшено (облигации, фонды, чужие тикеры)
//   totalValue?: MoneyValue,
// }
//
// Проксирует запрос к T-Invest API, нормализует тикеры через Shares endpoint.

import { NextRequest, NextResponse } from 'next/server';
import {
  fetchPortfolio,
  fetchSharesUidMap,
} from '@/lib/tinkoff/client';
import { normalizePortfolio } from '@/lib/tinkoff/parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  token?: string;
  accountId?: string;
  allowedTickers?: string[];
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

  const allowed = new Set(
    (body.allowedTickers ?? []).map((t) => t.toUpperCase()),
  );

  try {
    const [portfolio, uidMap] = await Promise.all([
      fetchPortfolio(token, accountId),
      fetchSharesUidMap(token),
    ]);

    const positions = normalizePortfolio(
      portfolio.positions,
      uidMap,
      allowed,
    );

    return NextResponse.json({
      ok: true,
      positions,
      rawCount: portfolio.positions.length,
      skippedCount: portfolio.positions.length - positions.length,
      totalValue: portfolio.totalAmountPortfolio ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}
