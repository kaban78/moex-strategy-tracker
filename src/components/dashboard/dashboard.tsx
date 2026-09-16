'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Ticker } from '@/types';
import { buildPortfolio } from '@/lib/universe/select';
import { computeDrift } from '@/lib/engine/drift';
import { rebalance } from '@/lib/engine/rebalance';
import { allocateLots } from '@/lib/engine/target-weights';
import { usePortfolio } from '@/stores/portfolio';
import { PortfolioEditor } from '@/components/portfolio-editor';
import { PriceChartDialog } from '@/components/price-chart/price-chart-dialog';
import { TargetPortfolioCard } from './target-portfolio-card';
import { DriftCard } from './drift-card';
import { RebalanceCard } from './rebalance-card';
import { DividendsCard } from './dividends-card';
import { TinkoffSync } from '@/components/tinkoff-sync';

interface Props {
  universe: Ticker[];
}

const FALLBACK_PORTFOLIO_VALUE = 100_000;

export function Dashboard({ universe }: Props) {
  const { positions, cash } = usePortfolio();
  const [chartTicker, setChartTicker] = useState<string | null>(null);
  const [chartOpen, setChartOpen] = useState(false);

  const handleTickerClick = useCallback((ticker: string) => {
    setChartTicker(ticker);
    setChartOpen(true);
  }, []);

  const lotCosts = useMemo(
    () =>
      Object.fromEntries(universe.map((t) => [t.ticker, t.lotSize * t.price])),
    [universe],
  );

  const portfolioValue = useMemo(() => {
    const posValue = positions.reduce((s, p) => {
      const t = universe.find((u) => u.ticker === p.ticker);
      return s + (t ? t.lotSize * t.price * p.lots : 0);
    }, 0);
    const total = posValue + cash;
    return total > 0 ? total : FALLBACK_PORTFOLIO_VALUE;
  }, [positions, universe, cash]);

  const plan = useMemo(
    () => buildPortfolio(universe, { portfolioValue }),
    [universe, portfolioValue],
  );

  const drift = useMemo(
    () =>
      computeDrift({
        positions,
        universe,
        targetWeights: plan.holdings,
        cash,
      }),
    [positions, universe, plan.holdings, cash],
  );

  const rebalancePlan = useMemo(
    () => rebalance({ drifts: drift.drifts, universe, cash }),
    [drift.drifts, universe, cash],
  );

  const allocation = useMemo(
    () => allocateLots(plan.holdings, universe, { portfolioValue }),
    [plan.holdings, universe, portfolioValue],
  );

  return (
    <div className="space-y-6">
      <TinkoffSync universe={universe} />
      <PortfolioEditor lotCosts={lotCosts} />

      <TargetPortfolioCard
        holdings={plan.holdings}
        omittedCount={plan.omitted.length}
        omissionWeight={plan.omissionWeight}
        estimatedTrackingError={plan.estimatedTrackingError}
        portfolioValue={portfolioValue}
        allocation={allocation}
        onTickerClick={handleTickerClick}
      />

      {positions.length > 0 && (
        <DriftCard
          drifts={drift.drifts}
          maxDrift={drift.maxDrift}
          turnover={drift.turnover}
          onTickerClick={handleTickerClick}
        />
      )}

      <RebalanceCard
        rebalancePlan={rebalancePlan}
        onTickerClick={handleTickerClick}
      />

      <DividendsCard
        positions={positions}
        universe={universe}
        portfolioValue={portfolioValue}
      />

      <PriceChartDialog
        ticker={chartTicker}
        open={chartOpen}
        onOpenChange={setChartOpen}
      />
    </div>
  );
}
