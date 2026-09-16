'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BacktestForm } from '@/components/backtest/backtest-form';
import { BacktestMetricsCard } from '@/components/backtest/backtest-metrics-card';
import { BacktestChart } from '@/components/backtest/backtest-chart';
import { ThemeToggle } from '@/components/theme-toggle';
import type { BacktestResult } from '@/lib/backtest/types';
import { DISCLAIMER_SHORT_RU } from '@/lib/legal/disclaimers';

export default function BacktestPage() {
  const [result, setResult] = useState<BacktestResult | null>(null);

  return (
    <main className="container mx-auto py-10 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-sm text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-blue-500"
            >
              ← к портфелю
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            Бэктест — репликация IMOEX
          </h1>
          <p className="text-sm text-muted-foreground">
            {DISCLAIMER_SHORT_RU} Это ретроспективная симуляция на исторических
            данных. Прошлые результаты не определяют будущие.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <BacktestForm
        onResult={(r) => setResult(r as BacktestResult)}
      />

      {result && (
        <>
          <BacktestMetricsCard metrics={result.metrics} />
          <BacktestChart snapshots={result.snapshots} />
        </>
      )}
    </main>
  );
}
