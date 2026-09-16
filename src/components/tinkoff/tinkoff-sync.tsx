'use client';

import type { Ticker } from '@/types';
import { useTinkoffSync } from './hooks/use-tinkoff-sync';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Props {
  universe: Ticker[];
}

export function TinkoffSync({ universe }: Props) {
  const {
    mounted,
    draftToken,
    setDraftToken,
    accounts,
    accountId,
    setAccountId,
    savedToken,
    loadingAccounts,
    loadingSync,
    message,
    loadAccounts,
    sync,
    reset,
  } = useTinkoffSync(universe);

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Т-Инвестиции — синхронизация портфеля</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">загрузка...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 flex-wrap">
          Т-Инвестиции — синхронизация портфеля
          {savedToken && <Badge variant="secondary">токен сохранён</Badge>}
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
          {(savedToken || draftToken) && (
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
