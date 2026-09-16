'use client';

import type { BacktestMetrics, SeriesMetrics } from '@/lib/backtest/types';
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

function colorBySign(v: number): string {
  if (!Number.isFinite(v)) return '';
  return v >= 0 ? 'text-green-500' : 'text-red-500';
}

type RowExtractor = (s: SeriesMetrics) => { text: string; cls?: string };

interface RowProps {
  label: string;
  metrics: BacktestMetrics;
  extract: RowExtractor;
}

function Row({ label, metrics, extract }: RowProps) {
  const { portfolio, imoexDca, mcftrDca, deposit } = metrics;
  const p = extract(portfolio);
  const i = extract(imoexDca);
  const m = extract(mcftrDca);
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

export function ComparisonTable({ metrics }: Props) {
  return (
    <div className="pt-2">
      <div className="text-sm font-medium mb-3">
        Сравнение (одинаковые пополнения)
      </div>
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
            <Row
              label="Вложено"
              metrics={metrics}
              extract={(s) => ({ text: formatRub(s.totalInvested) })}
            />
            <Row
              label="Финальная стоимость"
              metrics={metrics}
              extract={(s) => ({ text: formatRub(s.finalValue) })}
            />
            <Row
              label="Заработано в деньгах"
              metrics={metrics}
              extract={(s) => ({
                text: signedRub(s.absoluteReturn),
                cls: colorBySign(s.absoluteReturn),
              })}
            />
            <Row
              label="XIRR (годовых)"
              metrics={metrics}
              extract={(s) => ({
                text: signedPct(s.xirr),
                cls: colorBySign(s.xirr),
              })}
            />
            <Row
              label="Max drawdown"
              metrics={metrics}
              extract={(s) => ({
                text: s.maxDrawdown > 0 ? '−' + pct(s.maxDrawdown) : '0%',
                cls: s.maxDrawdown > 0 ? 'text-red-500' : '',
              })}
            />
          </tbody>
        </table>
      </div>
    </div>
  );
}
