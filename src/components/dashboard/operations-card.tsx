'use client';

import { useMemo, useState } from 'react';
import { useOperations } from '@/stores/operations';
import type { Operation, OperationKind } from '@/lib/tinkoff/operations-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatInt, formatRub } from '@/lib/format';
import { DISCLAIMER_SHORT_RU } from '@/lib/legal/disclaimers';

const KIND_LABELS: Record<OperationKind, string> = {
  buy: 'Покупка',
  sell: 'Продажа',
  dividend: 'Дивиденд',
  coupon: 'Купон',
  tax: 'Налог',
  fee: 'Комиссия',
  input: 'Пополнение',
  output: 'Вывод',
  other: 'Прочее',
};

const KIND_STYLES: Record<OperationKind, string> = {
  buy: 'bg-blue-500/15 text-blue-400 border-blue-500/40',
  sell: 'bg-red-500/15 text-red-400 border-red-500/40',
  dividend: 'bg-green-500/15 text-green-400 border-green-500/40',
  coupon: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  tax: 'bg-amber-500/15 text-amber-400 border-amber-500/40',
  fee: 'bg-muted text-muted-foreground border-transparent',
  input: 'bg-green-500/20 text-green-300 border-green-500/50',
  output: 'bg-red-500/20 text-red-300 border-red-500/50',
  other: 'bg-muted text-muted-foreground border-transparent',
};

type FilterKind = 'all' | 'trades' | 'dividends' | 'cash' | 'taxes';

const FILTERS: { value: FilterKind; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'trades', label: 'Сделки' },
  { value: 'dividends', label: 'Дивиденды' },
  { value: 'taxes', label: 'Налоги и комиссии' },
  { value: 'cash', label: 'Деньги' },
];

const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
];

type SortKey = 'date' | 'kind' | 'ticker' | 'lots' | 'price' | 'payment';
type SortDir = 'asc' | 'desc';

interface SortOption {
  value: string;
  label: string;
  key: SortKey;
  dir: SortDir;
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'date-desc', label: 'Дата — свежие сверху', key: 'date', dir: 'desc' },
  { value: 'date-asc', label: 'Дата — старые сверху', key: 'date', dir: 'asc' },
  { value: 'payment-desc', label: 'Сумма — от больших', key: 'payment', dir: 'desc' },
  { value: 'payment-asc', label: 'Сумма — от меньших', key: 'payment', dir: 'asc' },
  { value: 'kind-asc', label: 'Тип — А → Я', key: 'kind', dir: 'asc' },
  { value: 'kind-desc', label: 'Тип — Я → А', key: 'kind', dir: 'desc' },
  { value: 'ticker-asc', label: 'Тикер — А → Я', key: 'ticker', dir: 'asc' },
  { value: 'ticker-desc', label: 'Тикер — Я → А', key: 'ticker', dir: 'desc' },
  { value: 'lots-desc', label: 'Лотов — больше', key: 'lots', dir: 'desc' },
  { value: 'lots-asc', label: 'Лотов — меньше', key: 'lots', dir: 'asc' },
  { value: 'price-desc', label: 'Цена — выше', key: 'price', dir: 'desc' },
  { value: 'price-asc', label: 'Цена — ниже', key: 'price', dir: 'asc' },
];

function matchesFilter(op: Operation, filter: FilterKind): boolean {
  if (filter === 'all') return true;
  if (filter === 'trades') return op.kind === 'buy' || op.kind === 'sell';
  if (filter === 'dividends')
    return op.kind === 'dividend' || op.kind === 'coupon';
  if (filter === 'taxes') return op.kind === 'tax' || op.kind === 'fee';
  if (filter === 'cash') return op.kind === 'input' || op.kind === 'output';
  return true;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', {
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function compare(a: Operation, b: Operation, key: SortKey): number {
  switch (key) {
    case 'date':
      return a.date.localeCompare(b.date);
    case 'kind':
      return a.kind.localeCompare(b.kind);
    case 'ticker':
      return (a.ticker ?? '').localeCompare(b.ticker ?? '');
    case 'lots':
      return a.lots - b.lots;
    case 'price':
      return a.price - b.price;
    case 'payment':
      return a.payment - b.payment;
    default:
      return 0;
  }
}

interface YearOption {
  year: number;
  count: number;
}

export function OperationsCard() {
  const { operations, lastSync } = useOperations();
  const [filter, setFilter] = useState<FilterKind>('all');
  const [query, setQuery] = useState('');
  const [year, setYear] = useState<number | 'all'>('all');
  const [month, setMonth] = useState<number | 'all'>('all');
  const [limit, setLimit] = useState(100);
  const [sortValue, setSortValue] = useState<string>('date-desc');

  const sortOption =
    SORT_OPTIONS.find((o) => o.value === sortValue) ?? SORT_OPTIONS[0];

  const years = useMemo<YearOption[]>(() => {
    const map = new Map<number, number>();
    for (const o of operations) {
      const y = new Date(o.date).getUTCFullYear();
      map.set(y, (map.get(y) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => b.year - a.year);
  }, [operations]);

  const monthsInYear = useMemo(() => {
    const map = new Map<number, number>();
    for (const o of operations) {
      const d = new Date(o.date);
      const y = d.getUTCFullYear();
      if (year !== 'all' && y !== year) continue;
      const m = d.getUTCMonth();
      map.set(m, (map.get(m) ?? 0) + 1);
    }
    return map;
  }, [operations, year]);

  const filtered = useMemo(() => {
    const q = query.trim().toUpperCase();
    return operations.filter((o) => {
      if (!matchesFilter(o, filter)) return false;
      const d = new Date(o.date);
      if (year !== 'all' && d.getUTCFullYear() !== year) return false;
      if (month !== 'all' && d.getUTCMonth() !== month) return false;
      if (q && (!o.ticker || !o.ticker.includes(q))) return false;
      return true;
    });
  }, [operations, filter, query, year, month]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const c = compare(a, b, sortOption.key);
      return sortOption.dir === 'asc' ? c : -c;
    });
    return arr;
  }, [filtered, sortOption]);

  const visible = sorted.slice(0, limit);

  const totals = useMemo(() => {
    const acc: Record<string, number> = {
      buy: 0,
      sell: 0,
      dividend: 0,
      coupon: 0,
      tax: 0,
      fee: 0,
      input: 0,
      output: 0,
    };
    for (const o of operations) {
      if (o.kind in acc) acc[o.kind] += o.payment;
    }
    return acc;
  }, [operations]);

  const filterCounts = useMemo(() => {
    const counts: Record<FilterKind, number> = {
      all: operations.length,
      trades: 0,
      dividends: 0,
      taxes: 0,
      cash: 0,
    };
    for (const o of operations) {
      if (matchesFilter(o, 'trades')) counts.trades++;
      if (matchesFilter(o, 'dividends')) counts.dividends++;
      if (matchesFilter(o, 'taxes')) counts.taxes++;
      if (matchesFilter(o, 'cash')) counts.cash++;
    }
    return counts;
  }, [operations]);

  if (operations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>История операций</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            История не загружена. Нажми «загрузить историю операций»
            в блоке синхронизации с Т-Инвестициями.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasActiveFilters =
    year !== 'all' || month !== 'all' || query !== '' || filter !== 'all';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3 flex-wrap">
          История операций
          <Badge variant="outline">{formatInt(operations.length)} всего</Badge>
          {lastSync && (
            <span className="text-xs text-muted-foreground ml-auto">
              обновлено {new Date(lastSync).toLocaleString('ru-RU')}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryTile
            label="Пополнения"
            value={totals.input}
            accent="text-emerald-400"
          />
          <SummaryTile
            label="Выводы"
            value={totals.output}
            accent="text-red-400"
          />
          <SummaryTile
            label="Дивиденды и купоны"
            value={totals.dividend + totals.coupon}
            accent="text-green-400"
          />
          <SummaryTile
            label="Налоги и комиссии"
            value={totals.tax + totals.fee}
            accent="text-amber-400"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">год:</span>
          <button
            type="button"
            onClick={() => {
              setYear('all');
              setMonth('all');
            }}
            className={
              'px-3 py-1 text-xs rounded-md border transition-colors ' +
              (year === 'all'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted')
            }
          >
            Все
          </button>
          {years.map((y) => (
            <button
              key={y.year}
              type="button"
              onClick={() => {
                setYear(y.year);
                setMonth('all');
              }}
              className={
                'px-3 py-1 text-xs rounded-md border transition-colors ' +
                (year === y.year
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted')
              }
            >
              {y.year}
              <span className="ml-1.5 opacity-60">{formatInt(y.count)}</span>
            </button>
          ))}
        </div>

        {year !== 'all' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">месяц:</span>
            <button
              type="button"
              onClick={() => setMonth('all')}
              className={
                'px-2 py-1 text-xs rounded-md border transition-colors ' +
                (month === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted')
              }
            >
              Все
            </button>
            {MONTHS_SHORT.map((label, m) => {
              const c = monthsInYear.get(m) ?? 0;
              if (c === 0) return null;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMonth(m)}
                  className={
                    'px-2 py-1 text-xs rounded-md border transition-colors ' +
                    (month === m
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted')
                  }
                >
                  {label}
                  <span className="ml-1 opacity-60">{c}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex gap-2 flex-wrap items-center">
          <Input
            placeholder="Тикер…"
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            className="w-32"
          />

          <select
            value={sortValue}
            onChange={(e) => setSortValue(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div className="flex gap-1 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={
                  'px-3 py-1 text-xs rounded-md border transition-colors ' +
                  (filter === f.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted')
                }
              >
                {f.label}
                <span className="ml-1.5 opacity-60">
                  {formatInt(filterCounts[f.value])}
                </span>
              </button>
            ))}
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setYear('all');
                setMonth('all');
                setQuery('');
                setFilter('all');
                setLimit(100);
              }}
              className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground ml-auto"
            >
              сбросить фильтры
            </button>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          Показано {formatInt(visible.length)} из {formatInt(filtered.length)}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Тип</TableHead>
              <TableHead>Тикер</TableHead>
              <TableHead className="text-right">Лотов</TableHead>
              <TableHead className="text-right">Цена</TableHead>
              <TableHead className="text-right">Сумма</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((o) => (
              <TableRow key={o.id}>
                <TableCell className="text-xs font-mono whitespace-nowrap">
                  {fmtDate(o.date)}
                </TableCell>
                <TableCell>
                  <span
                    className={
                      'inline-block px-2 py-0.5 rounded border text-[11px] ' +
                      KIND_STYLES[o.kind]
                    }
                  >
                    {KIND_LABELS[o.kind]}
                  </span>
                </TableCell>
                <TableCell className="font-mono">{o.ticker ?? '—'}</TableCell>
                <TableCell className="text-right">
                  {o.lots > 0 ? formatInt(o.lots) : '—'}
                </TableCell>
                <TableCell className="text-right">
                  {o.price > 0 ? formatRub(o.price) : '—'}
                </TableCell>
                <TableCell
                  className={
                    'text-right font-medium ' +
                    (o.payment > 0
                      ? 'text-green-500'
                      : o.payment < 0
                        ? 'text-red-500'
                        : '')
                  }
                >
                  {o.payment > 0 ? '+' : ''}
                  {formatRub(o.payment)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filtered.length > limit && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => setLimit(limit + 100)}
              className="text-xs text-muted-foreground underline decoration-dotted underline-offset-4 hover:text-foreground"
            >
              показать ещё 100 (осталось{' '}
              {formatInt(filtered.length - limit)})
            </button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {DISCLAIMER_SHORT_RU} Данные из T-Invest API.
        </p>
      </CardContent>
    </Card>
  );
}

interface TileProps {
  label: string;
  value: number;
  accent: string;
}

function SummaryTile({ label, value, accent }: TileProps) {
  return (
    <div className="p-2 rounded border text-xs">
      <div className="text-muted-foreground">{label}</div>
      <div className={'font-mono font-medium mt-0.5 ' + accent}>
        {value > 0 ? '+' : ''}
        {formatRub(value)}
      </div>
    </div>
  );
}
