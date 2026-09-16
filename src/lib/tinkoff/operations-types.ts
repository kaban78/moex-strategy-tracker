// language: TypeScript, target: T-Invest operations types
// Сделки, дивиденды, налоги, комиссии, пополнения/выводы.

import type { MoneyValue } from './types';

export interface TinkoffOperation {
  id: string;
  parentOperationId: string;
  currency: string;
  payment: MoneyValue;
  price: MoneyValue;
  quantity: string;
  quantityRest: string;
  figi: string;
  instrumentType: string;
  date: string;
  type: string;
  operationType: string;
  state: string;
  instrumentUid: string;
}

export interface GetOperationsResponse {
  operations: TinkoffOperation[];
}

export type OperationKind =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'coupon'
  | 'tax'
  | 'fee'
  | 'input'
  | 'output'
  | 'other';

export interface Operation {
  id: string;
  /** ISO-8601. */
  date: string;
  kind: OperationKind;
  /** Тикер MOEX. null для пополнений/выводов. */
  ticker: string | null;
  /** Количество лотов (для buy/sell). 0 для прочих. */
  lots: number;
  /** Цена за акцию в рублях. 0 для дивидендов/налогов/пополнений. */
  price: number;
  /** Денежный поток. Отрицательный — отток. */
  payment: number;
  /** Оригинальное название типа (для отладки). */
  rawType: string;
}

/**
 * Маппинг T-Invest type → OperationKind.
 * T-Invest может отдавать как enum (OPERATION_TYPE_BUY), так и
 * локализованные строки на русском — обрабатываем оба варианта.
 */
export function operationKindFromRaw(raw: string): OperationKind {
  const s = raw.toLowerCase();

  // Английские enum
  if (s === 'operation_type_buy' || s === 'operation_type_buy_card') {
    return 'buy';
  }
  if (s === 'operation_type_sell' || s === 'operation_type_sell_card') {
    return 'sell';
  }
  if (s === 'operation_type_dividend') return 'dividend';
  if (s === 'operation_type_coupon') return 'coupon';
  if (
    s === 'operation_type_tax' ||
    s === 'operation_type_bond_tax' ||
    s === 'operation_type_input_tax' ||
    s === 'operation_type_dividend_tax'
  ) {
    return 'tax';
  }
  if (
    s === 'operation_type_broker_fee' ||
    s === 'operation_type_service_fee' ||
    s === 'operation_type_margin_fee' ||
    s === 'operation_type_success_fee'
  ) {
    return 'fee';
  }
  if (s === 'operation_type_input' || s === 'operation_type_inp_multi') {
    return 'input';
  }
  if (s === 'operation_type_output' || s === 'operation_type_out_multi') {
    return 'output';
  }

  // Русские строки
  if (s.includes('покупка ценных бумаг')) return 'buy';
  if (s.includes('продажа ценных бумаг')) return 'sell';
  if (s.includes('выплата дивидендов')) return 'dividend';
  if (s.includes('выплата купона') || s.includes('купонный доход')) return 'coupon';
  if (s.includes('налог')) return 'tax';
  if (s.includes('комисси')) return 'fee';
  if (s.includes('пополнение')) return 'input';
  if (s.includes('вывод')) return 'output';

  return 'other';
}
