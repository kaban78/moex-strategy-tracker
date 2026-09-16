// language: TypeScript, target: Next.js App Router API route
// POST /api/backtest
//
// LRU-кэш с лимитом: не даём памяти расти бесконечно.
// При спаме разными параметрами Map без лимита съедает всю память.

import { NextRequest, NextResponse } from 'next/server';
import { runBacktest } from '@/lib/backtest/simulate';
import type { BacktestParams } from '@/lib/backtest/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 20;

interface CacheEntry {
  at: number;
  result: unknown;
}

/**
 * Простой LRU: Map в JS сохраняет порядок вставки.
 * При добавлении — если ключей больше MAX_ENTRIES, удаляем самый старый.
 * Периодически (раз в 100 запросов) чистим протухшие.
 */
class LruCache {
  private map = new Map<string, CacheEntry>();
  private hits = 0;

  get(key: string): CacheEntry | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() - entry.at > TTL_MS) {
      this.map.delete(key);
      return null;
    }
    // Переносим в конец — помечаем как свежий.
    this.map.delete(key);
    this.map.set(key, entry);
    this.hits++;
    if (this.hits % 100 === 0) this.evictStale();
    return entry;
  }

  set(key: string, result: unknown): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { at: Date.now(), result });
    while (this.map.size > MAX_ENTRIES) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  private evictStale(): void {
    const now = Date.now();
    for (const [k, v] of this.map) {
      if (now - v.at > TTL_MS) this.map.delete(k);
    }
  }

  size(): number {
    return this.map.size;
  }
}

const cache = new LruCache();

interface ValidationResult {
  ok: true;
  params: BacktestParams;
}
interface ValidationFail {
  ok: false;
  error: string;
}

function validate(body: unknown): ValidationResult | ValidationFail {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'body must be object' };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.startDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.startDate)) {
    return { ok: false, error: 'startDate must be YYYY-MM-DD' };
  }
  if (typeof b.endDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.endDate)) {
    return { ok: false, error: 'endDate must be YYYY-MM-DD' };
  }
  if (b.startDate >= b.endDate) {
    return { ok: false, error: 'startDate must be < endDate' };
  }

  const initialCapital = Number(b.initialCapital);
  if (!Number.isFinite(initialCapital) || initialCapital <= 0 || initialCapital > 1e10) {
    return { ok: false, error: 'initialCapital must be 0 < x <= 1e10' };
  }

  const monthlyTopUp = Number(b.monthlyTopUp);
  if (!Number.isFinite(monthlyTopUp) || monthlyTopUp < 0 || monthlyTopUp > 1e9) {
    return { ok: false, error: 'monthlyTopUp must be 0 <= x <= 1e9' };
  }

  const commissionRate = Number(b.commissionRate);
  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 0.1) {
    return { ok: false, error: 'commissionRate must be 0 <= x <= 0.1' };
  }

  return {
    ok: true,
    params: { startDate: b.startDate, endDate: b.endDate, initialCapital, monthlyTopUp, commissionRate },
  };
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

  const v = validate(body);
  if (!v.ok) {
    return NextResponse.json(
      { ok: false, error: v.error },
      { status: 400 },
    );
  }

  const key = JSON.stringify(v.params);
  const cached = cache.get(key);
  if (cached) {
    return NextResponse.json({ ok: true, result: cached.result, cached: true });
  }

  try {
    const result = await runBacktest(v.params);
    cache.set(key, result);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json(
      { ok: false, error: message },
      { status: 502 },
    );
  }
}
