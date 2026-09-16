'use client';

import { useMemo, useState } from 'react';
import type { TargetWeight } from '@/types';
import { getSector, SECTOR_COLORS, type Sector } from '@/lib/moex/sectors';
import { Donut } from './donut';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPercent } from '@/lib/format';

interface Props {
  holdings: TargetWeight[];
  allocationByTicker: Map<string, number>;
}

type Mode = 'tickers' | 'sectors';

const PALETTE = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ec4899', '#a855f7',
  '#06b6d4', '#f97316', '#10b981', '#8b5cf6', '#eab308',
  '#ef4444', '#84cc16', '#14b8a6', '#f43f5e', '#6366f1',
  '#eab308', '#0ea5e9', '#a855f7', '#10b981', '#f59e0b',
];

export function PortfolioStructureCard({
  holdings,
  allocationByTicker,
}: Props) {
  const [mode, setMode] = useState<Mode>('sectors');

  const tickerSlices = useMemo(
    () =>
      holdings
        .map((h, i) => ({
          label: h.ticker,
          value: h.weight,
          color: PALETTE[i % PALETTE.length],
        }))
        .sort((a, b) => b.value - a.value),
    [holdings],
  );

  const sectorSlices = useMemo(() => {
    const bySector = new Map<Sector, number>();
    for (const h of holdings) {
      const s = getSector(h.ticker);
      bySector.set(s, (bySector.get(s) ?? 0) + h.weight);
    }
    return Array.from(bySector.entries())
      .map(([label, value]) => ({
        label,
        value,
        color: SECTOR_COLORS[label as Sector] ?? '#737373',
      }))
      .sort((a, b) => b.value - a.value);
  }, [holdings]);

  const slices = mode === 'sectors' ? sectorSlices : tickerSlices;
  const totalPositions = holdings.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 flex-wrap">
          Структура портфеля
          <div className="ml-auto flex gap-1">
            <Button
              variant={mode === 'sectors' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('sectors')}
            >
              секторы
            </Button>
            <Button
              variant={mode === 'tickers' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('tickers')}
            >
              бумаги
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-6 items-start">
          <div className="shrink-0">
            <Donut
              slices={slices}
              centerValue={String(totalPositions)}
              centerLabel="бумаг"
            />
          </div>
          <div className="flex-1 min-w-[240px] space-y-1.5">
            {slices.map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="flex-1 truncate">
                  {s.label}
                  {mode === 'tickers' && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {allocationByTicker.get(s.label) ?? 0} лот
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {formatPercent(s.value * 100)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
