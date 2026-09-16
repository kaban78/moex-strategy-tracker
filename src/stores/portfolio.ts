// language: TypeScript, target: portfolio state
// Состояние портфеля. localStorage + Zustand.
//
// Модель: один источник правды — capital (общий капитал счёта).
// Свободный кэш = capital − positionsValue, вычисляется в UI.
// Никаких ПДн на сервере — всё на устройстве пользователя.

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Position } from '@/types';

interface PortfolioState {
  positions: Position[];
  /** Общий капитал счёта: позиции + свободный кэш, ₽. */
  capital: number;
  add: (ticker: string, lots: number) => void;
  remove: (ticker: string) => void;
  setLots: (ticker: string, lots: number) => void;
  setCapital: (capital: number) => void;
  clear: () => void;
  replaceAll: (positions: Position[], capital: number) => void;
  applyRebalance: (actions: RebalanceAction[]) => void;
}

interface RebalanceAction {
  ticker: string;
  side: 'buy' | 'sell';
  lots: number;
}

interface PersistedV1 {
  positions?: Position[];
  cash?: number;
}

export const usePortfolio = create<PortfolioState>()(
  persist(
    (set) => ({
      positions: [],
      capital: 0,

      add: (ticker, lots) =>
        set((s) => {
          const t = ticker.toUpperCase().trim();
          if (!t || lots <= 0) return s;
          const existing = s.positions.find((p) => p.ticker === t);
          if (existing) {
            return {
              positions: s.positions.map((p) =>
                p.ticker === t ? { ...p, lots: p.lots + lots } : p,
              ),
            };
          }
          return { positions: [...s.positions, { ticker: t, lots }] };
        }),

      remove: (ticker) =>
        set((s) => ({
          positions: s.positions.filter((p) => p.ticker !== ticker),
        })),

      setLots: (ticker, lots) =>
        set((s) => ({
          positions:
            lots <= 0
              ? s.positions.filter((p) => p.ticker !== ticker)
              : s.positions.map((p) =>
                  p.ticker === ticker ? { ...p, lots } : p,
                ),
        })),

      setCapital: (capital) => set({ capital: Math.max(0, capital) }),

      clear: () => set({ positions: [], capital: 0 }),

      replaceAll: (positions, capital) =>
        set({
          positions: positions.map((p) => ({ ...p })),
          capital: Math.max(0, capital),
        }),

      applyRebalance: (actions) =>
        set((s) => {
          let next = s.positions.map((p) => ({ ...p }));
          for (const a of actions) {
            if (a.side === 'buy') {
              const existing = next.find((p) => p.ticker === a.ticker);
              if (existing) existing.lots += a.lots;
              else next.push({ ticker: a.ticker, lots: a.lots });
            } else {
              const existing = next.find((p) => p.ticker === a.ticker);
              if (!existing) continue;
              existing.lots -= a.lots;
            }
          }
          next = next.filter((p) => p.lots > 0);
          return { positions: next };
        }),
    }),
    {
      name: 'moex-portfolio',
      version: 2,
      migrate: (persistedState, version) => {
        // Миграция со старой схемы: cash был свободным кэшем.
        // В новой схеме capital = общий счёт. Простейший маппинг:
        // старое cash → новое capital. Позиции пересчитаются в UI.
        if (version < 2 && persistedState) {
          const old = persistedState as PersistedV1;
          if (typeof old.cash === 'number') {
            return {
              ...(persistedState as object),
              capital: old.cash,
            };
          }
        }
        return persistedState;
      },
    },
  ),
);
