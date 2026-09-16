// language: TypeScript, target: T-Invest API types
// Типы ответов T-Invest API. Только то, что реально используем.
// Документация: https://tinkoff.github.io/investAPI/

/** Денежная сумма: units рублей + nano миллиардных долей. */
export interface MoneyValue {
  currency: string;
  units: string;
  nano: number;
}

/** Счёт пользователя. */
export interface TinkoffAccount {
  id: string;
  type: string;
  name: string;
  status: string;
  openedDate: string;
  closedDate: string;
  accessLevel: string;
}

/** Позиция в портфеле. */
export interface TinkoffPosition {
  figi: string;
  instrumentType: string;
  quantity: MoneyValue;
  averagePositionPrice: MoneyValue;
  currentPrice: MoneyValue;
  expectedYield: MoneyValue;
  instrumentUid: string;
}

/** Ответ GetPortfolio. */
export interface TinkoffPortfolio {
  accountId: string;
  positions: TinkoffPosition[];
  totalAmountPortfolio: MoneyValue;
  totalAmountShares: MoneyValue;
  totalAmountBonds: MoneyValue;
  totalAmountEtf: MoneyValue;
  totalAmountCurrencies: MoneyValue;
  expectedYield: MoneyValue;
}
