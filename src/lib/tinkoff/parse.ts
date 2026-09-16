// language: TypeScript, target: T-Invest response normalization
// Нормализация ответов T-Invest API в наши доменные типы.

import type { MoneyValue, TinkoffPosition } from './types';
import type { Position } from '@/types';
import {
  operationKindFromRaw,
  type TinkoffOperation,
  type Operation,
} from './operations-types';

/**
 * MoneyValue → number. Например: {units: "10", nano: 500000000} → 10.5
 */
export function moneyToNumber(m: MoneyValue | undefined): number {
  if (!m) return 0;
  const units = parseInt(m.units || '0', 10);
  const nano = m.nano || 0;
  return units + nano / 1_000_000_000;
}

/**
 * Количество в позиции. T-Invest отдаёт в MoneyValue — берём целую часть.
 * Для акций quantity всегда целое.
 */
export function quantityToLots(p: TinkoffPosition): number {
  const qty = moneyToNumber(p.quantity);
  return Math.max(0, Math.round(qty));
}

/**
 * Достаёт тикер из instrumentUid через явную карту.
 * Вызывающий передаёт маппинг, собранный из Shares/Bonds/Etf эндпоинтов.
 */
export function resolveTicker(
  p: TinkoffPosition,
  uidToTicker: Map<string, string>,
): string | null {
  return uidToTicker.get(p.instrumentUid) ?? null;
}

/**
 * Нормализует позиции портфеля в наш формат.
 *
 * T-Invest отдаёт figi/instrumentUid, а нам нужны тикеры MOEX.
 * Функция ожидает карту uid → ticker (MOEX SECID).
 * Позиции без тикера — молча отбрасываются (это облигации, фонды и т.п.).
 */
export function normalizePortfolio(
  positions: TinkoffPosition[],
  uidToTicker: Map<string, string>,
  allowedTickers: Set<string>,
): Position[] {
  const result: Position[] = [];
  for (const p of positions) {
    if (p.instrumentType !== 'share') continue;
    const ticker = resolveTicker(p, uidToTicker);
    if (!ticker) continue;
    if (!allowedTickers.has(ticker)) continue;
    const lots = quantityToLots(p);
    if (lots <= 0) continue;
    result.push({ ticker, lots });
  }
  return result;
}


/**
 * Нормализует операцию из T-Invest в наш формат.
 * Тикер ищется через карту uid → ticker. Для операций без бумаги
 * (input/output/tax на весь счёт) ticker = null.
 */
export function normalizeOperation(
  op: TinkoffOperation,
  uidToTicker: Map<string, string>,
): Operation {
  const kind = operationKindFromRaw(op.type);

  const lots = Number(op.quantity) || 0;
  const price = moneyToNumber(op.price);
  const payment = moneyToNumber(op.payment);

  // Тикер: только для операций с бумагами.
  let ticker: string | null = null;
  if (op.instrumentUid && (kind === 'buy' || kind === 'sell' || kind === 'dividend' || kind === 'coupon')) {
    ticker = uidToTicker.get(op.instrumentUid) ?? null;
  }

  return {
    id: op.id,
    date: op.date,
    kind,
    ticker,
    lots: kind === 'buy' || kind === 'sell' ? lots : 0,
    price: kind === 'buy' || kind === 'sell' ? price : 0,
    payment,
    rawType: op.type,
  };
}

export function normalizeOperations(
  ops: TinkoffOperation[],
  uidToTicker: Map<string, string>,
): Operation[] {
  return ops.map((op) => normalizeOperation(op, uidToTicker));
}
