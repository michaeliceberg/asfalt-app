#!/usr/bin/env bash
# Ежедневный бэкап sqlite.db на сервере. Добавь в cron:
#   0 3 * * * /путь/до/asfalt-app/scripts/backup-db.sh >> /var/log/asfalt-backup.log 2>&1
set -euo pipefail

cd "$(dirname "$0")/.."

DB_FILE="data/sqlite.db"
BACKUP_DIR="backups"
KEEP_DAYS=30

if [ ! -f "$DB_FILE" ]; then
  echo "$(date '+%Y-%m-%d %H:%M:%S') Файл $DB_FILE не найден, пропуск"
  exit 0
fi

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
cp "$DB_FILE" "$BACKUP_DIR/sqlite-$STAMP.db"
gzip "$BACKUP_DIR/sqlite-$STAMP.db"

# удаляем бэкапы старше KEEP_DAYS дней
find "$BACKUP_DIR" -name 'sqlite-*.db.gz' -mtime +"$KEEP_DAYS" -delete

echo "$(date '+%Y-%m-%d %H:%M:%S') Бэкап создан: $BACKUP_DIR/sqlite-$STAMP.db.gz"
