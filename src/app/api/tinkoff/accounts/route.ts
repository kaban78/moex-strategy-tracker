// language: TypeScript, target: Next.js App Router API route
// POST /api/tinkoff/accounts
// Body: { token: string }
// Response: { ok: true, accounts: Account[] }
//
// Проксирует запрос к T-Invest API. Токен не сохраняется на сервере.

import { NextRequest, NextResponse } from 'next/server';
import { fetchAccounts } from '@/lib/tinkoff/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Body {
  token?: string;
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

  try {
    const accounts = await fetchAccounts(token);
    return NextResponse.json({ ok: true, accounts });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}
