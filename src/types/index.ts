// language: TypeScript, target: domain types
// Доменные типы. Чистые данные, без побочных эффектов.

/** Бумага во вселенной. */
export interface Ticker {
  ticker: string;
  name: string;
  lotSize: number;
  price: number;
  /** Средний дневной оборот в рублях. */
  avgDailyVolume: number;
  /** Текущий вес в IMOEX, %. */
  indexWeight: number;
}

/** Позиция в портфеле. */
export interface Position {
  ticker: string;
  lots: number;
}

/** Целевой вес бумаги. */
export interface TargetWeight {
  ticker: string;
  /** Вес, 0..1. Сумма весов = 1. */
  weight: number;
}
