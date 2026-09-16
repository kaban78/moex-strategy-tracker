import { describe, it, expect } from 'vitest';
import {
  moneyToNumber,
  quantityToLots,
  resolveTicker,
  normalizePortfolio,
} from '@/lib/tinkoff/parse';
import type { TinkoffPosition } from '@/lib/tinkoff/types';

function makePosition(
  overrides: Partial<TinkoffPosition>,
): TinkoffPosition {
  return {
    figi: 'BBG004730N88',
    instrumentType: 'share',
    quantity: { currency: 'rub', units: '10', nano: 0 },
    averagePositionPrice: { currency: 'rub', units: '250', nano: 0 },
    currentPrice: { currency: 'rub', units: '300', nano: 0 },
    expectedYield: { currency: 'rub', units: '500', nano: 0 },
    instrumentUid: 'uid-sber',
    ...overrides,
  };
}

describe('moneyToNumber', () => {
  it('сумма без дробной части', () => {
    expect(
      moneyToNumber({ currency: 'rub', units: '100', nano: 0 }),
    ).toBe(100);
  });

  it('сумма с дробной частью', () => {
    expect(
      moneyToNumber({ currency: 'rub', units: '100', nano: 500_000_000 }),
    ).toBe(100.5);
  });

  it('отрицательная сумма', () => {
    expect(
      moneyToNumber({ currency: 'rub', units: '-50', nano: -250_000_000 }),
    ).toBe(-50.25);
  });

  it('undefined → 0', () => {
    expect(moneyToNumber(undefined)).toBe(0);
  });
});

describe('quantityToLots', () => {
  it('целое количество', () => {
    expect(
      quantityToLots(
        makePosition({ quantity: { currency: 'rub', units: '10', nano: 0 } }),
      ),
    ).toBe(10);
  });

  it('округляет вниз дробное', () => {
    expect(
      quantityToLots(
        makePosition({
          quantity: { currency: 'rub', units: '10', nano: 500_000_000 },
        }),
      ),
    ).toBe(11); // Math.round
  });

  it('отрицательное → 0', () => {
    expect(
      quantityToLots(
        makePosition({ quantity: { currency: 'rub', units: '-5', nano: 0 } }),
      ),
    ).toBe(0);
  });
});

describe('resolveTicker', () => {
  it('находит тикер в карте', () => {
    const map = new Map([['uid-sber', 'SBER']]);
    expect(resolveTicker(makePosition({}), map)).toBe('SBER');
  });

  it('возвращает null если uid не найден', () => {
    expect(resolveTicker(makePosition({}), new Map())).toBeNull();
  });
});

describe('normalizePortfolio', () => {
  const uidMap = new Map([
    ['uid-sber', 'SBER'],
    ['uid-gazp', 'GAZP'],
    ['uid-bond', 'SU26238RMFS4'],
  ]);
  const allowed = new Set(['SBER', 'GAZP']);

  it('нормализует только акции из allowed', () => {
    const positions: TinkoffPosition[] = [
      makePosition({ instrumentUid: 'uid-sber' }),
      makePosition({ instrumentUid: 'uid-gazp' }),
    ];
    const r = normalizePortfolio(positions, uidMap, allowed);
    expect(r).toHaveLength(2);
    expect(r.map((p) => p.ticker).sort()).toEqual(['GAZP', 'SBER']);
  });

  it('пропускает облигации', () => {
    const positions: TinkoffPosition[] = [
      makePosition({ instrumentType: 'bond', instrumentUid: 'uid-bond' }),
    ];
    expect(normalizePortfolio(positions, uidMap, allowed)).toHaveLength(0);
  });

  it('пропускает бумаги вне allowed', () => {
    const positions: TinkoffPosition[] = [
      makePosition({ instrumentUid: 'uid-bond' }),
    ];
    expect(normalizePortfolio(positions, uidMap, allowed)).toHaveLength(0);
  });

  it('пропускает неизвестные uid', () => {
    const positions: TinkoffPosition[] = [
      makePosition({ instrumentUid: 'uid-unknown' }),
    ];
    expect(normalizePortfolio(positions, uidMap, allowed)).toHaveLength(0);
  });

  it('пропускает нулевое количество', () => {
    const positions: TinkoffPosition[] = [
      makePosition({
        instrumentUid: 'uid-sber',
        quantity: { currency: 'rub', units: '0', nano: 0 },
      }),
    ];
    expect(normalizePortfolio(positions, uidMap, allowed)).toHaveLength(0);
  });

  it('пустой вход → пустой выход', () => {
    expect(normalizePortfolio([], uidMap, allowed)).toEqual([]);
  });
});
