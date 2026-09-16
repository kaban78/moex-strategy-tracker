// language: TypeScript, target: XIRR (Money-Weighted Return)
//
// XIRR — внутренняя норма доходности с учётом дат денежных потоков.
// Стандарт банков и управляющих компаний: отвечает на вопрос
// «сколько заработал инвестор с учётом того, что деньги вносились
// в разное время».
//
// Метод Ньютона-Рафсона с fallback на бисекцию.

export interface CashFlow {
  /** YYYY-MM-DD */
  date: string;
  /** Отрицательный — вложение, положительный — возврат. */
  amount: number;
}

function yearFraction(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + 'T00:00:00Z').getTime();
  const to = new Date(toIso + 'T00:00:00Z').getTime();
  return (to - from) / (365.25 * 24 * 3600 * 1000);
}

function npv(flows: CashFlow[], rate: number, t0: string): number {
  let sum = 0;
  for (const cf of flows) {
    const t = yearFraction(t0, cf.date);
    sum += cf.amount / Math.pow(1 + rate, t);
  }
  return sum;
}

function npvDerivative(flows: CashFlow[], rate: number, t0: string): number {
  let sum = 0;
  for (const cf of flows) {
    const t = yearFraction(t0, cf.date);
    sum -= (t * cf.amount) / Math.pow(1 + rate, t + 1);
  }
  return sum;
}

/**
 * XIRR. Возвращает годовую ставку в долях (0.10 = +10%).
 * Возвращает NaN, если поток некорректен (нет положительной части).
 */
export function xirr(flows: CashFlow[], guess = 0.1): number {
  if (flows.length < 2) return NaN;

  const hasPositive = flows.some((f) => f.amount > 0);
  const hasNegative = flows.some((f) => f.amount < 0);
  if (!hasPositive || !hasNegative) return NaN;

  const sorted = [...flows].sort((a, b) => a.date.localeCompare(b.date));
  const t0 = sorted[0].date;

  // Newton-Raphson.
  let r = guess;
  for (let i = 0; i < 50; i++) {
    const f = npv(sorted, r, t0);
    const df = npvDerivative(sorted, r, t0);
    if (Math.abs(df) < 1e-12) break;
    const rNew = r - f / df;
    if (!Number.isFinite(rNew)) break;
    if (Math.abs(rNew - r) < 1e-8) return rNew;
    r = Math.max(-0.999, Math.min(10, rNew));
  }

  // Бисекция как fallback.
  let lo = -0.999;
  let hi = 10;
  let fLo = npv(sorted, lo, t0);
  let fHi = npv(sorted, hi, t0);

  if (fLo * fHi > 0) {
    // Знаки не меняются — решения в этом диапазоне нет.
    // Возвращаем приближение по простой формуле.
    return NaN;
  }

  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(sorted, mid, t0);
    if (Math.abs(fMid) < 1) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }

  return (lo + hi) / 2;
}

/**
 * Собрать cash flows из снапшотов:
 * каждое пополнение — negative, финальная стоимость — positive.
 */
export function flowsFromSnapshots(
  snapshots: { date: string; invested: number }[],
  finalValue: number,
): CashFlow[] {
  if (snapshots.length === 0) return [];

  const flows: CashFlow[] = [];

  // Стартовое вложение в первый день.
  const first = snapshots[0];
  if (first.invested > 0) {
    flows.push({ date: first.date, amount: -first.invested });
  }

  // Ежемесячные пополнения.
  for (let i = 1; i < snapshots.length; i++) {
    const topup = snapshots[i].invested - snapshots[i - 1].invested;
    if (topup > 0) {
      flows.push({ date: snapshots[i].date, amount: -topup });
    }
  }

  // Финальная стоимость.
  const last = snapshots[snapshots.length - 1];
  flows.push({ date: last.date, amount: finalValue });

  return flows;
}
