'use client';

import { useState } from 'react';
import { useTinkoff } from '@/stores/tinkoff';
import { usePortfolio } from '@/stores/portfolio';
import type { Ticker } from '@/types';
import type { TinkoffAccount } from '@/lib/tinkoff/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatRub } from '@/lib/format';

interface Props {
  universe: Ticker[];
}

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

export function TinkoffSync({ universe }: Props) {
  const { token, accountId, setToken, setAccountId, clear } = useTinkoff();
  const { replaceAll } = usePortfolio();

  const [draftToken, setDraftToken] = useState(token);
  const [accounts, setAccounts] = useState<TinkoffAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [message, setMessage] = useState<
    { kind: 'ok' | 'err'; text: string } | null
  >(null);

  async function loadAccounts() {
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
  }

  async function sync() {
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
      setMessage({
        kind: 'ok',
        text:
          'синхронизировано: ' +
          positions.length +
          ' позиций' +
          (j.skippedCount && j.skippedCount > 0
            ? ' (' + j.skippedCount + ' вне IMOEX пропущено)'
            : ''),
      });
    } catch (e) {
      setMessage({
        kind: 'err',
        text: e instanceof Error ? e.message : 'ошибка сети',
      });
    } finally {
      setLoadingSync(false);
    }
  }

  function reset() {
    clear();
    setDraftToken('');
    setAccounts([]);
    setMessage(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 flex-wrap">
          Т-Инвестиции — синхронизация портфеля
          {token && <Badge variant="secondary">токен сохранён</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Выпусти read-only токен в настройках Т-Инвестиций:
          tbank.ru/invest/settings/api/. Токен хранится локально в браузере
          и передаётся только в T-Invest API.
        </p>

        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex-1 min-w-[280px]">
            <label className="text-xs text-muted-foreground">Токен</label>
            <Input
              type="password"
              autoComplete="off"
              placeholder="t...."
              value={draftToken}
              onChange={(e) => setDraftToken(e.target.value)}
            />
          </div>
          <Button
            onClick={loadAccounts}
            disabled={loadingAccounts || !draftToken.trim()}
          >
            {loadingAccounts ? 'загрузка...' : 'получить счета'}
          </Button>
          {(token || draftToken) && (
            <Button variant="ghost" onClick={reset}>
              сбросить
            </Button>
          )}
        </div>

        {accounts.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Счёт</label>
            <div className="flex flex-wrap gap-2">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAccountId(a.id)}
                  className={
                    'px-3 py-1.5 text-xs rounded-md border transition-colors text-left ' +
                    (accountId === a.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted')
                  }
                >
                  <div className="font-medium">{a.name}</div>
                  <div className="opacity-70">{a.id}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {accountId && (
          <Button onClick={sync} disabled={loadingSync}>
            {loadingSync ? 'синхронизация...' : 'синхронизировать портфель'}
          </Button>
        )}

        {message && (
          <p
            className={
              'text-xs ' +
              (message.kind === 'ok' ? 'text-green-500' : 'text-destructive')
            }
          >
            {message.text}
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Синхронизация заменит текущий портфель. Учитываются только акции
          из IMOEX — облигации, фонды и иностранные бумаги пропускаются.
        </p>
      </CardContent>
    </Card>
  );
}
