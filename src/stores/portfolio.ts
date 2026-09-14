// language: TypeScript, target: portfolio state
// Состояние портфеля. localStorage + Zustand.
// Никаких ПДн на сервере — всё на устройстве пользователя.

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Position } from '@/types';

interface PortfolioState {
  positions: Position[];
  /** Свободный кэш на счёте, руб. */
  cash: number;
  add: (ticker: string, lots: number) => void;
  remove: (ticker: string) => void;
  setLots: (ticker: string, lots: number) => void;
  setCash: (cash: number) => void;
  clear: () => void;
}

export const usePortfolio = create<PortfolioState>()(
  persist(
    (set) => ({
      positions: [],
      cash: 0,
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
      setCash: (cash) => set({ cash: Math.max(0, cash) }),
      clear: () => set({ positions: [], cash: 0 }),
    }),
    { name: 'moex-portfolio' },
  ),
);
