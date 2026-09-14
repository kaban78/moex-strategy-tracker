'use client';

import type { Drift } from '@/lib/engine/drift';
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
import { formatPercent } from '@/lib/format';

interface Props {
  drifts: Drift[];
  maxDrift: number;
  turnover: number;
  onTickerClick: (ticker: string) => void;
}

function deltaClass(delta: number): string {
  if (delta > 0) return 'text-right text-red-500';
  if (delta < 0) return 'text-right text-green-500';
  return 'text-right';
}

export function DriftCard({
  drifts,
  maxDrift,
  turnover,
  onTickerClick,
}: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 flex-wrap">
          Отклонения от целевого портфеля
          <Badge variant="outline">
            Max drift: {formatPercent(maxDrift * 100)}
          </Badge>
          <Badge variant="outline">
            Turnover: {formatPercent(turnover * 100)}
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
            {drifts.map((d) => (
              <TableRow key={d.ticker}>
                <TableCell>
                  <TickerButton ticker={d.ticker} onClick={onTickerClick} />
                </TableCell>
                <TableCell className="text-right">
                  {formatPercent(d.currentWeight * 100)}
                </TableCell>
                <TableCell className="text-right">
                  {formatPercent(d.targetWeight * 100)}
                </TableCell>
                <TableCell className={deltaClass(d.delta)}>
                  {d.delta > 0 ? '+' : ''}
                  {formatPercent(d.delta * 100)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
