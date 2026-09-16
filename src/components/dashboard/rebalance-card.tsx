'use client';

import type { RebalanceResult } from '@/lib/engine/rebalance';
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
import { formatRub } from '@/lib/format';
import { DISCLAIMER_SHORT_RU } from '@/lib/legal/disclaimers';
import { usePortfolio } from '@/stores/portfolio';

interface Props {
  rebalancePlan: RebalanceResult;
  onTickerClick: (ticker: string) => void;
}

export function RebalanceCard({ rebalancePlan, onTickerClick }: Props) {
  const { actions, buyValue, sellValue, cashLeft } = rebalancePlan;
  const { applyRebalance } = usePortfolio();

  if (actions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 flex-wrap">
          Арифметика для устранения отклонений
          {buyValue > 0 && (
            <Badge variant="outline">Покупок: {formatRub(buyValue)}</Badge>
          )}
          {sellValue > 0 && (
            <Badge variant="destructive">Продаж: {formatRub(sellValue)}</Badge>
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
            {actions.map((a, i) => (
              <TableRow key={a.ticker + '-' + a.side + '-' + i}>
                <TableCell>
                  <TickerButton ticker={a.ticker} onClick={onTickerClick} />
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
        {cashLeft > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">
            Остаток кэша после операций: {formatRub(cashLeft)}
          </p>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          {DISCLAIMER_SHORT_RU} Это справочная арифметика для выбранной
          стратегии. Решение о сделках принимаете вы.
        </p>
        <div className="mt-3 pt-3 border-t flex justify-end">
          <button
            type="button"
            onClick={() => applyRebalance(actions)}
            className="text-xs px-3 py-1.5 rounded-md border bg-background hover:bg-muted transition-colors"
          >
            применить к портфелю
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
