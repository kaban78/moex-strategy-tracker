// language: TypeScript, target: T-Invest response normalization
// Нормализация ответов T-Invest API в наши доменные типы.

import type { MoneyValue, TinkoffPosition } from './types';
import type { Position } from '@/types';

/**
 * MoneyValue → number. Например: {units: "10", nano: 500000000} → 10.5
 */
export function moneyToNumber(m: MoneyValue | undefined): number {
  if (!m) return 0;
  const units = parseInt(m.units || '0', 10);
  const nano = m.nano || 0;
  const sign = units < 0 ? -1 : 1;
  return units + sign * (nano / 1_000_000_000);
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
