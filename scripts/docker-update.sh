#!/bin/bash
# =============================================
# Nexus Docker 一键更新
# 用法: bash scripts/docker-update.sh
# =============================================
set -e

cd "$(dirname "$0")/.."

echo "=========================================="
echo "  Nexus Docker 更新"
echo "=========================================="

# ---- 备份数据库 ----
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo ""
echo "[1/4] 备份数据库..."
if docker compose exec -T mysql mysqldump -u d_design -pNexus@2026!Prod#MyDB d_design_art \
  > "$BACKUP_DIR/mysql_${TIMESTAMP}.sql" 2>/dev/null; then
  echo "  ✓ MySQL 已备份到 backups/mysql_${TIMESTAMP}.sql"
else
  # SQLite fallback
  if docker compose exec -T nexus-server test -f /app/data/design.db 2>/dev/null; then
    docker compose cp nexus-server:/app/data/design.db "$BACKUP_DIR/design_${TIMESTAMP}.db" 2>/dev/null
    echo "  ✓ SQLite 已备份到 backups/design_${TIMESTAMP}.db"
  else
    echo "  ⚠ 未检测到数据库，跳过备份"
  fi
fi

# ---- 拉取最新代码（如果是 git 仓库） ----
echo ""
echo "[2/4] 拉取最新代码..."
if [ -d .git ]; then
  git pull --ff-only 2>/dev/null && echo "  ✓ 代码已更新" || echo "  ⚠ 无法拉取更新（网络问题或非 git 仓库）"
else
  echo "  - 非 git 仓库，跳过代码更新"
fi

# ---- 重新构建 + 启动 ----
echo ""
echo "[3/4] 重新构建镜像..."
docker compose build --pull

echo ""
echo "[4/4] 滚动更新（停旧 → 启新）..."
docker compose down
docker compose up -d

# ---- 等待健康检查 ----
echo ""
echo "等待服务就绪..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:18632/api/health > /dev/null 2>&1; then
    echo ""
    echo "=========================================="
    echo "  Nexus 更新完成！"
    echo "  备份文件: backups/mysql_${TIMESTAMP}.sql"
    echo "=========================================="
    exit 0
  fi
  sleep 2
done

echo ""
echo "[ERROR] 服务启动失败，正在回滚..."
if [ -f "$BACKUP_DIR/mysql_${TIMESTAMP}.sql" ]; then
  echo "  请手动恢复数据库:"
  echo "  docker compose exec -T mysql mysql -u d_design -p d_design_art < $BACKUP_DIR/mysql_${TIMESTAMP}.sql"
fi
exit 1
