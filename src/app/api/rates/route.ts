// language: TypeScript, target: Next.js App Router API route
// GET /api/rates?from=YYYY-MM-DD&till=YYYY-MM-DD
// Возвращает ключевую ставку ЦБ и среднюю ставку по вкладам.

import { NextRequest, NextResponse } from 'next/server';
import { fetchKeyRate, fetchDepositRate } from '@/lib/cbr/client';

export const runtime = 'nodejs';
export const revalidate = 21600;

export async function GET(req: NextRequest) {
  const from = req.nextUrl.searchParams.get('from');
  const till = req.nextUrl.searchParams.get('till');

  if (!from || !till || from >= till) {
    return NextResponse.json(
      { ok: false, error: 'invalid date range' },
      { status: 400 },
    );
  }

  try {
    const [keyRate, depositRate] = await Promise.all([
      fetchKeyRate(from, till),
      fetchDepositRate(from, till),
    ]);
    return NextResponse.json({
      ok: true,
      keyRate,
      depositRate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}
