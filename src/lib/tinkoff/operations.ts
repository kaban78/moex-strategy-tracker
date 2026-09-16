// language: TypeScript, target: T-Invest operations client
// История операций по счёту. T-Invest ограничивает диапазон запроса
// одним годом — бьём на куски по 12 месяцев.

import { post, SERVICE_OPS } from './http';
import type { GetOperationsResponse, TinkoffOperation } from './operations-types';

/**
 * Скачивает все операции за диапазон [from, till] (ISO YYYY-MM-DD).
 * Разбивает на годовые чанки: T-Invest не даёт больше года за запрос.
 */
export async function fetchOperations(
  token: string,
  accountId: string,
  from: string,
  till: string,
): Promise<TinkoffOperation[]> {
  const chunks = splitByYear(from, till);
  const all: TinkoffOperation[] = [];

  for (const [chunkFrom, chunkTill] of chunks) {
    const data = await post<GetOperationsResponse>({
      token,
      path: `${SERVICE_OPS}/GetOperations`,
      body: {
        accountId,
        from: `${chunkFrom}T00:00:00Z`,
        to: `${chunkTill}T23:59:59Z`,
        state: 'OPERATION_STATE_EXECUTED',
      },
    });
    if (data.operations) {
      all.push(...data.operations);
    }
  }

  // Сортируем по дате, новые сверху.
  all.sort((a, b) => b.date.localeCompare(a.date));
  return all;
}

function splitByYear(from: string, till: string): [string, string][] {
  const result: [string, string][] = [];
  let cursor = new Date(from + 'T00:00:00Z');
  const end = new Date(till + 'T00:00:00Z');

  while (cursor < end) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setUTCFullYear(chunkEnd.getUTCFullYear() + 1);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() - 1);

    const chunkTill = chunkEnd > end ? end : chunkEnd;
    result.push([
      cursor.toISOString().slice(0, 10),
      chunkTill.toISOString().slice(0, 10),
    ]);

    cursor = new Date(chunkEnd);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}
