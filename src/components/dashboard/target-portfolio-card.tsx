'use client';

import type { Ticker, TargetWeight } from '@/types';
import type { AllocationResult } from '@/lib/engine/target-weights';
import { TickerButton } from './ticker-button';
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

interface Props {
  holdings: TargetWeight[];
  omittedCount: number;
  omissionWeight: number;
  estimatedTrackingError: number;
  portfolioValue: number;
  allocation: AllocationResult;
  universe: Ticker[];
  onTickerClick: (ticker: string) => void;
}

export function TargetPortfolioCard({
  holdings,
  omittedCount,
  omissionWeight,
  estimatedTrackingError,
  portfolioValue,
  allocation,
  onTickerClick,
}: Props) {
  const allocByTicker = new Map(
    allocation.allocations.map((a) => [a.ticker, a]),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 flex-wrap">
          Целевой портфель — реплика IMOEX
          <Badge variant="secondary">{holdings.length} бумаг</Badge>
          <Badge variant="outline">
            Omission: {formatPercent(omissionWeight * 100)}
          </Badge>
          <Badge variant="outline">
            Прогноз TE: {formatPercent(estimatedTrackingError * 100)}
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
            {holdings.map((h) => {
              const alloc = allocByTicker.get(h.ticker);
              return (
                <TableRow key={h.ticker}>
                  <TableCell>
                    <TickerButton
                      ticker={h.ticker}
                      onClick={onTickerClick}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {formatPercent(h.weight * 100)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatRub(h.weight * portfolioValue)}
                  </TableCell>
                  <TableCell className="text-right">
                    {alloc?.lots ?? 0}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {omittedCount > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Пропущено {omittedCount} бумаг (суммарный вес{' '}
            {formatPercent(omissionWeight * 100)}). Причины: дорогой лот или
            выход за порог покрытия.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
