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
   не превышает 2.5 × целевую стоимость позиции.
3. Greedy: набираем бумаги сверху вниз до покрытия 99% веса индекса.
4. Перенормировка весов на удержанные бумаги.
5. Оценка tracking error: sigma_idio × sqrt(sum w_i^2).

Пропущенные бумаги — это **omission weight**. При 100 000 руб. он
составляет 5–15%, при 2 млн — меньше 1%.

Корреляционный фильтр **не применяется**: для репликации индекса держим
всё, что в индексе.

Ребалансировка — **два прохода**. Greedy закрывает крупные дефициты,
top-up сливает остаток кэша по одному лоту.

---

## Стек

- **Next.js 16** (App Router, RSC, Turbopack)
- **TypeScript** 5.9
- **Tailwind CSS 4** + **shadcn/ui**
- **Zustand** — состояние портфеля
- **lightweight-charts** — свечные графики
- **Vitest** — 36 тестов
- **pnpm**

---

## Quick start

git clone https://github.com/USER/moex-strategy-tracker.git
cd moex-strategy-tracker
pnpm install
pnpm dev

Открой http://localhost:3000

---

### T-Invest API и Russian Trusted CA

Если используешь интеграцию с Т-Инвестициями на Linux, Node.js может не
знать про российский национальный УЦ, которым T-Invest подписывает свои
сертификаты. Симптом: `SELF_SIGNED_CERT_IN_CHAIN` при запросе к
`invest-public-api.tinkoff.ru`.

Извлечь цепочку и подложить Node.js:

```bash
node -e "..."  # скрипт grab-chain.mjs, см. docs/
sudo mkdir -p /usr/local/share/ca-certificates/russian-trusted
sudo cp /tmp/russian-trusted-chain.pem /usr/local/share/ca-certificates/russian-trusted/chain.pem
echo 'export NODE_EXTRA_CA_CERTS=/usr/local/share/ca-certificates/russian-trusted/chain.pem' >> ~/.zshrc
После — перезапустить pnpm dev.

Сохрани `Ctrl+O`, `Enter`, `Ctrl+X`.

## СКРИПТ В РЕПО

Положи `grab-chain.mjs` в репо, чтобы README мог на него ссылаться:

```bash
mkdir -p scripts
cp /tmp/grab-chain.mjs scripts/grab-tls-chain.mjs

## Команды

pnpm dev          # dev-сервер
pnpm build        # production build
pnpm start        # production-сервер
pnpm test         # тесты
pnpm typecheck    # tsc --noEmit

---

## Структура

src/
  app/                         Next.js App Router
  components/dashboard/        карточки дашборда
  components/price-chart/      модалка графика
  lib/engine/                  drift, rebalance, allocation
  lib/legal/                   дисклеймеры
  lib/moex/                    клиент ISS
  lib/universe/                сборка портфеля
  stores/                      zustand
  types/                       доменные типы

---

## Юридическая рамка

Приложение не является инвестиционным советником и не предоставляет
индивидуальных инвестиционных рекомендаций (ИИР) в смысле
ст. 6.1 Федерального закона от 22.04.1996 № 39-ФЗ «О рынке ценных бумаг».

Принципы:

1. Нет инвестиционного профиля.
2. Стратегия — шаблон.
3. Формулировки — арифметика, не рекомендации.
4. Нет автоисполнения.
5. Дисклеймер на каждом экране.

---

## Источники

- Statman (1987), JFQA
- Domian, Louton, Racine (2007), Financial Review
- DeMiguel, Garlappi, Uppal (2009), RFS
- Huij, Blitz (2012), Emerging Markets Review
- MOEX ISS API: https://iss.moex.com/iss/reference/
- Кодекс этики ИИ (Банк России, август 2026)

---

## Roadmap

- [x] Юридический фундамент
- [x] MOEX ISS client
- [x] Репликация IMOEX
- [x] Ребалансировка через пополнения
- [x] Dashboard
- [x] Свечной график
- [x] Светлая и тёмная темы
- [ ] Импорт CSV из брокера
- [ ] Дивидендный календарь
- [ ] Журнал сделок
- [ ] Бэктест
- [ ] Сравнение с БПИФ
- [ ] Калькулятор ИИС-3

---

## Лицензия

MIT — см. LICENSE.
