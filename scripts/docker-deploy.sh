#!/bin/bash
# =============================================
# Nexus Docker 一键部署
# 用法: bash scripts/docker-deploy.sh
# =============================================
set -e

cd "$(dirname "$0")/.."

echo "=========================================="
echo "  Nexus Docker 部署"
echo "=========================================="

# ---- 检查依赖 ----
if ! command -v docker &> /dev/null; then
  echo "[ERROR] 未检测到 Docker，请先安装 Docker Desktop"
  exit 1
fi

if ! docker compose version &> /dev/null; then
  echo "[ERROR] 需要 Docker Compose v2，请升级 Docker Desktop"
  exit 1
fi

# ---- 检查 JWT_SECRET ----
JWT_SECRET=$(grep JWT_SECRET standalone-server/.env.production | cut -d'=' -f2-)
if [ "$JWT_SECRET" = "change-me-to-a-random-string-at-least-32-chars" ]; then
  echo ""
  echo "⚠  安全警告：你还没有修改 JWT_SECRET！"
  echo "  请编辑 standalone-server/.env.production"
  echo "  将 JWT_SECRET 替换为一个随机字符串"
  echo ""
  read -rp "  是否现在生成一个随机密钥？[Y/n] " REPLY
  if [[ ! $REPLY =~ ^[Nn] ]]; then
    NEW_SECRET=$(openssl rand -hex 32 2>/dev/null || node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    if [ "$(uname)" = "Darwin" ]; then
      sed -i '' "s/^JWT_SECRET=.*/JWT_SECRET=$NEW_SECRET/" standalone-server/.env.production
    else
      sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$NEW_SECRET/" standalone-server/.env.production
    fi
    echo "  ✓ JWT_SECRET 已自动生成"
  fi
fi

# ---- 构建 + 启动 ----
echo ""
echo "[1/2] 构建镜像..."
docker compose build --pull

echo ""
echo "[2/2] 启动服务..."
docker compose up -d

# ---- 等待健康检查 ----
echo ""
echo "等待服务就绪..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:18632/api/health > /dev/null 2>&1; then
    echo ""
    echo "=========================================="
    echo "  Nexus 部署成功！"
    echo "  访问地址: http://localhost:18632"
    echo "  默认账号: admin / admin123"
    echo "=========================================="
    exit 0
  fi
  sleep 2
done

echo ""
echo "[WARN] 服务启动超时，请查看日志: docker compose logs nexus-server"
exit 1
