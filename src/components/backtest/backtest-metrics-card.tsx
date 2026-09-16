'use client';

import type { BacktestMetrics } from '@/lib/backtest/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatPercent, formatRub } from '@/lib/format';

interface Props {
  metrics: BacktestMetrics;
}

function formatCagr(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

export function BacktestMetricsCard({ metrics }: Props) {
  const diff = metrics.finalValue - metrics.benchmarkFinalValue;
  const diffPct =
    metrics.benchmarkFinalValue > 0
      ? diff / metrics.benchmarkFinalValue
      : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 flex-wrap">
          Результаты
          {diff >= 0 ? (
            <Badge variant="secondary">
              +{formatRub(diff)} к бенчмарку
            </Badge>
          ) : (
            <Badge variant="destructive">
              {formatRub(diff)} от бенчмарка
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Финальная стоимость</div>
            <div className="text-xl font-semibold">
              {formatRub(metrics.finalValue)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Вложено всего</div>
            <div className="text-xl font-semibold">
              {formatRub(metrics.totalInvested)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total return</div>
            <div
              className={
                'text-xl font-semibold ' +
                (metrics.totalReturn >= 0 ? 'text-green-500' : 'text-red-500')
              }
            >
              {metrics.totalReturn >= 0 ? '+' : ''}
              {formatCagr(metrics.totalReturn)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">CAGR</div>
            <div
              className={
                'text-xl font-semibold ' +
                (metrics.cagr >= 0 ? 'text-green-500' : 'text-red-500')
              }
            >
              {metrics.cagr >= 0 ? '+' : ''}
              {formatCagr(metrics.cagr)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-4 border-t">
          <div>
            <div className="text-xs text-muted-foreground">Max drawdown</div>
            <div className="text-base font-semibold text-red-500">
              −{formatCagr(metrics.maxDrawdown)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Tracking error</div>
            <div className="text-base font-semibold">
              {formatCagr(metrics.trackingError)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Бенчмарк (IMOEX)
            </div>
            <div className="text-base font-semibold">
              {formatRub(metrics.benchmarkFinalValue)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">CAGR бенчмарка</div>
            <div className="text-base font-semibold">
              {formatCagr(metrics.benchmarkCagr)}
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Разница с бенчмарком:
            </span>
            <span className={diff >= 0 ? 'text-green-500' : 'text-red-500'}>
              {diff >= 0 ? '+' : ''}
              {formatRub(diff)} ({formatPercent(diffPct * 100)})
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Max drawdown бенчмарка:
            </span>
            <span className="text-red-500">
              −{formatCagr(metrics.benchmarkMaxDrawdown)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
