'use client';

import { useMemo } from 'react';
import type { Position, Ticker } from '@/types';
import { useDividends } from './hooks/use-dividends';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatPercent, formatRub } from '@/lib/format';
import { DISCLAIMER_SHORT_RU } from '@/lib/legal/disclaimers';

interface Props {
  positions: Position[];
  universe: Ticker[];
  portfolioValue: number;
}

interface Payment {
  recordDate: string;
  paymentDate: string;
  perShare: number;
  total: number;
  future: boolean;
}

interface TickerGroup {
  ticker: string;
  lots: number;
  payments: Payment[];
  sum12m: number;
  /** Сколько лет покрывают выплаты. */
  yearsSpan: number;
  /** Средняя годовая выплата: sumAll / yearsSpan. */
  avgPerYear: number;
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(d.getUTCFullYear()).slice(2);
  return `${dd}.${mm}.${yy}`;
}

/**
 * Компактное форматирование дивиденда на акцию.
 * Округляет до копеек: 0.32₽ вместо 0.321425305₽.
 */
function fmtPerShare(v: number): string {
  if (!Number.isFinite(v)) return '—';
  if (v >= 1) return v.toFixed(2).replace(/\.?0+$/, '') + '₽';
  return v.toFixed(2) + '₽';
}

export function DividendsCard({ positions, universe, portfolioValue }: Props) {
  const { summary, loading, error, refresh, enabled } = useDividends({
    positions,
    universe,
    portfolioValue,
  });

  const groups = useMemo<TickerGroup[]>(() => {
    if (!summary) return [];
    const today = new Date().toISOString().slice(0, 10);
    const map = new Map<string, TickerGroup>();
    const oneYearAgo = Date.now() - 365 * 24 * 3600 * 1000;

    for (const r of summary.rows) {
      const key = r.ticker;
      if (!map.has(key)) {
        map.set(key, {
          ticker: key,
          lots: r.lots,
          payments: [],
          sum12m: 0,
          yearsSpan: 0,
          avgPerYear: 0,
        });
      }
      const g = map.get(key)!;
      const record = r.recordDate.slice(0, 10);
      const future = record >= today;

      g.payments.push({
        recordDate: r.recordDate,
        paymentDate: r.paymentDate,
        perShare: r.perShare,
        total: r.total,
        future,
      });

      const ts = new Date(r.recordDate).getTime();
      if (Number.isFinite(ts) && ts >= oneYearAgo) {
        g.sum12m += r.total;
      }
    }

    for (const g of map.values()) {
      g.payments.sort(
        (a, b) =>
          new Date(b.recordDate).getTime() -
          new Date(a.recordDate).getTime(),
      );

      // Годы: от первой до последней выплаты включительно.
      if (g.payments.length > 0) {
        const newest = new Date(g.payments[0].recordDate).getTime();
        const oldest = new Date(
          g.payments[g.payments.length - 1].recordDate,
        ).getTime();
        const ms = Math.max(0, newest - oldest);
        // Плюс 1 — потому что от 2023 до 2026 это 4 разных года.
        g.yearsSpan = Math.max(1, Math.ceil(ms / (365.25 * 24 * 3600 * 1000)) + 1);
        const sumAll = g.payments.reduce((s, p) => s + p.total, 0);
        g.avgPerYear = sumAll / g.yearsSpan;
      }
    }

    return Array.from(map.values()).sort((a, b) => b.sum12m - a.sum12m);
  }, [summary]);

  if (!enabled) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 flex-wrap">
          Дивиденды
          {summary && (
            <>
              <Badge variant="outline">
                за 12 мес: {formatRub(summary.last12MonthsAmount)}
              </Badge>
              <Badge variant="outline">
                доходность: {formatPercent(summary.yieldLast12Months * 100)}
              </Badge>
              <Badge variant="outline">
                бумаг платят: {summary.payingTickers} из {summary.totalTickers}
              </Badge>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={refresh}
            disabled={loading}
            className="ml-auto"
          >
            {loading ? 'загрузка...' : 'обновить'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!error && groups.length === 0 && summary && (
          <p className="text-sm text-muted-foreground">
            По текущим позициям нет данных о дивидендах.
          </p>
        )}

        {groups.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тикер</TableHead>
                  <TableHead className="text-right w-16">Лотов</TableHead>
                  <TableHead>Выплаты — отсечка / на акцию</TableHead>
                  <TableHead className="text-right">За 12 мес</TableHead>
                  <TableHead className="text-right">
                    Средне­годовые
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.ticker}>
                    <TableCell className="font-mono align-top">
                      {g.ticker}
                    </TableCell>
                    <TableCell className="text-right align-top">
                      {g.lots}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-1">
                        {g.payments.map((p, i) => (
                          <span
                            key={p.recordDate + '-' + i}
                            className={
                              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono whitespace-nowrap ' +
                              (p.future
                                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/40'
                                : 'bg-muted text-muted-foreground border border-transparent')
                            }
                            title={
                              p.paymentDate
                                ? `Выплата ${shortDate(p.paymentDate)}: ${formatRub(p.total)}`
                                : `Сумма: ${formatRub(p.total)}`
                            }
                          >
                            {shortDate(p.recordDate)}
                            <span className="opacity-50">·</span>
                            {fmtPerShare(p.perShare)}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right align-top font-medium">
                      {formatRub(g.sum12m)}
                    </TableCell>
                    <TableCell className="text-right align-top text-muted-foreground">
                      {formatRub(g.avgPerYear)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>
                <span className="inline-block w-3 h-3 rounded align-middle bg-sky-500/15 border border-sky-500/40 mr-1" />
                будущие / объявленные
              </span>
              <span>
                <span className="inline-block w-3 h-3 rounded align-middle bg-muted mr-1" />
                уже выплаченные
              </span>
              <span className="ml-auto">
                Среднегодовые — сумма всех выплат / число лет, за которые они есть
              </span>
            </div>
          </>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          {DISCLAIMER_SHORT_RU} Данные из T-Invest API. Прошлые выплаты не
          определяют будущие.
        </p>
      </CardContent>
    </Card>
  );
}
