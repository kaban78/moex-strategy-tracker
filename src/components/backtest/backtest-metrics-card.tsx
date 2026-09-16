'use client';

import type { BacktestMetrics } from '@/lib/backtest/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRub } from '@/lib/format';

interface Props {
  metrics: BacktestMetrics;
}

function pct(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

export function BacktestMetricsCard({ metrics }: Props) {
  const diffTotalReturn =
    metrics.finalValue - metrics.benchmarkTotalReturnFinalValue;
  const diffTotalReturnPct =
    metrics.benchmarkTotalReturnFinalValue > 0
      ? diffTotalReturn / metrics.benchmarkTotalReturnFinalValue
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Результаты</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Основные метрики */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Финальная стоимость</div>
            <div className="text-xl font-semibold">{formatRub(metrics.finalValue)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Вложено всего</div>
            <div className="text-xl font-semibold">{formatRub(metrics.totalInvested)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total return</div>
            <div className={'text-xl font-semibold ' + (metrics.totalReturn >= 0 ? 'text-green-500' : 'text-red-500')}>
              {metrics.totalReturn >= 0 ? '+' : ''}{pct(metrics.totalReturn)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">CAGR</div>
            <div className={'text-xl font-semibold ' + (metrics.cagr >= 0 ? 'text-green-500' : 'text-red-500')}>
              {metrics.cagr >= 0 ? '+' : ''}{pct(metrics.cagr)}
            </div>
          </div>
        </div>

        {/* Сравнение с бенчмарками */}
        <div className="pt-4 border-t">
          <div className="text-sm font-medium mb-3">Сравнение с индексами</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">Портфель</div>
              <div className="text-base font-semibold">{formatRub(metrics.finalValue)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                CAGR {pct(metrics.cagr)} · DD −{pct(metrics.maxDrawdown)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">IMOEX (без дивидендов)</div>
              <div className="text-base font-semibold">{formatRub(metrics.benchmarkFinalValue)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                CAGR {pct(metrics.benchmarkCagr)} · DD −{pct(metrics.benchmarkMaxDrawdown)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">MCFTR (с дивидендами)</div>
              <div className="text-base font-semibold">{formatRub(metrics.benchmarkTotalReturnFinalValue)}</div>
              <div className="text-xs text-muted-foreground mt-1">
                CAGR {pct(metrics.benchmarkTotalReturnCagr)} · DD −{pct(metrics.benchmarkTotalReturnMaxDrawdown)}
              </div>
            </div>
          </div>
        </div>

        {/* Разница */}
        <div className="pt-4 border-t text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Разница с IMOEX:</span>
            <span className={metrics.finalValue >= metrics.benchmarkFinalValue ? 'text-green-500' : 'text-red-500'}>
              {metrics.finalValue >= metrics.benchmarkFinalValue ? '+' : ''}
              {formatRub(metrics.finalValue - metrics.benchmarkFinalValue)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Разница с MCFTR (с дивидендами):</span>
            <span className={diffTotalReturn >= 0 ? 'text-green-500' : 'text-red-500'}>
              {diffTotalReturn >= 0 ? '+' : ''}
              {formatRub(diffTotalReturn)} ({(diffTotalReturnPct * 100).toFixed(2)}%)
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tracking error:</span>
            <span>{pct(metrics.trackingError)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
