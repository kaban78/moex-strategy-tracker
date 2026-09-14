// language: TypeScript, target: MOEX external links
// Формирование ссылок на карточки бумаг на moex.com.

export function moexIssueUrl(ticker: string): string {
  return `https://www.moex.com/ru/issue.aspx?code=${encodeURIComponent(ticker)}`;
}
