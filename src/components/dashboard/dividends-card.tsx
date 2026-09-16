'use client';

import { useMemo, useState } from 'react';
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
  yearsSpan: number;
  avgPerYear: number;
}

type YearLimit = 1 | 2 | 3 | 5 | 'all';

const YEAR_OPTIONS: { value: YearLimit; label: string }[] = [
  { value: 1, label: '1 год' },
  { value: 2, label: '2 года' },
  { value: 3, label: '3 года' },
  { value: 5, label: '5 лет' },
  { value: 'all', label: 'Все' },
];

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(d.getUTCFullYear()).slice(2);
  return `${dd}.${mm}.${yy}`;
}

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

  const [yearLimit, setYearLimit] = useState<YearLimit>(3);

  const cutoff = useMemo(() => {
    if (yearLimit === 'all') return null;
    const d = new Date();
    d.setUTCFullYear(d.getUTCFullYear() - yearLimit);
    return d.toISOString().slice(0, 10);
  }, [yearLimit]);

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
      // Хронология: старые → свежие. Стабильно, не скачет.
      g.payments.sort((a, b) => {
        const da = new Date(a.recordDate).getTime();
        const db = new Date(b.recordDate).getTime();
        return da - db;
      });

      if (g.payments.length > 0) {
        const newest = new Date(
          g.payments[g.payments.length - 1].recordDate,
        ).getTime();
        const oldest = new Date(g.payments[0].recordDate).getTime();
        const ms = Math.max(0, newest - oldest);
        g.yearsSpan = Math.max(
          1,
          Math.ceil(ms / (365.25 * 24 * 3600 * 1000)) + 1,
        );
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
            <div className="flex items-center gap-2 flex-wrap mb-3">
              <span className="text-xs text-muted-foreground">
                период:
              </span>
              {YEAR_OPTIONS.map((o) => (
                <button
                  key={String(o.value)}
                  type="button"
                  onClick={() => setYearLimit(o.value)}
                  className={
                    'px-3 py-1 text-xs rounded-md border transition-colors ' +
                    (yearLimit === o.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted')
                  }
                >
                  {o.label}
                </button>
              ))}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тикер</TableHead>
                  <TableHead className="text-right w-16">Лотов</TableHead>
                  <TableHead>Выплаты — отсечка / на акцию</TableHead>
                  <TableHead className="text-right">За 12 мес</TableHead>
                  <TableHead className="text-right">Среднегодовые</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => {
                  const visible = cutoff
                    ? g.payments.filter(
                        (p) => p.recordDate.slice(0, 10) >= cutoff,
                      )
                    : g.payments;

                  return (
                    <TableRow key={g.ticker}>
                      <TableCell className="font-mono align-top">
                        {g.ticker}
                      </TableCell>
                      <TableCell className="text-right align-top">
                        {g.lots}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-wrap gap-1.5">
                          {visible.map((p, i) => (
                            <span
                              key={p.recordDate + '-' + i}
                              className={
                                'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono whitespace-nowrap ' +
                                (p.future
                                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/40'
                                  : 'bg-muted text-muted-foreground border border-transparent')
                              }
                              title={`Выплата ${shortDate(p.paymentDate)}: ${formatRub(p.total)}`}
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
                  );
                })}
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
                Среднегодовые — сумма всех выплат / число лет
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
