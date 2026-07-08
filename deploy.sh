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
if [ -d drizzle/migrations ] && [ -n "$(ls -A drizzle/migrations 2>/dev/null)" ]; then
  npm run db:migrate
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
