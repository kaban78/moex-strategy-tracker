'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTinkoff } from '@/stores/tinkoff';
import { usePortfolio } from '@/stores/portfolio';
import type { Ticker } from '@/types';
import type { TinkoffAccount } from '@/lib/tinkoff/types';

interface AccountsResponse {
  ok: boolean;
  accounts?: TinkoffAccount[];
  error?: string;
}

interface PortfolioResponse {
  ok: boolean;
  positions?: { ticker: string; lots: number }[];
  rawCount?: number;
  skippedCount?: number;
  totalValue?: { units: string; nano: number; currency: string } | null;
  error?: string;
}

export interface SyncMessage {
  kind: 'ok' | 'err';
  text: string;
}

export interface UseTinkoffSyncResult {
  mounted: boolean;
  draftToken: string;
  setDraftToken: (v: string) => void;
  accounts: TinkoffAccount[];
  accountId: string;
  setAccountId: (id: string) => void;
  savedToken: string;
  loadingAccounts: boolean;
  loadingSync: boolean;
  message: SyncMessage | null;
  loadAccounts: () => Promise<void>;
  sync: () => Promise<void>;
  reset: () => void;
}

export function useTinkoffSync(
  universe: Ticker[],
): UseTinkoffSyncResult {
  const { token, accountId, setToken, setAccountId, clear } = useTinkoff();
  const { replaceAll } = usePortfolio();

  const [mounted, setMounted] = useState(false);
  const [draftToken, setDraftToken] = useState('');
  const [accounts, setAccounts] = useState<TinkoffAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [message, setMessage] = useState<SyncMessage | null>(null);

  useEffect(() => {
    setMounted(true);
    setDraftToken(token);
  }, [token]);

  const loadAccounts = useCallback(async () => {
    const t = draftToken.trim();
    if (!t) {
      setMessage({ kind: 'err', text: 'введи токен' });
      return;
    }

    setLoadingAccounts(true);
    setMessage(null);
    try {
      const res = await fetch('/api/tinkoff/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t }),
      });
      const j = (await res.json()) as AccountsResponse;
      if (!j.ok) {
        setMessage({ kind: 'err', text: j.error ?? 'ошибка' });
        return;
      }
      const list = j.accounts ?? [];
      setAccounts(list);
      setToken(t);
      if (list.length > 0 && !list.some((a) => a.id === accountId)) {
        setAccountId(list[0].id);
      }
      setMessage({ kind: 'ok', text: 'счета получены: ' + list.length });
    } catch (e) {
      setMessage({
        kind: 'err',
        text: e instanceof Error ? e.message : 'ошибка сети',
      });
    } finally {
      setLoadingAccounts(false);
    }
  }, [draftToken, accountId, setToken, setAccountId]);

  const sync = useCallback(async () => {
    const t = token.trim();
    if (!t || !accountId) {
      setMessage({ kind: 'err', text: 'сначала выбери счёт' });
      return;
    }

    setLoadingSync(true);
    setMessage(null);
    try {
      const allowedTickers = universe.map((u) => u.ticker);
      const res = await fetch('/api/tinkoff/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t, accountId, allowedTickers }),
      });
      const j = (await res.json()) as PortfolioResponse;
      if (!j.ok) {
        setMessage({ kind: 'err', text: j.error ?? 'ошибка' });
        return;
      }
      const positions = j.positions ?? [];
      replaceAll(positions);
      const skipped = j.skippedCount ?? 0;
      setMessage({
        kind: 'ok',
        text:
          'синхронизировано: ' +
          positions.length +
          ' позиций' +
          (skipped > 0 ? ' (' + skipped + ' вне IMOEX пропущено)' : ''),
      });
    } catch (e) {
      setMessage({
        kind: 'err',
        text: e instanceof Error ? e.message : 'ошибка сети',
      });
    } finally {
      setLoadingSync(false);
    }
  }, [token, accountId, universe, replaceAll]);

  const reset = useCallback(() => {
    clear();
    setDraftToken('');
    setAccounts([]);
    setMessage(null);
  }, [clear]);

  return {
    mounted,
    draftToken,
    setDraftToken,
    accounts,
    accountId,
    setAccountId,
    savedToken: token,
    loadingAccounts,
    loadingSync,
    message,
    loadAccounts,
    sync,
    reset,
  };
}
