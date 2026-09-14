import { fetchUniverse } from '@/lib/moex/client';
import { Dashboard } from '@/components/dashboard/dashboard';
import { ThemeToggle } from '@/components/theme-toggle';
import { DISCLAIMER_SHORT_RU } from '@/lib/legal/disclaimers';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const revalidate = 300;

export default async function Home() {
  let universe: Awaited<ReturnType<typeof fetchUniverse>> = [];
  let error: string | null = null;

  try {
    universe = await fetchUniverse();
  } catch (err) {
    error = err instanceof Error ? err.message : 'unknown error';
  }

  return (
    <main className="container mx-auto py-10 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">
            MOEX Strategy Tracker
          </h1>
          <p className="text-sm text-muted-foreground">
            {DISCLAIMER_SHORT_RU}
          </p>
        </div>
        <ThemeToggle />
      </header>

      {error && (
        <Card>
          <CardHeader>
            <CardTitle>Ошибка загрузки данных</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Если включён VPN — выключите и обновите страницу.
            </p>
          </CardContent>
        </Card>
      )}

      {!error && <Dashboard universe={universe} />}
    </main>
  );
}
