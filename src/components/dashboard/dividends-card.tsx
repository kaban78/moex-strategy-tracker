'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Position, Ticker } from '@/types';
import type { TinkoffDividend } from '@/lib/tinkoff/types';
import {
  computeDividends,
  type DividendSummary,
} from '@/lib/engine/dividends';
import { useTinkoff } from '@/stores/tinkoff';
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

interface DividendsResponse {
  ok: boolean;
  dividendsByTicker?: Record<string, TinkoffDividend[]>;
  error?: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function DividendsCard({
  positions,
  universe,
  portfolioValue,
}: Props) {
  const { token } = useTinkoff();
  const [summary, setSummary] = useState<DividendSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || positions.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const tickers = positions.map((p) => p.ticker);
      const res = await fetch('/api/tinkoff/dividends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, tickers }),
      });
      const j = (await res.json()) as DividendsResponse;
      if (!j.ok) {
        setError(j.error ?? 'ошибка загрузки');
        return;
      }
      const map = new Map<string, TinkoffDividend[]>(
        Object.entries(j.dividendsByTicker ?? {}),
      );
      setSummary(
        computeDividends({
          positions,
          universe,
          dividendsByTicker: map,
          portfolioValue,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ошибка сети');
    } finally {
      setLoading(false);
    }
  }, [token, positions, universe, portfolioValue]);

  useEffect(() => {
    if (!token || positions.length === 0) return;
    void load();
  }, [load, token, positions.length]);

  if (!token) return null;
  if (positions.length === 0) return null;

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
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            disabled={loading}
            className="ml-auto"
          >
            {loading ? 'загрузка...' : 'обновить'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!error && summary && summary.rows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            По текущим позициям нет данных о дивидендах. Возможно, бумаги
            не платят дивиденды или данные недоступны.
          </p>
        )}

        {!error && summary && summary.rows.length > 0 && (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тикер</TableHead>
                  <TableHead>Отсечка</TableHead>
                  <TableHead>Выплата</TableHead>
                  <TableHead className="text-right">На акцию</TableHead>
                  <TableHead className="text-right">На лот</TableHead>
                  <TableHead className="text-right">Лотов</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.rows.map((r, i) => (
                  <TableRow key={r.ticker + '-' + r.recordDate + '-' + i}>
                    <TableCell className="font-mono">{r.ticker}</TableCell>
                    <TableCell className="text-xs">
                      {formatDate(r.recordDate)}
                    </TableCell>
                    <TableCell className="text-xs">
                      {formatDate(r.paymentDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRub(r.perShare)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRub(r.perLot)}
                    </TableCell>
                    <TableCell className="text-right">{r.lots}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatRub(r.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-4 text-sm text-muted-foreground">
              Платящих бумаг: {summary.payingTickers} из {summary.totalTickers}.
              Суммарно за всю доступную историю:{' '}
              {formatRub(summary.totalAmount)}.
            </div>
          </>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          {DISCLAIMER_SHORT_RU} Данные о выплатах — из T-Invest API. Прошлые
          выплаты не определяют будущие.
        </p>
      </CardContent>
    </Card>
  );
}
