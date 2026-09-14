// language: TypeScript, target: chart configuration

export const INTERVALS = [
  { label: '1ч', value: 60, maxDays: 365 },
  { label: '1д', value: 24, maxDays: 3650 },
  { label: '1н', value: 7, maxDays: 3650 },
  { label: '1м', value: 31, maxDays: 3650 },
] as const;

export const RANGES = [
  { label: '1м', days: 30 },
  { label: '3м', days: 90 },
  { label: '6м', days: 180 },
  { label: '1г', days: 365 },
  { label: '2г', days: 730 },
  { label: '5л', days: 1825 },
  { label: 'Все', days: 99999 },
] as const;

export const DEFAULT_INTERVAL = 24;
export const DEFAULT_RANGE = 365;
export const POLL_MS = 60_000;

export const DEFAULT_DIMENSIONS = { w: 1180, h: 720 } as const;
export const MIN_DIMENSIONS = { w: 600, h: 400 } as const;

/**
 * Приблизительное число торговых баров в `days` календарных днях
 * для заданного интервала.
 */
export function barsForDays(days: number, interval: number): number {
  const tradingRatio = 250 / 365;
  const perTradingDay: Record<number, number> = {
    1: 8 * 60,
    10: 8 * 6,
    60: 8,
    24: 1,
    7: 1 / 5,
    31: 1 / 22,
  };
  const ratio = perTradingDay[interval] ?? 1;
  return Math.max(2, Math.round(days * tradingRatio * ratio));
}
