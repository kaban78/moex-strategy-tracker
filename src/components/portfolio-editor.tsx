'use client';

import { usePortfolio } from '@/stores/portfolio';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TickerAddForm } from './portfolio/ticker-add-form';
import { CashInput } from './portfolio/cash-input';
import { PositionsTable } from './portfolio/positions-table';

interface Props {
  lotCosts: Record<string, number>;
}

export function PortfolioEditor({ lotCosts }: Props) {
  const { positions, cash, add, remove, setCash, clear } = usePortfolio();

  const positionsValue = positions.reduce((s, p) => {
    const lc = lotCosts[p.ticker] ?? 0;
    return s + lc * p.lots;
  }, 0);
  const totalValue = positionsValue + cash;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Мой портфель</span>
          <Button variant="ghost" size="sm" onClick={clear}>
            Очистить
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <TickerAddForm onAdd={add} />
        <CashInput
          cash={cash}
          portfolioValue={totalValue}
          onChange={setCash}
        />
        <PositionsTable
          positions={positions}
          lotCosts={lotCosts}
          onRemove={remove}
        />
      </CardContent>
    </Card>
  );
}
