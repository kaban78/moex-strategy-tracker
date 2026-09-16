'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BacktestForm } from '@/components/backtest/backtest-form';
import { BacktestMetricsCard } from '@/components/backtest/backtest-metrics-card';
import { BacktestChart } from '@/components/backtest/backtest-chart';
import { RatesChart } from '@/components/backtest/rates-chart';
import { ThemeToggle } from '@/components/theme-toggle';
import type { BacktestResult } from '@/lib/backtest/types';
import type { RatePoint } from '@/lib/cbr/client';
import { DISCLAIMER_SHORT_RU } from '@/lib/legal/disclaimers';

export default function BacktestPage() {
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [keyRate, setKeyRate] = useState<RatePoint[]>([]);
  const [depositRate, setDepositRate] = useState<RatePoint[]>([]);

  useEffect(() => {
    if (!result) return;
    const from = result.params.startDate;
    const till = result.params.endDate;
    fetch(`/api/rates?from=${from}&till=${till}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setKeyRate(j.keyRate ?? []);
          setDepositRate(j.depositRate ?? []);
        }
      })
      .catch(() => {});
  }, [result]);

  return (
    <main className="container mx-auto py-10 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <Link
            href="/"
            className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-blue-500"
          >
            ← к портфелю
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            Бэктест — репликация IMOEX
          </h1>
          <p className="text-sm text-muted-foreground">
            {DISCLAIMER_SHORT_RU} Ретроспективная симуляция на исторических
            данных. Прошлые результаты не определяют будущие.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <BacktestForm onResult={(r) => setResult(r as BacktestResult)} />

      {result && (
        <>
          <BacktestMetricsCard metrics={result.metrics} />

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Портфель vs IMOEX vs MCFTR</h2>
            <p className="text-xs text-muted-foreground">
              IMOEX — ценовой индекс. MCFTR — индекс полной доходности
              (с дивидендами). Синяя пунктирная — сумма вложений.
            </p>
            <BacktestChart snapshots={result.snapshots} />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold">
              Ключевая ставка ЦБ и ставки по вкладам
            </h2>
            <p className="text-xs text-muted-foreground">
              Красная — ключевая ставка ЦБ РФ. Синяя — средняя максимальная
              ставка по вкладам в топ-10 банках. Сравните с доходностью
              портфеля: если вклады дают больше — акции не оправданы.
            </p>
            <RatesChart keyRate={keyRate} depositRate={depositRate} />
          </div>
        </>
      )}
    </main>
  );
}
