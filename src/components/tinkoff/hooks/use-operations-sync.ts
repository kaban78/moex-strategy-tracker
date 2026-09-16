'use client';

import { useCallback, useState } from 'react';
import { useTinkoff } from '@/stores/tinkoff';
import { useOperations } from '@/stores/operations';
import type { Operation } from '@/lib/tinkoff/operations-types';

interface OperationsResponse {
  ok: boolean;
  count?: number;
  from?: string;
  till?: string;
  operations?: Operation[];
  error?: string;
}

export interface UseOperationsSyncResult {
  loading: boolean;
  error: string | null;
  success: string | null;
  lastSync: string | null;
  operationCount: number;
  sync: () => Promise<void>;
  clear: () => void;
}

export function useOperationsSync(): UseOperationsSyncResult {
  const { token, accountId } = useTinkoff();
  const { operations, lastSync, accountId: storedAccount, setOperations, clear } =
    useOperations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sync = useCallback(async () => {
    const t = token.trim();
    if (!t || !accountId) {
      setError('сначала подключи счёт');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/tinkoff/operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: t, accountId }),
      });
      const j = (await res.json()) as OperationsResponse;
      if (!j.ok) {
        setError(j.error ?? 'ошибка загрузки');
        return;
      }
      const ops = j.operations ?? [];
      setOperations(ops, accountId);
      setSuccess(`загружено ${ops.length} операций`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ошибка сети');
    } finally {
      setLoading(false);
    }
  }, [token, accountId, setOperations]);

  return {
    loading,
    error,
    success,
    lastSync,
    operationCount: operations.length,
    sync,
    clear,
  };
}
