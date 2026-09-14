import { fetchUniverse } from '@/lib/moex/client';
import { DISCLAIMER_SHORT_RU } from '@/lib/legal/disclaimers';
import { formatPercent, formatRub } from '@/lib/format';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const revalidate = 300;

export default async function Home() {
  let universe: Awaited<ReturnType<typeof fetchUniverse>> = [];
  let error: string | null = null;

  try {
    universe = await fetchUniverse();
  } catch (err) {
    error = err instanceof Error ? err.message : 'unknown error';
  }

  const totalWeight = universe.reduce((s, t) => s + t.indexWeight, 0);

  return (
    <main className="container mx-auto py-10 space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">
          MOEX Strategy Tracker
        </h1>
        <p className="text-sm text-muted-foreground">{DISCLAIMER_SHORT_RU}</p>
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

      {!error && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              IMOEX — состав индекса
              <Badge variant="secondary">{universe.length} бумаг</Badge>
              <Badge variant="outline">
                Σ весов: {formatPercent(totalWeight)}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тикер</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead className="text-right">Вес</TableHead>
                  <TableHead className="text-right">Цена</TableHead>
                  <TableHead className="text-right">Лот</TableHead>
                  <TableHead className="text-right">Стоимость лота</TableHead>
                  <TableHead className="text-right">Оборот, ₽</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {universe.map((t) => (
                  <TableRow key={t.ticker}>
                    <TableCell className="font-mono font-medium">
                      {t.ticker}
                    </TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell className="text-right">
                      {formatPercent(t.indexWeight)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatRub(t.price)}
                    </TableCell>
                    <TableCell className="text-right">{t.lotSize}</TableCell>
                    <TableCell className="text-right">
                      {formatRub(t.lotSize * t.price)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatRub(t.avgDailyVolume)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
