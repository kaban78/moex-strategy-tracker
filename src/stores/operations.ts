// language: TypeScript, target: operations store
// История операций. localStorage + Zustand.

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Operation } from '@/lib/tinkoff/operations-types';

interface OperationsState {
  operations: Operation[];
  /** Дата последней синхронизации. */
  lastSync: string | null;
  /** Откуда синхронизировано. */
  accountId: string | null;
  setOperations: (ops: Operation[], accountId: string) => void;
  clear: () => void;
}

export const useOperations = create<OperationsState>()(
  persist(
    (set) => ({
      operations: [],
      lastSync: null,
      accountId: null,
      setOperations: (ops, accountId) =>
        set({
          operations: ops,
          lastSync: new Date().toISOString(),
          accountId,
        }),
      clear: () =>
        set({ operations: [], lastSync: null, accountId: null }),
    }),
    { name: 'moex-operations' },
  ),
);
