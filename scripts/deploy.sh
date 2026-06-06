#!/bin/bash
set -e

APP_NAME="Nexus Server"
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="$BASE_DIR/backups"
HEALTH_URL="http://localhost:18632/api/health"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "=== $APP_NAME 部署开始 ($TIMESTAMP) ==="

# ---- 部署前检查 ----

echo "[pre-deploy] 健康检查..."
if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
  echo "[pre-deploy] 当前服务正常运行"
else
  echo "[pre-deploy] 警告：当前服务未运行，继续部署"
fi

# ---- 数据库备份 ----

echo "[backup] 数据库备份..."
mkdir -p "$BACKUP_DIR"
if [ -f "$BASE_DIR/standalone-server/data/design.db" ]; then
  cp "$BASE_DIR/standalone-server/data/design.db" "$BACKUP_DIR/design_${TIMESTAMP}.db"
  echo "[backup] SQLite 已备份到 backups/design_${TIMESTAMP}.db"
elif command -v mysqldump &> /dev/null; then
  # MySQL 备份（需要环境变量 DB_HOST/DB_USER/DB_PASSWORD/DB_NAME）
  mysqldump -h "${DB_HOST:-127.0.0.1}" -u "${DB_USER:-d_design}" -p"${DB_PASSWORD}" "${DB_NAME:-d_design_art}" \
    > "$BACKUP_DIR/mysql_${TIMESTAMP}.sql" 2>/dev/null || echo "[backup] MySQL 备份跳过（未配置或连接失败）"
fi

# ---- 部署 ----

cd "$BASE_DIR/standalone-server"

if [ -f "$BASE_DIR/docker-compose.yml" ] && command -v docker &> /dev/null; then
  # Docker 模式
  echo "[deploy] Docker 模式..."
  docker compose build
  docker compose up -d
  echo "[deploy] Docker 容器已重启"
  docker compose ps
else
  # PM2 / 直接启动模式
  echo "[deploy] 安装依赖..."
  npm ci --production

  if command -v pm2 &> /dev/null; then
    echo "[deploy] PM2 重启..."
    pm2 restart ecosystem.config.js 2>/dev/null || pm2 start ecosystem.config.js
    pm2 save
  else
    echo "[deploy] 直接启动（开发模式）..."
  fi
fi

# ---- 部署后验证 ----

echo "[post-deploy] 等待服务启动..."
for i in $(seq 1 15); do
  if curl -sf "$HEALTH_URL" > /dev/null 2>&1; then
    echo "[post-deploy] 健康检查通过"
    echo "=== $APP_NAME 部署成功 ==="
    exit 0
  fi
  sleep 2
done

# ---- 健康检查失败 → 回滚 ----

echo "[post-deploy] 错误：健康检查超时，开始回滚..."

if [ -f "$BACKUP_DIR/design_${TIMESTAMP}.db" ]; then
  cp "$BACKUP_DIR/design_${TIMESTAMP}.db" "$BASE_DIR/standalone-server/data/design.db"
  echo "[rollback] SQLite 已从备份恢复"
fi

if command -v pm2 &> /dev/null; then
  pm2 restart ecosystem.config.js
fi

echo "=== $APP_NAME 部署失败，已回滚 ==="
exit 1
