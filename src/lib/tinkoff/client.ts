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
