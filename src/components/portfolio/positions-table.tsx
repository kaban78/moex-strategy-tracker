'use client';

import { useEffect, useState } from 'react';
import type { Position } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  onSetLots: (ticker: string, lots: number) => void;
}

export function PositionsTable({
  positions,
  lotCosts,
  onRemove,
  onSetLots,
}: Props) {
  if (positions.length === 0) return null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Тикер</TableHead>
          <TableHead className="text-right w-24">Лотов</TableHead>
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
              <TableCell className="text-right">
                <LotsInput
                  value={p.lots}
                  onCommit={(v) => onSetLots(p.ticker, v)}
                />
              </TableCell>
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

interface LotsInputProps {
  value: number;
  onCommit: (v: number) => void;
}

/**
 * Инпут лотов с локальным state.
 * Обновляет store только при blur или Enter — чтобы не писать
 * на каждый keystroke и не ломать миграцию при стирании строки.
 */
function LotsInput({ value, onCommit }: LotsInputProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function commit() {
    const n = parseInt(draft, 10);
    if (!Number.isFinite(n) || n < 0) {
      setDraft(String(value));
      return;
    }
    if (n !== value) onCommit(n);
  }

  return (
    <Input
      type="number"
      min="0"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
        if (e.key === 'Escape') {
          setDraft(String(value));
          e.currentTarget.blur();
        }
      }}
      className="h-7 w-16 text-right font-mono ml-auto"
    />
  );
}
