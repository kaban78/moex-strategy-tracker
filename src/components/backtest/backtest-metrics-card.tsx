'use client';

import type { BacktestMetrics, SeriesMetrics } from '@/lib/backtest/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRub } from '@/lib/format';

interface Props {
  metrics: BacktestMetrics;
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

function colorBySign(v: number, invert = false): string {
  if (!Number.isFinite(v)) return '';
  const positive = invert ? v < 0 : v >= 0;
  return positive ? 'text-green-500' : 'text-red-500';
}

interface RowProps {
  label: string;
  portfolio: SeriesMetrics;
  imoex: SeriesMetrics;
  mcftr: SeriesMetrics;
  deposit: SeriesMetrics;
  extract: (s: SeriesMetrics) => { text: string; cls?: string };
}

function ComparisonRow({
  label,
  portfolio,
  imoex,
  mcftr,
  deposit,
  extract,
}: RowProps) {
  const p = extract(portfolio);
  const i = extract(imoex);
  const m = extract(mcftr);
  const d = extract(deposit);
  return (
    <tr className="border-b border-muted">
      <td className="py-2 text-muted-foreground">{label}</td>
      <td className={'text-right ' + (p.cls ?? '')}>{p.text}</td>
      <td className="text-right">{i.text}</td>
      <td className="text-right">{m.text}</td>
      <td className="text-right">{d.text}</td>
    </tr>
  );
}

export function BacktestMetricsCard({ metrics }: Props) {
  const { portfolio, imoexDca, mcftrDca, deposit } = metrics;
  const diffMcftr = portfolio.absoluteReturn - mcftrDca.absoluteReturn;
  const diffDeposit = portfolio.absoluteReturn - deposit.absoluteReturn;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Результаты</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Три главные цифры */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border">
            <div className="text-xs text-muted-foreground">Доходность портфеля (XIRR)</div>
            <div
              className={
                'text-2xl font-bold mt-1 ' +
                colorBySign(portfolio.xirr)
              }
            >
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
                'text-2xl font-bold mt-1 ' +
                colorBySign(portfolio.absoluteReturn)
              }
            >
              {signedRub(portfolio.absoluteReturn)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              финал − вложено
            </div>
          </div>
          <div className="p-4 rounded-lg border">
            <div className="text-xs text-muted-foreground">Разница с вкладом</div>
            <div
              className={
                'text-2xl font-bold mt-1 ' +
                colorBySign(diffDeposit)
              }
            >
              {signedRub(diffDeposit)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {diffDeposit >= 0
                ? 'акции обогнали вклад'
                : 'вклад был бы выгоднее'}
            </div>
          </div>
        </div>

        {/* Таблица сравнения */}
        <div className="pt-2">
          <div className="text-sm font-medium mb-3">Сравнение (одинаковые пополнения)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground border-b">
                <tr>
                  <th className="text-left py-2">Метрика</th>
                  <th className="text-right py-2">Портфель</th>
                  <th className="text-right py-2">IMOEX (DCA)</th>
                  <th className="text-right py-2">MCFTR (DCA)</th>
                  <th className="text-right py-2">Вклад (ЦБ)</th>
                </tr>
              </thead>
              <tbody>
                <ComparisonRow
                  label="Вложено"
                  portfolio={portfolio}
                  imoex={imoexDca}
                  mcftr={mcftrDca}
                  deposit={deposit}
                  extract={(s) => ({ text: formatRub(s.totalInvested) })}
                />
                <ComparisonRow
                  label="Финальная стоимость"
                  portfolio={portfolio}
                  imoex={imoexDca}
                  mcftr={mcftrDca}
                  deposit={deposit}
                  extract={(s) => ({ text: formatRub(s.finalValue) })}
                />
                <ComparisonRow
                  label="Заработано в деньгах"
                  portfolio={portfolio}
                  imoex={imoexDca}
                  mcftr={mcftrDca}
                  deposit={deposit}
                  extract={(s) => ({
                    text: signedRub(s.absoluteReturn),
                    cls: colorBySign(s.absoluteReturn),
                  })}
                />
                <ComparisonRow
                  label="XIRR (годовых)"
                  portfolio={portfolio}
                  imoex={imoexDca}
                  mcftr={mcftrDca}
                  deposit={deposit}
                  extract={(s) => ({
                    text: signedPct(s.xirr),
                    cls: colorBySign(s.xirr),
                  })}
                />
                <ComparisonRow
                  label="Max drawdown"
                  portfolio={portfolio}
                  imoex={imoexDca}
                  mcftr={mcftrDca}
                  deposit={deposit}
                  extract={(s) => ({
                    text: s.maxDrawdown > 0 ? '−' + pct(s.maxDrawdown) : '0%',
                    cls: s.maxDrawdown > 0 ? 'text-red-500' : '',
                  })}
                />
              </tbody>
            </table>
          </div>
        </div>

        {/* Разницы */}
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

        {/* Price return индексов */}
        <div className="pt-4 border-t">
          <div className="text-sm font-medium mb-2">
            Чистая доходность индекса (цена → цена, без пополнений)
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Если бы купил один раз в начале и держал. Разница между MCFTR и IMOEX — дивидендная доходность.
          </p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">IMOEX</div>
              <div className={'text-base font-semibold ' + colorBySign(metrics.imoexPriceCagr)}>
                {signedPct(metrics.imoexPriceCagr)} годовых
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">MCFTR</div>
              <div className={'text-base font-semibold ' + colorBySign(metrics.mcftrPriceCagr)}>
                {signedPct(metrics.mcftrPriceCagr)} годовых
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Дивиденды (MCFTR − IMOEX)</div>
              <div className="text-base font-semibold text-green-500">
                {signedPct(metrics.mcftrPriceCagr - metrics.imoexPriceCagr)} годовых
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
