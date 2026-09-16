// language: TypeScript, target: T-Invest API barrel
// Точка входа: реэкспорт всех функций модуля.
// Старый импорт `from './client'` продолжает работать.

export { fetchAccounts } from './accounts';
export { fetchPortfolio, type PortfolioResponse } from './portfolio';
export {
  fetchTickerMaps,
  fetchDividends,
  type InstrumentShort,
} from './instruments';
export { post } from './http';

// Совместимость со старыми вызовами.
import { fetchTickerMaps } from './instruments';

/** @deprecated Используй fetchTickerMaps().uidToTicker */
export async function fetchSharesUidMap(
  token: string,
): Promise<Map<string, string>> {
  const { uidToTicker } = await fetchTickerMaps(token);
  return uidToTicker;
}

/** @deprecated Используй fetchTickerMaps().tickerToUid */
export async function fetchSharesTickerMap(
  token: string,
): Promise<Map<string, string>> {
  const { tickerToUid } = await fetchTickerMaps(token);
  return tickerToUid;
}
