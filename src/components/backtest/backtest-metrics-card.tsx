'use client';

import type { BacktestMetrics } from '@/lib/backtest/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRub } from '@/lib/format';
import { SummaryCards } from './summary-cards';
import { ComparisonTable } from './comparison-table';
import { PriceReturnsBlock } from './price-returns-block';

interface Props {
  metrics: BacktestMetrics;
}

function pct(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return (v * 100).toFixed(2) + '%';
}

function colorBySign(v: number): string {
  if (!Number.isFinite(v)) return '';
  return v >= 0 ? 'text-green-500' : 'text-red-500';
}

function signedRub(v: number): string {
  return (v >= 0 ? '+' : '') + formatRub(v);
}

export function BacktestMetricsCard({ metrics }: Props) {
  const diffMcftr =
    metrics.portfolio.absoluteReturn - metrics.mcftrDca.absoluteReturn;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Результаты</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <SummaryCards
          portfolio={metrics.portfolio}
          deposit={metrics.deposit}
        />

        <ComparisonTable metrics={metrics} />

        <div className="pt-2 border-t text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Разница с MCFTR (с дивидендами):
            </span>
            <span className={colorBySign(diffMcftr)}>
              {signedRub(diffMcftr)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tracking error:</span>
            <span>{pct(metrics.trackingError)}</span>
          </div>
        </div>

        <PriceReturnsBlock metrics={metrics} />
      </CardContent>
    </Card>
  );
}
