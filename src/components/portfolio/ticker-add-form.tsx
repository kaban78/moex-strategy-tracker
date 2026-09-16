'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRub } from '@/lib/format';

interface Props {
  onAdd: (ticker: string, lots: number) => void;
  lotCosts: Record<string, number>;
  cash: number;
}

export function TickerAddForm({ onAdd, lotCosts, cash }: Props) {
  const [ticker, setTicker] = useState('');
  const [lots, setLots] = useState('1');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const n = parseInt(lots, 10);
    const t = ticker.trim().toUpperCase();

    if (!t || !Number.isFinite(n) || n <= 0) {
      setError('укажи тикер и количество');
      return;
    }

    const lotCost = lotCosts[t];
    if (lotCost === undefined) {
      setError(`тикер ${t} не найден в IMOEX`);
      return;
    }

    const total = lotCost * n;
    if (total > cash) {
      setError(
        `не хватает кэша: нужно ${formatRub(total)}, доступно ${formatRub(cash)}`,
      );
      return;
    }

    setError(null);
    onAdd(t, n);
    setTicker('');
    setLots('1');
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs text-muted-foreground">Тикер</label>
          <Input
            placeholder="SBER"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        <div className="w-24">
          <label className="text-xs text-muted-foreground">Лотов</label>
          <Input
            type="number"
            min="1"
            value={lots}
            onChange={(e) => setLots(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
        </div>
        <Button onClick={submit}>Добавить</Button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
