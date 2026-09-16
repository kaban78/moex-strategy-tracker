// language: TypeScript, target: Tinkoff settings store
// Настройки интеграции с T-Invest API.
// Токен хранится в localStorage. В README предупреждаем о безопасности.

'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface TinkoffState {
  token: string;
  accountId: string;
  setToken: (token: string) => void;
  setAccountId: (accountId: string) => void;
  clear: () => void;
}

export const useTinkoff = create<TinkoffState>()(
  persist(
    (set) => ({
      token: '',
      accountId: '',
      setToken: (token) => set({ token: token.trim() }),
      setAccountId: (accountId) => set({ accountId }),
      clear: () => set({ token: '', accountId: '' }),
    }),
    { name: 'moex-tinkoff' },
  ),
);
