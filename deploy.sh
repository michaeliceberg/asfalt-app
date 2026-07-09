#!/usr/bin/env bash
# Деплой на сервере reg.ru. Запускать из корня проекта на сервере:
#   ./deploy.sh
set -euo pipefail

echo "==> Бэкап базы перед деплоем"
if [ -f data/sqlite.db ]; then
  mkdir -p backups
  cp data/sqlite.db "backups/sqlite-$(date +%Y%m%d-%H%M%S).db"
  # оставляем только 14 последних бэкапов
  ls -1t backups/sqlite-*.db 2>/dev/null | tail -n +15 | xargs -r rm --
fi

echo "==> git pull"
git pull origin main

echo "==> npm ci"
npm ci

echo "==> Применяем миграции (если есть)"
# Не блокируем весь деплой, если миграции упадут: история таблицы
# __drizzle_migrations на проде разошлась с файлами в drizzle/migrations
# (наследие старого .gitignore, когда папка миграций не коммитилась) —
# сама схема БД при этом уже актуальна (сверено вручную). Если когда-то
# понадобится настоящая новая миграция — смотреть на вывод этого шага
# отдельно, а не полагаться на то, что деплой остановится сам.
if [ -d drizzle/migrations ] && [ -n "$(ls -A drizzle/migrations 2>/dev/null)" ]; then
  npm run db:migrate || echo "⚠️  db:migrate завершился с ошибкой — проверь вывод выше вручную. Деплой продолжается, т.к. это может быть просто рассинхрон истории миграций, а не реальная проблема схемы."
fi

echo "==> Чистим .next перед сборкой"
rm -rf .next

echo "==> build"
npm run build

echo "==> pm2 reload"
pm2 reload ecosystem.config.js --update-env
pm2 save

echo "==> Статус"
pm2 status
pm2 logs asfalt-app --lines 20 --nostream

echo "==> Готово"
