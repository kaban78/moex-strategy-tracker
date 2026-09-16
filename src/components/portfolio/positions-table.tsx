'use client';

import { useEffect, useState } from 'react';
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
          <TableHead className="text-right">Лотов</TableHead>
          <TableHead className="text-right">Лот, ₽</TableHead>
          <TableHead className="text-right">Стоимость</TableHead>
          <TableHead className="w-10"></TableHead>
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

function LotsInput({ value, onCommit }: LotsInputProps) {
  const [draft, setDraft] = useState<string>(() => String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  function commit() {
    setFocused(false);
    const n = parseInt(draft, 10);
    if (!Number.isFinite(n) || n < 0) {
      setDraft(String(value));
      return;
    }
    if (n !== value) onCommit(n);
  }

  return (
    <input
      type="number"
      min="0"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(String(value));
          e.currentTarget.blur();
        }
      }}
      style={{ width: '5rem', height: '1.75rem' }}
      className="px-2 text-right font-mono text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
    />
  );
}
