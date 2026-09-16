'use client';

import type { BacktestMetrics } from '@/lib/backtest/types';

interface Props {
  metrics: BacktestMetrics;
}

function signedPct(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
}

function colorBySign(v: number): string {
  if (!Number.isFinite(v)) return '';
  return v >= 0 ? 'text-green-500' : 'text-red-500';
}

export function PriceReturnsBlock({ metrics }: Props) {
  const dividendYield = metrics.mcftrPriceCagr - metrics.imoexPriceCagr;

  return (
    <div className="pt-4 border-t">
      <div className="text-sm font-medium mb-2">
        Чистая доходность индекса (цена → цена, без пополнений)
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Если бы купил один раз в начале и держал. Разница между MCFTR и
        IMOEX — дивидендная доходность.
      </p>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-xs text-muted-foreground">IMOEX</div>
          <div
            className={
              'text-base font-semibold ' + colorBySign(metrics.imoexPriceCagr)
            }
          >
            {signedPct(metrics.imoexPriceCagr)} годовых
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">MCFTR</div>
          <div
            className={
              'text-base font-semibold ' + colorBySign(metrics.mcftrPriceCagr)
            }
          >
            {signedPct(metrics.mcftrPriceCagr)} годовых
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">
            Дивиденды (MCFTR − IMOEX)
          </div>
          <div className="text-base font-semibold text-green-500">
            {signedPct(dividendYield)} годовых
          </div>
        </div>
      </div>
    </div>
  );
}
