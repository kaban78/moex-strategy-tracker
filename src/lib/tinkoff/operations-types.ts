// language: TypeScript, target: T-Invest operations types
// Сделки, дивиденды, налоги, комиссии, пополнения/выводы.

import type { MoneyValue } from './types';

/** Сырая операция из T-Invest API. */
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

/** Категория операции для UI. */
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

/** Нормализованная операция. */
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
  /** Денежный поток. Отрицательный — отток (покупка, налог, вывод). */
  payment: number;
  /** Оригинальное название типа (для отладки). */
  rawType: string;
}

/** Маппинг T-Invest type → наш OperationKind. */
export function operationKindFromRaw(raw: string): OperationKind {
  switch (raw) {
    case 'OPERATION_TYPE_BUY':
    case 'OPERATION_TYPE_BUY_CARD':
      return 'buy';
    case 'OPERATION_TYPE_SELL':
    case 'OPERATION_TYPE_SELL_CARD':
      return 'sell';
    case 'OPERATION_TYPE_DIVIDEND':
    case 'OPERATION_TYPE_DIVIDEND_TAX':
      return raw === 'OPERATION_TYPE_DIVIDEND_TAX' ? 'tax' : 'dividend';
    case 'OPERATION_TYPE_COUPON':
      return 'coupon';
    case 'OPERATION_TYPE_TAX':
    case 'OPERATION_TYPE_BOND_TAX':
    case 'OPERATION_TYPE_INPUT_TAX':
      return 'tax';
    case 'OPERATION_TYPE_BROKER_FEE':
    case 'OPERATION_TYPE_SERVICE_FEE':
    case 'OPERATION_TYPE_MARGIN_FEE':
    case 'OPERATION_TYPE_SUCCESS_FEE':
      return 'fee';
    case 'OPERATION_TYPE_INPUT':
    case 'OPERATION_TYPE_INP_MULTI':
      return 'input';
    case 'OPERATION_TYPE_OUTPUT':
    case 'OPERATION_TYPE_OUT_MULTI':
      return 'output';
    default:
      return 'other';
  }
}
