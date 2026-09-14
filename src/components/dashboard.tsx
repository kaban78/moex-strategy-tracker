'use client';

import { useMemo, useState } from 'react';
import type { Ticker } from '@/types';
import { buildPortfolio } from '@/lib/universe/select';
import { computeDrift } from '@/lib/engine/drift';
import { rebalance } from '@/lib/engine/rebalance';
import { allocateLots } from '@/lib/engine/target-weights';
import { usePortfolio } from '@/stores/portfolio';
import { PortfolioEditor } from '@/components/portfolio-editor';
import { PriceChartDialog } from '@/components/price-chart/price-chart-dialog';
import { prefetchHistory } from '@/lib/moex/history-cache';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  universe: Ticker[];
}

const PREFETCH_INTERVAL = 24;
const PREFETCH_DAYS = 3650;

export function Dashboard({ universe }: Props) {
  const { positions, cash } = usePortfolio();
  const [chartTicker, setChartTicker] = useState<string | null>(null);
  const [chartOpen, setChartOpen] = useState(false);

  function openChart(ticker: string) {
    setChartTicker(ticker);
    setChartOpen(true);
  }

  function prefetch(ticker: string) {
    void prefetchHistory(ticker, PREFETCH_INTERVAL, PREFETCH_DAYS);
  }

  const lotCosts = useMemo(
    () =>
      Object.fromEntries(
        universe.map((t) => [t.ticker, t.lotSize * t.price]),
      ),
    [universe],
  );

  const portfolioValue = useMemo(() => {
    const posValue = positions.reduce((s, p) => {
      const t = universe.find((u) => u.ticker === p.ticker);
      return s + (t ? t.lotSize * t.price * p.lots : 0);
    }, 0);
    const total = posValue + cash;
    return total > 0 ? total : 100_000;
  }, [positions, universe, cash]);

  const plan = useMemo(
    () => buildPortfolio(universe, { portfolioValue }),
    [universe, portfolioValue],
  );

  const drift = useMemo(
    () =>
      computeDrift({
        positions,
        universe,
        targetWeights: plan.holdings,
        cash,
      }),
    [positions, universe, plan.holdings, cash],
  );

  const rebalancePlan = useMemo(
    () =>
      rebalance({
        drifts: drift.drifts,
        universe,
        cash,
      }),
    [drift.drifts, universe, cash],
  );

  const allocation = useMemo(
    () =>
      allocateLots(plan.holdings, universe, {
        portfolioValue: drift.totalValue || 100_000,
      }),
    [plan.holdings, universe, drift.totalValue],
  );

  const TickerButton = ({ ticker }: { ticker: string }) => (
    <button
      type="button"
      onClick={() => openChart(ticker)}
      onMouseEnter={() => prefetch(ticker)}
      onFocus={() => prefetch(ticker)}
      className="font-mono font-medium underline decoration-dotted underline-offset-4 hover:text-blue-500 transition-colors"
    >
      {ticker}
    </button>
  );

  return (
    <div className="space-y-6">
      <PortfolioEditor lotCosts={lotCosts} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 flex-wrap">
            Целевой портфель — реплика IMOEX
            <Badge variant="secondary">{plan.holdings.length} бумаг</Badge>
            <Badge variant="outline">
              Omission: {formatPercent(plan.omissionWeight * 100)}
            </Badge>
            <Badge variant="outline">
              Прогноз TE: {formatPercent(plan.estimatedTrackingError * 100)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Тикер</TableHead>
                <TableHead className="text-right">Целевой вес</TableHead>
                <TableHead className="text-right">Целевая стоимость</TableHead>
                <TableHead className="text-right">Лотов</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.holdings.map((h) => {
                const alloc = allocation.allocations.find(
                  (a) => a.ticker === h.ticker,
                );
                return (
                  <TableRow key={h.ticker}>
                    <TableCell>
                      <TickerButton ticker={h.ticker} />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(h.weight * 100)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRub(h.weight * (drift.totalValue || 100_000))}
                    </TableCell>
                    <TableCell className="text-right">
                      {alloc?.lots ?? 0}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {plan.omitted.length > 0 && (
            <div className="mt-4 text-sm text-muted-foreground">
              Пропущено {plan.omitted.length} бумаг (суммарный вес{' '}
              {formatPercent(plan.omissionWeight * 100)}). Причины: дорогой лот
              или выход за порог покрытия.
            </div>
          )}
        </CardContent>
      </Card>

      {positions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 flex-wrap">
              Отклонения от целевого портфеля
              <Badge variant="outline">
                Max drift: {formatPercent(drift.maxDrift * 100)}
              </Badge>
              <Badge variant="outline">
                Turnover: {formatPercent(drift.turnover * 100)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тикер</TableHead>
                  <TableHead className="text-right">Текущий вес</TableHead>
                  <TableHead className="text-right">Целевой вес</TableHead>
                  <TableHead className="text-right">Delta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drift.drifts.map((d) => (
                  <TableRow key={d.ticker}>
                    <TableCell>
                      <TickerButton ticker={d.ticker} />
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(d.currentWeight * 100)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatPercent(d.targetWeight * 100)}
                    </TableCell>
                    <TableCell
                      className={
                        'text-right ' +
                        (d.delta > 0
                          ? 'text-red-500'
                          : d.delta < 0
                            ? 'text-green-500'
                            : '')
                      }
                    >
                      {d.delta > 0 ? '+' : ''}
                      {formatPercent(d.delta * 100)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {rebalancePlan.actions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 flex-wrap">
              Арифметика для устранения отклонений
              {rebalancePlan.buyValue > 0 && (
                <Badge variant="outline">
                  Покупок: {formatRub(rebalancePlan.buyValue)}
                </Badge>
              )}
              {rebalancePlan.sellValue > 0 && (
                <Badge variant="destructive">
                  Продаж: {formatRub(rebalancePlan.sellValue)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тикер</TableHead>
                  <TableHead>Операция</TableHead>
                  <TableHead className="text-right">Лотов</TableHead>
                  <TableHead className="text-right">Стоимость</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rebalancePlan.actions.map((a, i) => (
                  <TableRow key={a.ticker + '-' + a.side + '-' + i}>
                    <TableCell>
                      <TickerButton ticker={a.ticker} />
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={a.side === 'buy' ? 'secondary' : 'destructive'}
                      >
                        {a.side === 'buy' ? 'покупка' : 'продажа'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{a.lots}</TableCell>
                    <TableCell className="text-right">
                      {formatRub(a.cost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rebalancePlan.cashLeft > 0 && (
              <p className="mt-4 text-sm text-muted-foreground">
                Остаток кэша после операций: {formatRub(rebalancePlan.cashLeft)}
              </p>
            )}
            <p className="mt-4 text-xs text-muted-foreground">
              {DISCLAIMER_SHORT_RU} Это справочная арифметика для выбранной
              стратегии. Решение о сделках принимаете вы.
            </p>
          </CardContent>
        </Card>
      )}

      <PriceChartDialog
        ticker={chartTicker}
        open={chartOpen}
        onOpenChange={setChartOpen}
      />
    </div>
  );
}
