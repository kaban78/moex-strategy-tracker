// language: TypeScript, target: T-Invest HTTP client base
// Единственная точка fetch к T-Invest API.
// Токен передаётся извне при каждом вызове. Не хранится в модуле.

const BASE = 'https://invest-public-api.tinkoff.ru/rest';

export const SERVICE_USERS =
  'tinkoff.public.invest.api.contract.v1.UsersService';
export const SERVICE_OPS =
  'tinkoff.public.invest.api.contract.v1.OperationsService';
export const SERVICE_INSTRUMENTS =
  'tinkoff.public.invest.api.contract.v1.InstrumentsService';

export interface RequestOptions {
  token: string;
  path: string;
  body: Record<string, unknown>;
}

/**
 * POST к T-Invest API. Расширенный лог ошибок: T-Invest отдаёт
 * причину в err.cause, обычный err.message — просто "fetch failed".
 */
export async function post<T>({
  token,
  path,
  body,
}: RequestOptions): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch (cause) {
    const c = cause as { message?: string; cause?: unknown };
    const inner = c.cause
      ? (c.cause as { message?: string; code?: string })
      : null;
    const detail = [c.message, inner?.code, inner?.message]
      .filter(Boolean)
      .join(' / ');
    throw new Error(`T-Invest fetch failed: ${detail || 'unknown'}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `T-Invest ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`,
    );
  }

  return (await res.json()) as T;
}
