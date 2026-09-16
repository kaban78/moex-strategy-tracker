import { describe, it, expect } from 'vitest';
import {
  nearestTradingDay,
  monthStarts,
} from '@/lib/backtest/calendar';

describe('nearestTradingDay', () => {
  const cal = [
    '2024-05-27',
    '2024-05-28',
    '2024-05-29',
    '2024-05-30',
    '2024-05-31',
    '2024-06-03',
    '2024-06-04',
    '2024-06-05',
  ];

  it('точное совпадение', () => {
    expect(nearestTradingDay('2024-05-29', cal)).toBe('2024-05-29');
  });

  it('суббота → предыдущая пятница', () => {
    expect(nearestTradingDay('2024-06-01', cal)).toBe('2024-05-31');
  });

  it('воскресенье → предыдущая пятница', () => {
    expect(nearestTradingDay('2024-06-02', cal)).toBe('2024-05-31');
  });

  it('до начала календаря → null', () => {
    expect(nearestTradingDay('2024-01-01', cal)).toBeNull();
  });

  it('пустой календарь → null', () => {
    expect(nearestTradingDay('2024-06-01', [])).toBeNull();
  });

  it('дата после конца календаря → последний день', () => {
    expect(nearestTradingDay('2030-01-01', cal)).toBe('2024-06-05');
  });
});

describe('monthStarts', () => {
  const cal = [
    '2024-04-30',
    '2024-05-31',
    '2024-06-03',
    '2024-06-28',
    '2024-07-31',
  ];

  it('первые числа месяцев → ближайший торговый день ≤ 1-е', () => {
    const r = monthStarts('2024-05-01', '2024-07-01', cal);
    expect(r).toEqual(['2024-04-30', '2024-05-31', '2024-06-28']);
  });

  it('дедупликация если 1-е двух месяцев дают один день', () => {
    const r = monthStarts('2024-05-01', '2024-05-15', cal);
    expect(r).toEqual(['2024-04-30']);
  });

  it('пустой календарь → пустой результат', () => {
    const r = monthStarts('2024-05-01', '2024-07-01', []);
    expect(r).toEqual([]);
  });
});
