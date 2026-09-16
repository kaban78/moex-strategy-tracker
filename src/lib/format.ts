// language: TypeScript, target: display formatting
// Единая точка форматирования чисел в UI.
// Все числа с разделителями разрядов (ru-RU использует узкий пробел).

const rubFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const intFormatter = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Рубли с разделителями. До 2 знаков после запятой. */
export function formatRub(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return rubFormatter.format(value);
}

/** Целое с разделителями: 1 000 000. */
export function formatInt(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return intFormatter.format(value);
}

/** Число до 2 знаков с разделителями: 12 345,67. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return decimalFormatter.format(value);
}

/** Проценты: 12,34%. */
export function formatPercent(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(digits).replace('.', ',')}%`;
}
