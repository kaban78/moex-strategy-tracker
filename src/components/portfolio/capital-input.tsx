'use client';

import { Input } from '@/components/ui/input';
import { formatRub } from '@/lib/format';

interface Props {
  capital: number;
  positionsValue: number;
  onChange: (capital: number) => void;
}

export function CapitalInput({ capital, positionsValue, onChange }: Props) {
  const cash = capital - positionsValue;
  const overflow = cash < 0;

  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs text-muted-foreground">
          Капитал счёта, ₽
        </label>
        <Input
          type="number"
          min="0"
          value={capital || ''}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
        />
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-muted-foreground">В позициях</div>
          <div className="font-medium">{formatRub(positionsValue)}</div>
        </div>
        <div>
          <div className="text-muted-foreground">Свободный кэш</div>
          <div className={'font-medium ' + (overflow ? 'text-red-500' : '')}>
            {formatRub(cash)}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">Итого</div>
          <div className="font-medium">{formatRub(capital)}</div>
        </div>
      </div>
      {overflow && (
        <p className="text-xs text-red-500">
          Позиции превышают капитал на {formatRub(-cash)}. Увеличьте капитал.
        </p>
      )}
    </div>
  );
}
