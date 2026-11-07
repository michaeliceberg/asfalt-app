@AGENTS.md

# АБЗ Контроль (asfalt-app) — учёт отгрузок асфальтобетонных заводов

Сайт https://abziceberg.ru (он же abzcontrol.ru), приложение для iOS «АБЗ Контроль»
(Capacitor-обёртка над сайтом, `ios/`, `capacitor.config.ts`, bundle `ru.abziceberg.abzcontrol`).
Показывает диспетчерам и руководству: приход материалов, отгрузки асфальта и бетона, заявки
(план на завтра), машины на GPS-карте, push-уведомления и вечернюю рассылку плана в Telegram.
Документ написан 2026-11-07 по коду и по живому серверу.

## Две организации, четыре завода

Код завода (`division`) — главная ось всех данных:

| Код | Завод | Организация | Откуда данные | Что грузит |
|---|---|---|---|---|
| ЛХ | Луховицы | ТАС | 1С:УНФ (облако Рарус) напрямую | асфальт |
| ЛЮ | Люберцы | ТАС | 1С:УНФ напрямую | асфальт |
| СП | Сергиев Посад (Скоропусковский) | Айсберг | Excel → Python → `/api/excel-import` | асфальт, бетон |
| Щ | Щёлково (Заречная) | Айсберг | Excel → Python → `/api/excel-import` | асфальт, бетон |

Координаты заводов — `lib/constants.ts` (`FACTORIES`). Коды СЕ/ЮГ — только демо.

### ТАС: 1С:УНФ
HTTP-сервис 1С `${UNF_BASE_URL}/hs/WebData-API/...` (Basic-авторизация `UNF_LOGIN`/`UNF_PASSWORD`),
дёргается кроном сервера каждые 10 минут:
- `/api/cron` → `.../incoming` → таблица `incoming_materials` (только вставка новых, правки в 1С не подтягиваются);
- `/api/cron-shipments` → `.../outgoing` → `shipments` (вставка + обновление всех записей; 1С отдаёт
  всю историю, ~6000 строк, и все они переписываются каждые 10 минут); здесь же push «по заявке начали грузить»;
- `/api/cron-outgoing-requests` → `.../OutgoingRequest` → `outgoing_requests` (заявки).
У ТАС в отгрузке есть `ПунктНазначения` с координатами — по нему GPS-карта знает, куда едет машина.
Проверка SSL 1С отключена (`NODE_TLS_REJECT_UNAUTHORIZED=0` в коде и в `.env`).

### Айсберг: Excel + Python
Старый Windows Server на заводе: 1С каждые 10 минут выгружает Excel-файлы, скрипт
`4files/send_to_server_fixed.py` (рабочая копия на сервере Айсберга может отличаться!) читает их и шлёт
POST JSON `{factory, type, data}` на `https://abziceberg.ru/api/excel-import` пачками по 50:
- `realiz.xlsx` / `10realiz.xlsx` — отгрузки (`type: shipments`), завод по складу («щелково/заречная» → Щ,
  «скоропусковский» → СП), номер заявки = цифры после «айс» в «Заказ покупателя айс00000543…»;
- `hotimprodat.xlsx` / `40hotimprodat.xlsx` — заявки «хотим продать» (`type: requests`); заявка
  попадает на сайт, только если по этому заказу уже была отгрузка (иначе не известен завод);
- `postup.xlsx` / `10postup.xlsx` — приход (`type: incoming`);
- `peremeshenie.xlsx` — перемещения, на сайт не идут.
Единицы: м³ бетона × 2,4 → тонны, асфальт в кг (> 1000) / 1000 — эвристики в Python.
Дата из Python приходит строкой `ДД.ММ.ГГГГ Ч:ММ:СС` (иногда с хвостом ` 00:00:00`), у ТАС — ISO.
**Даты в БД хранятся текстом в двух форматах — сортировка по дате в SQL у Айсберга неверна.**
Айсберг не передаёт координаты объекта — GPS-карта для СП/Щ угадывает точку по названию получателя
(`DESTINATIONS_FALLBACK` в `lib/constants.ts`).
Время последнего прихода данных от Python — `data/last-import.json`.

## Стек и где что лежит

- Next.js 16 (App Router, `proxy.ts` вместо `middleware.ts`), React 19, Tailwind 4, framer-motion.
  **Next 16 — читай `node_modules/next/dist/docs/`, см. AGENTS.md.**
- SQLite через better-sqlite3 + Drizzle: файл `data/sqlite.db` (демо — `data/demo.db` при `DEMO_MODE=true`),
  схема `lib/db/schema.ts`. Миграции `drizzle/migrations` — история на проде разошлась, схему правили вручную.
- Авторизация: JWT (`jsonwebtoken` в API, `jose` в `proxy.ts`), cookie `token` или `Authorization: Bearer`
  (для iOS). Пользователи/группы/доступ к заводам — `users`, `user_groups`, `group_factory_access`.
- Главный экран — `app/page.tsx` (≈3000 строк, половина закомментирована), виды — `app/components/`
  (CompactView, ListView, GroupedView, ChartsView, SummaryView), GPS — `app/trucks/page.tsx`,
  `app/components/TruckMap.tsx` (Яндекс.Карты JS API 2.1, ключ `NEXT_PUBLIC_YANDEX_MAPS_API_KEY`).
- Админка: `/admin/trucks` (машины и их GPS-uid), `/admin/weigh-stations` (весовые рамки и запретные
  дороги к ним), `/admin/stats`.
- Демо для продаж: `/demo`, `/landing` (тарифы `PricingSection`), данные `lib/demo-*.ts`.
- Уведомления: web-push (VAPID, `lib/push-notifications.ts`, `public/sw.js`), APNs для iOS (`lib/apns.ts`),
  Telegram (`/api/send-plan` — план заявок, `/api/health-notify`, `/api/check-sync`).

### GPS
Провайдер — Геоинформер `https://xptr.geoinformer.com/service/monitoring` (POST, список uid машин +
токен `ud`, сейчас захардкожен в коде в трёх местах). Отдаёт только текущие позиции, истории не храним.
- `/api/trucks` — позиции + маршруты «завод → объект» (`/api/truck-routes` собирает их из ВСЕХ отгрузок);
  UI опрашивает раз в 2 минуты.
- `scripts/calc-distances.ts` (крон каждые 5 минут через `npx tsx`) — расстояние до объекта и отметка
  «прибыл» (`shipments.arrived`): ближе 2 км, или подъехал ближе 3 км и потом отъехал на 3 км.
- `lib/geofence-worker.ts` (стартует из `instrumentation.ts`, раз в минуту) — алерт «машина заехала на
  запретную дорогу к весовой рамке».
- Расстояние/время — по прямой (гаверсинус), 50 км/ч × 1,3 (`/api/route-time`), линия маршрута на карте —
  кривая Безье, а не дорога (маршрутизатор Яндекса платный).

## Сервер и деплой

VPS reg.ru 168.222.192.167 (`ssh root@`), папка `/var/www/asfalt-app`, pm2-процесс `asfalt-app`
(`npm start`, порт 3000), nginx: abziceberg.ru, abzcontrol.ru → localhost:3000.

**На этой же машине живут другие проекты: ggege (pm2 `ggege`, `ggege-telegram-poller`), garaggio,
docshiroko, bbr-studio. Никогда `pm2 restart all` / `pm2 reload all`. Перезапускать только `asfalt-app`.**

- Секреты — в `.env`, `.env.local`, `.env.production` на сервере (не в git), список — `.env.example`.
- На сервере выкачена ветка **`server-version`**, а не `main` (по коду они совпадают на коммите 81cbb49),
  и есть **незакоммиченные правки от 9 августа 2026** (фильтр отгрузок асфальта < 10 т, upsert прихода,
  «габбро»/«молочко цементное» в инертных) — сначала их закоммитить, иначе следующий `git pull` их
  потеряет или упадёт.
- `deploy.sh`: бэкап БД → `git pull origin main` → `npm ci` → миграции → `rm -rf .next` → build →
  `pm2 reload ecosystem.config.js`. GitHub Actions (`.github/workflows/deploy.yml`) запускает его на
  каждый push в `main` — **push в main = выкладка на прод**. Пока идёт сборка (`rm -rf .next` до build),
  сайт лежит.
- Крон (crontab root): `/api/cron`, `/api/cron-shipments`, `/api/cron-outgoing-requests` раз в 10 мин,
  `/api/check-sync` раз в 5 мин, `scripts/calc-distances.ts` раз в 5 мин, `/api/health-notify` раз в 30 мин,
  `/api/send-plan` раз в 10 мин и в 20:15. Логи — `/var/log/asfalt-*.log`.
- Бэкапы БД — `backups/` (делаются только при деплое, последний — июль 2026; ежедневного бэкапа нет).

## Известные проблемы (на 2026-11-07)

1. **Публичные данные.** В `proxy.ts` почти все API в списке публичных: `/api/all-data` отдаёт без входа
   всю базу (13 тыс. отгрузок, заявки, приход, ~12 МБ), `/api/trucks` — GPS всех машин,
   `/api/excel-import` принимает данные от кого угодно (проверка IP закомментирована), крон-ручки без
   `CRON_SECRET`. Репозиторий на GitHub **публичный**: в нём токен Геоинформера, IP завода, секрет
   крона в `app/page.tsx`, старый токен Telegram и старые пароли 1С в истории, Excel-выгрузки
   с реальными клиентами в `4files/`.
2. Даты в двух форматах (см. выше), у Айсберга ещё и кривой хвост ` 00:00:00`.
3. Каждые 10 минут 1С ТАС отдаёт всю историю, а сайт переписывает ~6000 строк (12 тыс. запросов).
   Главный экран раз в минуту качает `/api/all-data` целиком.
4. `/api/health` считает «память 94%» от кучи Node (44 из 47 МБ) — ложная тревога.
5. Много мёртвого кода: закомментированные старые версии файлов (по 1000–2400 строк в page.tsx,
   CompactView.tsx, trucks/route.ts), дубли скриптов (`*.mts`/`*.ts`, три версии Python-скрипта),
   мусор в корне (`GET`, `nohup.out`, `build.log`, `._.`, папка `asfalt-app/` на сервере).
