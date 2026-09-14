'use client';

import { useState } from 'react';
import { usePortfolio } from '@/stores/portfolio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatRub } from '@/lib/format';

interface Props {
  /** Известные тикеры и их цены × лоты для валидации. */
  lotCosts: Record<string, number>;
}

export function PortfolioEditor({ lotCosts }: Props) {
  const { positions, cash, add, remove, setCash, clear } = usePortfolio();
  const [ticker, setTicker] = useState('');
  const [lots, setLots] = useState('1');

  const handleAdd = () => {
    const n = parseInt(lots, 10);
    if (!ticker.trim() || !Number.isFinite(n) || n <= 0) return;
    add(ticker, n);
    setTicker('');
    setLots('1');
  };

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
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">Тикер</label>
            <Input
              placeholder="SBER"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <div className="w-24">
            <label className="text-xs text-muted-foreground">Лотов</label>
            <Input
              type="number"
              min="1"
              value={lots}
              onChange={(e) => setLots(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>
          <Button onClick={handleAdd}>Добавить</Button>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground">
              Свободный кэш, ₽
            </label>
            <Input
              type="number"
              min="0"
              value={cash || ''}
              onChange={(e) => setCash(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <div className="text-right text-sm text-muted-foreground pb-2">
            Стоимость портфеля: <strong>{formatRub(totalValue)}</strong>
          </div>
        </div>

        {positions.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Тикер</TableHead>
                <TableHead className="text-right">Лотов</TableHead>
                <TableHead className="text-right">Лот, ₽</TableHead>
                <TableHead className="text-right">Стоимость</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((p) => {
                const lc = lotCosts[p.ticker] ?? 0;
                return (
                  <TableRow key={p.ticker}>
                    <TableCell className="font-mono">{p.ticker}</TableCell>
                    <TableCell className="text-right">{p.lots}</TableCell>
                    <TableCell className="text-right">
                      {formatRub(lc)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRub(lc * p.lots)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(p.ticker)}
                      >
                        ×
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
