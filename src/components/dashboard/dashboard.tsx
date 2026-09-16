'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Ticker } from '@/types';
import { buildPortfolio } from '@/lib/universe/select';
import { computeDrift } from '@/lib/engine/drift';
import { rebalance } from '@/lib/engine/rebalance';
import { allocateLots } from '@/lib/engine/target-weights';
import { usePortfolio } from '@/stores/portfolio';
import { PortfolioEditor } from '@/components/portfolio-editor';
import { TinkoffSync } from '@/components/tinkoff/tinkoff-sync';
import { PriceChartDialog } from '@/components/price-chart/price-chart-dialog';
import { TargetPortfolioCard } from './target-portfolio-card';
import { DriftCard } from './drift-card';
import { RebalanceCard } from './rebalance-card';
import { DividendsCard } from './dividends-card';
import { PortfolioStructureCard } from './portfolio-structure-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Props {
  universe: Ticker[];
}

const FALLBACK_PORTFOLIO_VALUE = 100_000;

export function Dashboard({ universe }: Props) {
  const { positions, capital } = usePortfolio();
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

  const positionsValue = useMemo(
    () =>
      positions.reduce((s, p) => {
        const t = universe.find((u) => u.ticker === p.ticker);
        return s + (t ? t.lotSize * t.price * p.lots : 0);
      }, 0),
    [positions, universe],
  );

  const portfolioValue = useMemo(
    () => (capital > 0 ? capital : FALLBACK_PORTFOLIO_VALUE),
    [capital],
  );

  const cash = useMemo(
    () => Math.max(0, capital - positionsValue),
    [capital, positionsValue],
  );

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

  const allocationByTicker = useMemo(
    () =>
      new Map(
        allocation.allocations.map((a) => [a.ticker, a.lots] as const),
      ),
    [allocation],
  );

  return (
    <div className="space-y-6">
      <TinkoffSync universe={universe} />

      <Tabs defaultValue="portfolio" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="portfolio">Портфель</TabsTrigger>
          <TabsTrigger value="rebalance">Ребалансировка</TabsTrigger>
          <TabsTrigger value="dividends">Дивиденды</TabsTrigger>
        </TabsList>

        <TabsContent value="portfolio" className="space-y-6 mt-6">
          <PortfolioEditor lotCosts={lotCosts} />
          <PortfolioStructureCard
            holdings={plan.holdings}
            allocationByTicker={allocationByTicker}
          />
        </TabsContent>

        <TabsContent value="rebalance" className="space-y-6 mt-6">
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
        </TabsContent>

        <TabsContent value="dividends" className="space-y-6 mt-6">
          <DividendsCard
            positions={positions}
            universe={universe}
            portfolioValue={portfolioValue}
          />
        </TabsContent>
      </Tabs>

      <PriceChartDialog
        ticker={chartTicker}
        open={chartOpen}
        onOpenChange={setChartOpen}
      />
    </div>
  );
}
