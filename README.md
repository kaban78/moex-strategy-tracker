# MOEX Strategy Tracker

> Информационный инструмент для отслеживания собственного портфеля
> относительно индекса Московской биржи (IMOEX).

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)

![Dashboard](public/screenshots/dashboard.png)

---

## Что это

Локальное веб-приложение, которое:

- подтягивает состав и веса индекса IMOEX с MOEX ISS (бесплатно, без ключа);
- позволяет ввести собственный портфель вручную;
- считает отклонение портфеля от выбранной стратегии;
- показывает арифметику для устранения отклонения при пополнении;
- рисует свечной график по каждому тикеру (lightweight-charts).

**Это калькулятор, не инвестиционный советник.** Приложение не даёт
индивидуальных инвестиционных рекомендаций, не строит инвестиционный
профиль и не исполняет сделки. См. раздел «Юридическая рамка».

---

## Почему

Готовые БПИФ на IMOEX (SBMX, TMOS, EQMX) берут 0.5–1% TER. При горизонте
10 лет и пополнениях 10 000 руб./мес это существенная сумма. Собственный
трекер позволяет:

- контролировать tracking error относительно индекса;
- ребалансировать **только новыми пополнениями**, без продаж — значит
  без комиссий и без НДФЛ на реализованную прибыль;
- видеть точную арифметику покупок, а не рекомендации.

---

## Как работает репликация

Задача — повторить IMOEX cap-weight при ограничении целых лотов. При
капитале 100 000 руб. купить все 46 бумаг индекса в точных пропорциях
невозможно: средняя позиция — 2 200 руб., а лот Лукойла — 5 508 руб.

Алгоритм (optimized sampling):

1. Сортировка бумаг по весу в индексе (убывание).
2. **Относительный фильтр лотности:** бумага проходит, если её лот
   не превышает 2.5 × целевую стоимость позиции. Крупные бумаги
   (LKOH 18%) проходят всегда, мелкие с дорогим лотом (PHOR 0.62%,
   лот 5 543 руб.) — отсеиваются.
3. Greedy: набираем бумаги сверху вниз до покрытия 99% веса индекса.
4. Перенормировка весов на удержанные бумаги.
5. Оценка tracking error: `sigma_idio × sqrt(sum w_i^2)`.

Пропущенные бумаги — это **omission weight**. При 100 000 руб. он
составляет 5–15%, при 2 млн — меньше 1%. С ростом капитала репликация
приближается к настоящему ETF.

Корреляционный фильтр **не применяется**: для репликации индекса держим
всё, что в индексе.

Ребалансировка — **два прохода**. Greedy закрывает крупные дефициты,
top-up сливает остаток кэша по одному лоту в самые недобранные позиции.
Cash drag после двух проходов — меньше 0.5% портфеля.

---

## Стек

- **Next.js 16** (App Router, RSC, Turbopack)
- **TypeScript** 5.9
- **Tailwind CSS 4** + **shadcn/ui** (Radix, Nova preset)
- **Zustand** — состояние портфеля (localStorage)
- **lightweight-charts** — свечные графики (TradingView)
- **Vitest** — тесты (36 зелёных)
- **pnpm** — пакетный менеджер

---

## Quick start

```bash
git clone https://github.com/USER/moex-strategy-tracker.git
cd moex-strategy-tracker
pnpm install
pnpm dev

Открой http://localhost:3000

Если включён VPN и запрос к MOEX ISS падает — выключи VPN на время
загрузки. Это связано с TLS-таймаутами при маршрутизации через TUN.
Команды
bash

pnpm dev          # dev-сервер
pnpm build        # production build
pnpm start        # production-сервер
pnpm test         # тесты
pnpm test:watch   # тесты в watch-режиме
pnpm typecheck    # tsc --noEmit

Структура
text

src/
├── app/
│   ├── layout.tsx               # root layout + ThemeProvider
│   ├── page.tsx                 # server component: fetch universe + render
│   └── api/
│       ├── universe/route.ts    # прокси MOEX ISS (состав + цены)
│       └── history/[ticker]/    # свечи по бумаге
├── components/
│   ├── dashboard/
│   │   ├── dashboard.tsx            # композиция, состояние
│   │   ├── target-portfolio-card.tsx
│   │   ├── drift-card.tsx
│   │   ├── rebalance-card.tsx
│   │   └── ticker-button.tsx        # клик + prefetch
│   ├── price-chart/
│   │   ├── price-chart-dialog.tsx   # композиция
│   │   ├── chart-header.tsx
│   │   ├── chart-toolbar.tsx
│   │   ├── chart-resize-handle.tsx
│   │   ├── palettes.ts
│   │   ├── constants.ts
│   │   ├── types.ts
│   │   └── hooks/
│   │       ├── use-chart.ts         # lifecycle lightweight-charts
│   │       ├── use-chart-data.ts    # fetch + polling
│   │       ├── use-chart-range.ts   # visible range
│   │       └── use-window-drag.ts   # drag + resize
│   ├── portfolio-editor.tsx
│   ├── theme-toggle.tsx
│   └── ui/                          # shadcn/ui
├── lib/
│   ├── engine/
│   │   ├── drift.ts                 # отклонения
│   │   ├── rebalance.ts             # два прохода: greedy + top-up
│   │   └── target-weights.ts        # веса -> целые лоты
│   ├── legal/
│   │   └── disclaimers.ts           # единственный источник правды
│   ├── moex/
│   │   ├── client.ts                # HTTP-клиент ISS с пагинацией
│   │   ├── parse.ts                 # парсер ответов ISS
│   │   ├── history-cache.ts         # клиентский кэш свечей
│   │   └── links.ts                 # ссылки на moex.com
│   ├── universe/
│   │   └── select.ts                # сборка портфеля (sampling)
│   └── format.ts
├── stores/
│   └── portfolio.ts                 # zustand + localStorage
└── types/
    └── index.ts                     # доменные типы

Юридическая рамка

Приложение не является инвестиционным советником и не предоставляет
индивидуальных инвестиционных рекомендаций (ИИР) в смысле
ст. 6.1 Федерального закона от 22.04.1996 № 39-ФЗ «О рынке ценных бумаг».

Принципы проектирования:

    Нет инвестиционного профиля. Приложение не спрашивает у
    пользователя доходность, риск, горизонт.

    Стратегия — шаблон. Репликация IMOEX — фиксированный алгоритм.

    Формулировки. Вместо «рекомендую купить X» — «отклонение от
    целевого веса составляет −3.2%, для устранения требуется 7 лотов».

    Нет автоисполнения. Приложение не имеет доступа к брокерскому
    API на запись.

    Дисклеймер на каждом экране. См. src/lib/legal/disclaimers.ts.

Источники

    Statman, M. (1987). How Many Stocks Make a Diversified Portfolio?
    Journal of Financial and Quantitative Analysis, 22(3), 353–363.

    Domian, D., Louton, D., Racine, M. (2007). Diversification in Portfolios
    of Individual Stocks: 100 Stocks Are Not Enough. The Financial Review,
    42(4), 557–570.

    DeMiguel, V., Garlappi, L., Uppal, R. (2009). Optimal Versus Naive
    Diversification: How Inefficient Is the 1/N Portfolio Strategy?
    Review of Financial Studies, 22(5), 1915–1953.

    Huij, J., Blitz, D. (2012). Global style portfolios and the
    diversification return. Emerging Markets Review.

    MOEX ISS API. https://iss.moex.com/iss/reference/

    Кодекс этики в сфере ИИ на финансовом рынке (Банк России, август 2026).

Roadmap

    ☑

    Юридический фундамент
    ☑

    MOEX ISS client с пагинацией
    ☑

    Репликация IMOEX (sampling + lot feasibility)
    ☑

    Ребалансировка через пополнения (greedy + top-up)
    ☑

    Dashboard
    ☑

    Свечной график с интервалами и диапазонами
    ☑

    Светлая и тёмная темы
    □

    Импорт CSV из брокера
    □

    Дивидендный календарь
    □

    Журнал сделок + график портфеля
    □

    Бэктест на истории
    □

    Сравнение с БПИФ (SBMX, TMOS, EQMX)
    □

    Калькулятор ИИС-3

Лицензия

MIT — см. LICENSE.
