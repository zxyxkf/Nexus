#!/bin/bash
set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

echo "=== Design 数据库备份 $(date '+%Y-%m-%d %H:%M:%S') ==="

# SQLite 备份
DATA_DIR="${1:-./data}"
if [ -f "$DATA_DIR/design.db" ]; then
  cp "$DATA_DIR/design.db" "$BACKUP_DIR/design_$TIMESTAMP.db"
  echo "SQLite → $BACKUP_DIR/design_$TIMESTAMP.db"
  # 保留最近 7 天
  find "$BACKUP_DIR" -name "design_*.db" -mtime +7 -delete 2>/dev/null || true
fi

# MySQL 备份（通过环境变量或 .env 获取连接信息）
if [ -n "$DB_HOST" ] && command -v mysqldump &> /dev/null; then
  MYSQL_PWD="$DB_PASSWORD" mysqldump \
    -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" \
    --single-transaction --routines --triggers \
    "$DB_NAME" > "$BACKUP_DIR/design_mysql_$TIMESTAMP.sql"
  echo "MySQL  → $BACKUP_DIR/design_mysql_$TIMESTAMP.sql"
  find "$BACKUP_DIR" -name "design_mysql_*.sql" -mtime +7 -delete 2>/dev/null || true
fi

echo "备份完成，保留最近 7 天"
