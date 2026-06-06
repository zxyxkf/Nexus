# ===== Stage 1: 构建 Vue 前端 =====
FROM node:20-slim AS frontend-builder
WORKDIR /build
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY vite.config.js index.html ./
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

# ===== Stage 2: 生产运行环境 =====
FROM node:20-slim
WORKDIR /app

RUN groupadd -r nexus && useradd -r -g nexus -d /app nexus

RUN npm install -g pm2

COPY standalone-server/package*.json ./
RUN npm ci --production && npm cache clean --force

COPY standalone-server/ ./
COPY --from=frontend-builder /build/dist/ ./dist/

RUN mkdir -p logs upload data releases && chown -R nexus:nexus /app

EXPOSE 18632

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "require('http').get('http://localhost:18632/api/health',r=>{process.exit(r.statusCode===200?0:1)})"

USER nexus

CMD ["pm2-runtime", "start", "ecosystem.config.js"]
