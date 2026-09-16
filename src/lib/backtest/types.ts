// language: TypeScript, target: backtest domain types

export interface BacktestParams {
  startDate: string;
  endDate: string;
  initialCapital: number;
  monthlyTopUp: number;
  commissionRate: number;
}

export interface MonthSnapshot {
  date: string;
  positionsValue: number;
  cash: number;
  totalValue: number;
  invested: number;
  benchmarkValue: number;
  benchmarkTotalReturnValue: number;
  imoexPrice: number;
  mcftrPrice: number;
  depositValue: number;
  positionsCount: number;
  omissionWeight: number;
}

export interface SeriesMetrics {
  finalValue: number;
  totalInvested: number;
  /** finalValue − totalInvested, ₽. */
  absoluteReturn: number;
  /** XIRR (годовых, доля). NaN если не считается. */
  xirr: number;
  /** Max drawdown на NAV, 0..1. */
  maxDrawdown: number;
}

export interface BacktestMetrics {
  imoexPriceCagr: number;
  mcftrPriceCagr: number;
  portfolio: SeriesMetrics;
  imoexDca: SeriesMetrics;
  mcftrDca: SeriesMetrics;
  deposit: SeriesMetrics;
  trackingError: number;
}

export interface BacktestResult {
  params: BacktestParams;
  snapshots: MonthSnapshot[];
  metrics: BacktestMetrics;
}
