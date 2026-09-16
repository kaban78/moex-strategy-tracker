// language: TypeScript, target: T-Invest accounts
// Список счетов пользователя.

import { post, SERVICE_USERS } from './http';
import type { TinkoffAccount } from './types';

interface AccountsResponse {
  accounts: TinkoffAccount[];
}

export async function fetchAccounts(
  token: string,
): Promise<TinkoffAccount[]> {
  const data = await post<AccountsResponse>({
    token,
    path: `${SERVICE_USERS}/GetAccounts`,
    body: {},
  });
  return data.accounts ?? [];
}
