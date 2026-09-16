# MOEX Strategy Tracker

> Информационный инструмент для отслеживания собственного портфеля
> относительно индекса Московской биржи (IMOEX).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)

![Dashboard](public/screenshots/dashboard.png)

---

## Что это

Локальное веб-приложение для самостоятельного индексного инвестирования:

- **Репликация IMOEX** — состав и веса с MOEX ISS, optimized sampling с учётом целых лотов
- **Ребалансировка** — арифметика докупок для устранения отклонений от индекса
- **Синхронизация с Т-Инвестициями** — портфель подтягивается по read-only токену T-Invest API
- **Дивидендный календарь** — история и текущие выплаты, доходность портфеля
- **Свечной график** — lightweight-charts, интервалы и диапазоны
- **Структура портфеля** — круговая диаграмма по секторам и бумагам
- **Бэктест** — симуляция репликации с 2020 года, XIRR, сравнение с IMOEX, MCFTR и вкладом под ключевую ставку ЦБ

**Это калькулятор, не инвестиционный советник.** См. раздел «Юридическая рамка».

---

## Почему

Готовые БПИФ на IMOEX (SBMX, TMOS, EQMX) берут 0.5–1% TER. Собственный трекер позволяет:

- контролировать tracking error относительно индекса;
- ребалансировать **только новыми пополнениями**, без продаж — без комиссий и НДФЛ;
- видеть точную арифметику покупок, а не рекомендации;
- запускать бэктест на исторических данных и сравнивать с альтернативами (вклады, ОФЗ).

---

## Как работает репликация

Задача — повторить IMOEX cap-weight при ограничении целых лотов. При капитале
100 000 руб. купить все 46 бумаг в точных пропорциях невозможно: средняя позиция —
2 200 руб., а лот Лукойла — 5 508 руб.

Алгоритм (optimized sampling):

1. Сортировка бумаг по весу в индексе (убывание).
2. **Относительный фильтр лотности:** бумага проходит, если её лот не превышает
   2.5 × целевую стоимость позиции.
3. Greedy: набираем бумаги сверху вниз до покрытия 99% веса индекса.
4. Перенормировка весов на удержанные бумаги.
5. Оценка tracking error: sigma_idio × sqrt(sum w_i^2).

Пропущенные бумаги — **omission weight**. При 100 000 руб. это 5–15%,
при 2 млн — меньше 1%. С ростом капитала репликация приближается к ETF.

Корреляционный фильтр не применяется — для репликации держим всё, что в индексе.

Ребалансировка — два прохода. Greedy закрывает крупные дефициты, top-up
сливает остаток кэша по одному лоту.

---

## Бэктест

Симуляция репликации на исторических данных MOEX ISS:

- **Состав индекса на дату** — через analytics endpoint с параметром `date`
- **Дивиденды** — прокси через разницу доходностей MCFTR и IMOEX за день
- **Вклад** — симуляция на ключевой ставке ЦБ с ежедневной капитализацией
- **XIRR** — годовая доходность с учётом времени пополнений (стандарт банков)
- **Max drawdown** — на NAV-кривой, не на абсолютной стоимости

---

## Стек

- **Next.js 16** (App Router, RSC, Turbopack)
- **TypeScript** 5.9
- **Tailwind CSS 4** + **shadcn/ui**
- **Zustand** — состояние портфеля (localStorage)
- **lightweight-charts** — свечные графики (TradingView)
- **Vitest** — 72 теста
- **pnpm**

---

## Quick start

```bash
git clone https://github.com/kaban78/moex-strategy-tracker.git
cd moex-strategy-tracker
pnpm install
pnpm dev
Открой http://localhost:3000

Если включён VPN и запрос к MOEX ISS падает — выключите на время загрузки.
Russian Trusted CA (для T-Invest API)

Node.js не знает про российский национальный УЦ, которым T-Invest подписывает
сертификаты. Симптом: SELF_SIGNED_CERT_IN_CHAIN. Решение:
bash

node scripts/grab-tls-chain.mjs
sudo mkdir -p /usr/local/share/ca-certificates/russian-trusted
sudo cp /tmp/russian-trusted-chain.pem /usr/local/share/ca-certificates/russian-trusted/chain.pem
echo 'export NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/russian-trusted/chain.pem' >> ~/.zshrc

Перезапустить pnpm dev.
Команды
bash

pnpm dev          # dev-сервер
pnpm build        # production build
pnpm start        # production-сервер
pnpm test         # тесты
pnpm typecheck    # tsc --noEmit


## Структура

src/
app/ Next.js роуты
components/
dashboard/ карточки главной
price-chart/ модалка графика
backtest/ страница и графики бэктеста
ui/ shadcn/ui
lib/
engine/ drift, rebalance, allocation, dividends
legal/ дисклеймеры
moex/ клиент ISS, парсер, кэш, секторы
universe/ сборка портфеля (sampling)
tinkoff/ клиент T-Invest API
cbr/ ключевая ставка ЦБ
backtest/ симуляция, XIRR, метрики
stores/ zustand
types/ доменные типы
text


---

## Юридическая рамка

Приложение **не является** инвестиционным советником и **не предоставляет**
индивидуальных инвестиционных рекомендаций (ИИР) в смысле ст. 6.1
Федерального закона от 22.04.1996 № 39-ФЗ «О рынке ценных бумаг».

Принципы:

1. **Нет инвестиционного профиля.** Приложение не спрашивает у пользователя
   доходность, риск, горизонт.
2. **Стратегия — шаблон.** Репликация IMOEX — фиксированный алгоритм.
3. **Формулировки.** Вместо «рекомендую купить X» — «отклонение от целевого
   веса составляет −3.2%, для устранения требуется 7 лотов».
4. **Нет автоисполнения.** Приложение не имеет доступа к брокерскому API
   на запись.
5. **Дисклеймер на каждом экране.** См. `src/lib/legal/disclaimers.ts`.

---

## Источники

- Statman, M. (1987). How Many Stocks Make a Diversified Portfolio? JFQA.
- Domian, D., Louton, D., Racine, M. (2007). Diversification in Portfolios
  of Individual Stocks: 100 Stocks Are Not Enough. Financial Review.
- DeMiguel, V., Garlappi, L., Uppal, R. (2009). Optimal Versus Naive
  Diversification. RFS.
- Huij, J., Blitz, D. (2012). Global style portfolios. Emerging Markets Review.
- MOEX ISS API: https://iss.moex.com/iss/reference/
- Кодекс этики в сфере ИИ на финансовом рынке (Банк России, август 2026).

---

## Roadmap

- [x] Юридический фундамент
- [x] MOEX ISS client с пагинацией
- [x] Репликация IMOEX (sampling + lot feasibility)
- [x] Ребалансировка через пополнения (greedy + top-up)
- [x] Dashboard
- [x] Свечной график с интервалами и диапазонами
- [x] Светлая и тёмная темы
- [x] Синхронизация с Т-Инвестициями
- [x] Дивидендный календарь
- [x] Структура портфеля (секторы, бумаги)
- [x] Бэктест с XIRR и сравнением с вкладом
- [ ] Импорт CSV из брокера
- [ ] Журнал сделок + график роста портфеля
- [ ] Налоги в бэктесте
- [ ] Сравнение с БПИФ (SBMX, TMOS, EQMX)
- [ ] Калькулятор ИИС-3

---

## Лицензия

MIT — см. [LICENSE](LICENSE).
