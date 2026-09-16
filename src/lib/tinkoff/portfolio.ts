// language: TypeScript, target: T-Invest portfolio
// Получение портфеля по счёту.

import { post, SERVICE_OPS } from './http';
import type { TinkoffPortfolio, TinkoffPosition } from './types';

export interface PortfolioResponse {
  accountId: string;
  positions: TinkoffPosition[];
  totalAmountPortfolio?: TinkoffPortfolio['totalAmountPortfolio'];
  expectedYield?: TinkoffPortfolio['expectedYield'];
}

export async function fetchPortfolio(
  token: string,
  accountId: string,
): Promise<PortfolioResponse> {
  const data = await post<PortfolioResponse>({
    token,
    path: `${SERVICE_OPS}/GetPortfolio`,
    body: { accountId, currency: 'RUB' },
  });
  return {
    accountId: data.accountId ?? accountId,
    positions: data.positions ?? [],
    totalAmountPortfolio: data.totalAmountPortfolio,
    expectedYield: data.expectedYield,
  };
}
