'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  onAdd: (ticker: string, lots: number) => void;
}

export function TickerAddForm({ onAdd }: Props) {
  const [ticker, setTicker] = useState('');
  const [lots, setLots] = useState('1');

  function submit() {
    const n = parseInt(lots, 10);
    if (!ticker.trim() || !Number.isFinite(n) || n <= 0) return;
    onAdd(ticker, n);
    setTicker('');
    setLots('1');
  }

  return (
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
  );
}
