// language: TypeScript, target: dividend yield proxy
//
// Дивиденды для бэктеста: разница доходностей MCFTR и IMOEX за день.
// Это даёт прокси дивидендной доходности индекса без загрузки
// дивидендов каждой бумаги.

/**
 * Дневная дивидендная доходность IMOEX:
 *   mcftr_ret_1d − imoex_ret_1d
 * Если отрицательная — дивидендов не было.
 */
export function dailyDividendYield(
  imoexNow: number | null,
  imoexPrev: number | null,
  mcftrNow: number | null,
  mcftrPrev: number | null,
): number {
  if (!imoexNow || !imoexPrev || !mcftrNow || !mcftrPrev) return 0;
  if (imoexPrev <= 0 || mcftrPrev <= 0) return 0;
  const imoexRet = imoexNow / imoexPrev - 1;
  const mcftrRet = mcftrNow / mcftrPrev - 1;
  const y = mcftrRet - imoexRet;
  return y > 0 ? y : 0;
}
