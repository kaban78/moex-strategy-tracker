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

function shiftYears(iso: string, years: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  { label: 'с 2020', start: '2020-01-01', end: TODAY_ISO },
  { label: 'с 2022', start: '2022-01-01', end: TODAY_ISO },
  { label: 'с 2024', start: '2024-01-01', end: TODAY_ISO },
  { label: 'последний год', start: shiftYears(TODAY_ISO, -1), end: TODAY_ISO },
] as const;

interface FormState {
  startDate: string;
  endDate: string;
  initialCapital: string;
  monthlyTopUp: string;
  commissionRate: string;
}

const INITIAL_FORM: FormState = {
  startDate: '2020-01-01',
  endDate: TODAY_ISO,
  initialCapital: '100000',
  monthlyTopUp: '10000',
  commissionRate: '0.05',
};

export function BacktestForm({ onResult }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  function update<K extends keyof FormState>(key: K, value: string): void {
    setForm((f) => ({ ...f, [key]: value }));
  }

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
        startDate: form.startDate,
        endDate: form.endDate,
        initialCapital: parseInt(form.initialCapital, 10) || 100_000,
        monthlyTopUp: parseInt(form.monthlyTopUp, 10) || 0,
        commissionRate: (parseFloat(form.commissionRate) || 0) / 100,
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
              onClick={() =>
                setForm((f) => ({ ...f, startDate: p.start, endDate: p.end }))
              }
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label="От"
            type="date"
            value={form.startDate}
            onChange={(v) => update('startDate', v)}
          />
          <Field
            label="До"
            type="date"
            value={form.endDate}
            onChange={(v) => update('endDate', v)}
          />
          <Field
            label="Стартовый капитал, ₽"
            type="number"
            value={form.initialCapital}
            onChange={(v) => update('initialCapital', v)}
          />
          <Field
            label="Ежемесячное пополнение, ₽"
            type="number"
            value={form.monthlyTopUp}
            onChange={(v) => update('monthlyTopUp', v)}
          />
          <Field
            label="Комиссия брокера, %"
            type="number"
            step="0.01"
            value={form.commissionRate}
            onChange={(v) => update('commissionRate', v)}
          />
        </div>

        <div className="flex gap-3 items-center">
          <Button onClick={run} disabled={loading}>
            {loading ? `считаем... ${elapsed}с` : 'запустить бэктест'}
          </Button>
          <p className="text-xs text-muted-foreground">
            Первый запуск 5–10 мин. Повторный — из кэша, мгновенно.
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

interface FieldProps {
  label: string;
  type: string;
  value: string;
  step?: string;
  onChange: (v: string) => void;
}

function Field({ label, type, value, step, onChange }: FieldProps) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
