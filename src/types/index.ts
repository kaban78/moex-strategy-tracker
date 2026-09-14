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
  /** Доля акций в свободном обращении, 0..1. */
  freeFloat: number;
  /** Полная капитализация, руб. */
  mcap: number;
  /** Текущий вес в IMOEX, %. */
  indexWeight: number;
  /** Дивдоходность за 12 мес, 0..1. */
  dividendYield: number;
}

/** Позиция в портфеле. */
export interface Position {
  ticker: string;
  lots: number;
  /** Средняя цена покупки, если известна. */
  avgPrice?: number;
}

/** Целевой вес бумаги. */
export interface TargetWeight {
  ticker: string;
  /** Вес, 0..1. Сумма весов = 1. */
  weight: number;
}
