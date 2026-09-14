// language: TypeScript, target: Next.js App Router API route
// GET /api/universe — состав IMOEX с весами и ценами.
// Проксирует MOEX ISS, чтобы обойти CORS и закэшировать на сервере.

import { NextResponse } from 'next/server';
import { fetchUniverse } from '@/lib/moex/client';

export const runtime = 'nodejs';
export const revalidate = 300; // 5 минут

export async function GET() {
  try {
    const universe = await fetchUniverse();

    return NextResponse.json({
      ok: true,
      count: universe.length,
      universe,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}
