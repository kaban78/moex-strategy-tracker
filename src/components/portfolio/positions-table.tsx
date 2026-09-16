'use client';

import { useEffect, useRef, useState } from 'react';
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
          <TableHead className="text-right w-24">Лотов</TableHead>
          <TableHead className="text-right">Лот, ₽</TableHead>
          <TableHead className="text-right">Стоимость</TableHead>
          <TableHead className="w-10" />
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
  // Защита от undefined/NaN — иначе type=number покажет пустоту.
  const safe = Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;

  const [draft, setDraft] = useState(String(safe));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setDraft(String(safe));
    }
  }, [safe]);

  function commit() {
    const n = parseInt(draft, 10);
    if (!Number.isFinite(n) || n < 0) {
      setDraft(String(safe));
      return;
    }
    if (n !== safe) onCommit(n);
    else setDraft(String(safe));
  }

  return (
    <input
      ref={inputRef}
      type="number"
      min="0"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(String(safe));
          e.currentTarget.blur();
        }
      }}
      className="ml-auto block h-7 w-20 rounded border border-input bg-transparent px-2 text-right font-mono text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    />
  );
}
