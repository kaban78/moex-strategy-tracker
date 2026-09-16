'use client';

import { useState } from 'react';
import type { BacktestParams } from '@/lib/backtest/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DISCLAIMER_SHORT_RU } from '@/lib/legal/disclaimers';

interface Props {
  onResult: (result: unknown, params: BacktestParams) => void;
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);

const PRESETS = [
  { label: 'с 2020', start: '2020-01-01', end: TODAY_ISO },
  { label: 'с 2022', start: '2022-01-01', end: TODAY_ISO },
  { label: 'с 2024', start: '2024-01-01', end: TODAY_ISO },
  { label: 'последний год', start: shiftYears(TODAY_ISO, -1), end: TODAY_ISO },
] as const;

function shiftYears(iso: string, years: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function BacktestForm({ onResult }: Props) {
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState(TODAY_ISO);
  const [initialCapital, setInitialCapital] = useState('100000');
  const [monthlyTopUp, setMonthlyTopUp] = useState('10000');
  const [commissionRate, setCommissionRate] = useState('0.05');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  async function run() {
    setError(null);
    setLoading(true);
    setElapsed(0);

    const start = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - start) / 1000));
    }, 1000);

    try {
      const params: BacktestParams = {
        startDate,
        endDate,
        initialCapital: parseInt(initialCapital, 10) || 100_000,
        monthlyTopUp: parseInt(monthlyTopUp, 10) || 0,
        commissionRate: (parseFloat(commissionRate) || 0) / 100,
      };
      const res = await fetch('/api/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const j = await res.json();
      if (!j.ok) {
        setError(j.error ?? 'ошибка');
        return;
      }
      onResult(j.result, params);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ошибка сети');
    } finally {
      window.clearInterval(timer);
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Параметры бэктеста</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate(p.start);
                setEndDate(p.end);
              }}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">От</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">До</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Стартовый капитал, ₽
            </label>
            <Input
              type="number"
              value={initialCapital}
              onChange={(e) => setInitialCapital(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Ежемесячное пополнение, ₽
            </label>
            <Input
              type="number"
              value={monthlyTopUp}
              onChange={(e) => setMonthlyTopUp(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">
              Комиссия брокера, %
            </label>
            <Input
              type="number"
              step="0.01"
              value={commissionRate}
              onChange={(e) => setCommissionRate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3 items-center">
          <Button onClick={run} disabled={loading}>
            {loading ? 'считаем... ' + elapsed + 'с' : 'запустить бэктест'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Первый запуск — 30–60 сек. Повторный — из кэша, мгновенно.
          </p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <p className="text-xs text-muted-foreground">
          {DISCLAIMER_SHORT_RU} Прошлые результаты не определяют будущие.
        </p>
      </CardContent>
    </Card>
  );
}
