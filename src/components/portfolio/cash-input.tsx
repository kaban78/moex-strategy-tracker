'use client';

import { Input } from '@/components/ui/input';
import { formatRub } from '@/lib/format';

interface Props {
  cash: number;
  portfolioValue: number;
  onChange: (cash: number) => void;
}

export function CashInput({ cash, portfolioValue, onChange }: Props) {
  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1">
        <label className="text-xs text-muted-foreground">Свободный кэш, ₽</label>
        <Input
          type="number"
          min="0"
          value={cash || ''}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        />
      </div>
      <div className="text-right text-sm text-muted-foreground pb-2">
        Стоимость портфеля: <strong>{formatRub(portfolioValue)}</strong>
      </div>
    </div>
  );
}
