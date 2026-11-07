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
Все три запроса идут с `dateFrom` за последние 90 дней (`lib/unf.ts`, с 2026-11-07).
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

### GPS и навигация (переделано 2026-11-07)
Провайдер — Геоинформер `https://xptr.geoinformer.com/service/monitoring` (POST, список uid машин +
токен `ud` — `GEOINFORMER_TOKEN` в `.env.production`). Отдаёт только текущую позицию, поэтому историю
пишем сами:
- `lib/gps-recorder.ts` (стартует из `instrumentation.ts`, раз в минуту) — точки всех машин в `gps_points`
  (стоящую машину раз в 5 минут, едущую — каждую новую точку), хранит 30 дней, затем вызывает
  `processNavigation()`.
- `lib/nav.ts` — разбор рейсов по истории:
  - **доставка**: отгрузка взвешена → машина выехала из зоны завода → «приехала» = первая точка у
    известного места (точка/участок дороги из 1С или выученное место получателя), а если места нет —
    первая остановка дольше 7 минут дальше 3 км от завода (не на заводе и не на карьере). Ставит
    `shipments.arrived/arrived_at` (время — по GPS, а не по времени проверки), пишет рейс в `trips`;
  - **карьер**: наша машина привезла приход на завод → последняя долгая остановка за 8 часов до этого —
    место погрузки, запоминается как карьер (имя поставщика);
  - места (`places`: заводы, объекты, карьеры) учатся сами (`source='auto'`), править — `/admin/places`
    (там же список получателей, для которых места ещё нет). Поправленное вручную место система не двигает;
  - время в пути — медиана прошлых рейсов к тому же месту × доля оставшегося пути; без рейсов — по
    прямой × 1,35 / 42 км/ч. Пишется в `shipments.distance_to_dest/eta_minutes` (полоска в «Компактно»);
  - `truckNavStatuses()` → поле `navStatus` в `/api/trucks` («Везёт → X, будет через N мин»,
    «На карьере …», «Возвращается на …», «Нет связи 3 ч») — показывается в карточке машины на карте.
- Линия маршрута на карте — реальный трек последнего рейса к этому месту (`roadTrack` из
  `/api/truck-routes`), пока рейсов не было — условная кривая.
- Рейсы, начатые до появления истории (до 7.11.2026 вечера), не разбираются — нужна точка до выезда.
- `scripts/calc-distances.ts` — ручной прогон того же разбора (из крона убран).
- `lib/geofence-worker.ts` — отдельно, алерт «машина заехала на запретную дорогу к весовой рамке».
- Схема новых таблиц применена SQL-файлом `scripts/migrate-nav.sql` (миграции Drizzle на проде не работают).
- Даты: у Айсберга текст `ДД.ММ.ГГГГ`, поэтому отгрузки по дате фильтруются в JS через `parseRussianDate`,
  не в SQL (раньше из-за этого расчёт расстояний не видел Айсберг вообще).

## Сервер и деплой

VPS reg.ru 168.222.192.167 (`ssh root@`), папка `/var/www/asfalt-app`, pm2-процесс `asfalt-app`
(`npm start`, порт 3000), nginx: abziceberg.ru, abzcontrol.ru → localhost:3000.

**На этой же машине живут другие проекты: ggege (pm2 `ggege`, `ggege-telegram-poller`), garaggio,
docshiroko, bbr-studio. Никогда `pm2 restart all` / `pm2 reload all`. Перезапускать только `asfalt-app`.**

- Секреты — в `.env`, `.env.local`, `.env.production` на сервере (не в git), список — `.env.example`.
- На сервере выкачена ветка `server-version`, в неё делается `git pull origin main` (fast-forward).
  Правки, сделанные прямо на сервере 9.08.2026, закоммичены 7.11.2026. Правило: на сервере код не править,
  только через git.
- `deploy.sh`: бэкап БД → `git pull origin main` → `npm ci` → миграции → `rm -rf .next` → build →
  `pm2 reload ecosystem.config.js`. GitHub Actions (`.github/workflows/deploy.yml`) запускает его на
  каждый push в `main`, но с июля 2026 этот запуск падает (на прод не выкладывает) — выкладка руками:
  `cd /var/www/asfalt-app && git pull origin main && npm run build && pm2 restart asfalt-app --update-env`.
  `deploy.sh` делает `rm -rf .next` до сборки — сайт на это время лежит.
- Крон (crontab root) вызывает ручки с заголовком `Authorization: Bearer <CRON_SECRET>` (секрет —
  в `.env*` и в `/root/.asfalt-cron-secret`; сменил секрет — поправь crontab): `/api/cron`, `/api/cron-shipments`, `/api/cron-outgoing-requests` раз в 10 мин,
  `/api/check-sync` раз в 5 мин, `/api/health-notify` раз в 30 мин,
  `/api/send-plan` раз в 10 мин и в 20:15. Логи — `/var/log/asfalt-*.log`.
- Бэкапы БД — `backups/`: `daily-ГГГГММДД.db.gz` каждую ночь в 3:50 (`/root/backups/asfalt-backup.sh`,
  14 штук) и `sqlite-*.db` при деплое.

## Доступ (с 2026-11-07)

`proxy.ts`: без входа открыты только `/login`, `/demo`, `/landing`, статика, `/api/auth/*`, `/api/health`,
`/api/excel-import` и `/api/last-import-update` (сами пускают только IP завода Айсберг 89.31.82.106 по `X-Real-IP` от nginx, ещё IP —
`EXCEL_IMPORT_IPS` в `.env`) и POST `/api/send-plan` (вебхук Telegram). Крон-ручки — по `CRON_SECRET`,
всё остальное — только с JWT пользователя. Новую ручку для крона добавлять в `CRON_API` в `proxy.ts`.
Внутри API не ходить HTTP-запросом к своим же ручкам (запрос пойдёт без cookie и получит 401) —
вызывать функцию напрямую.

## Известные проблемы (на 2026-11-07)

1. Репозиторий на GitHub **публичный**: в истории коммитов остались токен Геоинформера, старый токен
   Telegram, старые пароли 1С и Excel-выгрузки с клиентами. Сделать репозиторий приватным, сменить
   пароль/токен Геоинформера.
2. Даты в двух форматах (см. выше), у Айсберга ещё и кривой хвост ` 00:00:00`.
3. Каждые 10 минут 1С ТАС отдаёт всю историю, а сайт переписывает ~6000 строк (12 тыс. запросов).
   Главный экран раз в минуту качает `/api/all-data` целиком.
4. Много мёртвого кода: закомментированные старые версии файлов (по 1000–2400 строк в page.tsx,
   CompactView.tsx, trucks/route.ts), дубли скриптов (`*.mts`/`*.ts`, три версии Python-скрипта),
   мусор в корне (`GET`, `nohup.out`, `build.log`, `._.`, папка `asfalt-app/` на сервере).

## Дизайн (с 2026-11-07)

`app/theme.css` подключается после `globals.css` и перекрывает старые цвета: ТАС — светлая тема, Айсберг — тёмная
(`body.iceberg-mode`). Новые элементы красить только переменными оттуда (`--surface`, `--line`, `--accent`…).
Гистограмма 24 часа и «Графики» получают отгрузки только заводов текущей организации (ТАС: ЛХ, ЛЮ; Айсберг: СП, Щ).
