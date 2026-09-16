'use client';

import type { SeriesMetrics } from '@/lib/backtest/types';
import { formatRub } from '@/lib/format';

interface Props {
  portfolio: SeriesMetrics;
  deposit: SeriesMetrics;
}

function pct(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return (v * 100).toFixed(2) + '%';
}

function signedPct(v: number): string {
  if (!Number.isFinite(v)) return '—';
  return (v >= 0 ? '+' : '') + pct(v);
}

function signedRub(v: number): string {
  return (v >= 0 ? '+' : '') + formatRub(v);
}

function colorBySign(v: number): string {
  if (!Number.isFinite(v)) return '';
  return v >= 0 ? 'text-green-500' : 'text-red-500';
}

export function SummaryCards({ portfolio, deposit }: Props) {
  const diffDeposit = portfolio.absoluteReturn - deposit.absoluteReturn;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="p-4 rounded-lg border">
        <div className="text-xs text-muted-foreground">
          Доходность портфеля (XIRR)
        </div>
        <div className={'text-2xl font-bold mt-1 ' + colorBySign(portfolio.xirr)}>
          {signedPct(portfolio.xirr)}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          % годовых с учётом пополнений
        </div>
      </div>
      <div className="p-4 rounded-lg border">
        <div className="text-xs text-muted-foreground">Заработано в деньгах</div>
        <div
          className={
            'text-2xl font-bold mt-1 ' + colorBySign(portfolio.absoluteReturn)
          }
        >
          {signedRub(portfolio.absoluteReturn)}
        </div>
        <div className="text-xs text-muted-foreground mt-1">финал − вложено</div>
      </div>
      <div className="p-4 rounded-lg border">
        <div className="text-xs text-muted-foreground">Разница с вкладом</div>
        <div className={'text-2xl font-bold mt-1 ' + colorBySign(diffDeposit)}>
          {signedRub(diffDeposit)}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {diffDeposit >= 0 ? 'акции обогнали вклад' : 'вклад был бы выгоднее'}
        </div>
      </div>
    </div>
  );
}
