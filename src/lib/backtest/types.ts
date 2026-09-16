// language: TypeScript, target: backtest domain types
// Типы бэктеста. Чистые данные, без побочных эффектов.

export interface BacktestParams {
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** Стартовый капитал, руб. */
  initialCapital: number;
  /** Ежемесячное пополнение, руб. */
  monthlyTopUp: number;
  /** Комиссия брокера на сделку, 0..1. По умолчанию 0.0005 (0.05%). */
  commissionRate: number;
}

export interface MonthSnapshot {
  /** Торговый день, на который сделан снапшот. */
  date: string;
  /** Стоимость позиций, руб. */
  positionsValue: number;
  /** Свободный кэш, руб. */
  cash: number;
  /** positionsValue + cash. */
  totalValue: number;
  /** Сколько всего вложено с учётом пополнений, руб. */
  invested: number;
  /** Сколько стоил бы IMOEX, если бы все вложения шли в индекс. */
  benchmarkValue: number;
  /** Сколько позиций в портфеле. */
  positionsCount: number;
  /** Суммарная omission weight на эту дату, 0..1. */
  omissionWeight: number;
}

export interface BacktestMetrics {
  /** Финальная стоимость портфеля, руб. */
  finalValue: number;
  /** Всего вложено, руб. */
  totalInvested: number;
  /** (finalValue − totalInvested) / totalInvested. */
  totalReturn: number;
  /** Годовая доходность, 0..1. */
  cagr: number;
  /** Максимальная просадка от пика, 0..1 (положительное число). */
  maxDrawdown: number;
  /** Tracking error vs IMOEX, годовых, 0..1. */
  trackingError: number;
  /** Финальная стоимость бенчмарка, руб. */
  benchmarkFinalValue: number;
  /** CAGR бенчмарка, 0..1. */
  benchmarkCagr: number;
  /** Max drawdown бенчмарка, 0..1. */
  benchmarkMaxDrawdown: number;
}

export interface BacktestResult {
  params: BacktestParams;
  snapshots: MonthSnapshot[];
  metrics: BacktestMetrics;
}
