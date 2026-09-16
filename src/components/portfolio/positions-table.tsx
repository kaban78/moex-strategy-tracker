'use client';

import type { Position } from '@/types';
import { Button } from '@/components/ui/button';
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
  positions: Position[];
  lotCosts: Record<string, number>;
  onRemove: (ticker: string) => void;
}

export function PositionsTable({ positions, lotCosts, onRemove }: Props) {
  if (positions.length === 0) return null;

  return (
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
              <TableCell className="text-right">{formatRub(lc)}</TableCell>
              <TableCell className="text-right">
                {formatRub(lc * p.lots)}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(p.ticker)}
                >
                  ×
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
