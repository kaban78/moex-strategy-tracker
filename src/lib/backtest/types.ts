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
  /** IMOEX без дивидендов. */
  benchmarkValue: number;
  /** MCFTR с дивидендами. */
  benchmarkTotalReturnValue: number;
  positionsCount: number;
  omissionWeight: number;
}

export interface BacktestMetrics {
  finalValue: number;
  totalInvested: number;
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  trackingError: number;
  benchmarkFinalValue: number;
  benchmarkCagr: number;
  benchmarkMaxDrawdown: number;
  /** MCFTR финальная стоимость. */
  benchmarkTotalReturnFinalValue: number;
  /** CAGR MCFTR. */
  benchmarkTotalReturnCagr: number;
  /** Max drawdown MCFTR. */
  benchmarkTotalReturnMaxDrawdown: number;
}

export interface BacktestResult {
  params: BacktestParams;
  snapshots: MonthSnapshot[];
  metrics: BacktestMetrics;
}
