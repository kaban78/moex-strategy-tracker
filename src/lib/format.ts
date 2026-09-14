// language: TypeScript, target: display formatting

export function formatRub(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

export function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: digits,
  }).format(value);
}
