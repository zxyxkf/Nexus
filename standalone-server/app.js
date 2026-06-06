/**
 * Express 应用工厂 — 创建并配置 Express 实例
 * 供 server.js（生产启动）和 supertest（测试挂载）共用
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { initDatabase, getPool } = require('./config/database');
const { initStorageConfig } = require('./utils/share');
const { isProduction, UPLOAD_DIR } = require('./config/env');
const releasesDir = path.join(__dirname, 'releases');

// 注册路由
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const taskRoutes = require('./routes/task');
const logRoutes = require('./routes/log');
const configRoutes = require('./routes/config');
const notificationRoutes = require('./routes/notification');
const commentRoutes = require('./routes/comment');
const exportRoutes = require('./routes/export');
const scoreRoutes = require('./routes/score');
const announcementRoutes = require('./routes/announcement');
const shopRoutes = require('./routes/shop');

/**
 * 创建并返回配置完成的 Express 应用
 * 调用方负责 listen 或传给 supertest
 */
async function createApp() {
  // 初始化数据库
  await initDatabase();
  console.log('[Server] 数据库初始化完成');

  // 加载存储目录配置（从 sys_config 或使用默认值）
  await initStorageConfig(getPool());

  // 确保上传目录
  const uploadDir = UPLOAD_DIR;
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const app = express();

  // 请求 ID — 必须在所有中间件之前
  const { requestIdMiddleware } = require('./middleware/requestId');
  app.use(requestIdMiddleware);

  // CORS 跨域
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));

  // Body 解析
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  // 静态文件服务（上传文件访问）
  app.use('/upload', express.static(uploadDir, {
    maxAge: '1d',
    etag: true,
    lastModified: true
  }));

  // 静态文件服务（客户端更新包：latest.yml + .exe 安装包）
  if (!fs.existsSync(releasesDir)) {
    fs.mkdirSync(releasesDir, { recursive: true });
  }
  app.use('/releases', express.static(releasesDir, {
    maxAge: '1h',
    etag: true,
    lastModified: true
  }));
  console.log(`[Server] 更新包托管目录: ${releasesDir}`);

  // 生产模式：托管前端构建产物
  const distDir = fs.existsSync(path.join(__dirname, 'dist'))
    ? path.join(__dirname, 'dist')
    : path.join(__dirname, '..', 'dist');
  if (isProduction) {
    if (fs.existsSync(distDir)) {
      app.use('/assets', express.static(path.join(distDir, 'assets'), {
        maxAge: '365d',
        immutable: true,
        etag: true
      }));
      app.use(express.static(distDir, {
        maxAge: '7d',
        etag: true,
        setHeaders: (res, filePath) => {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          }
        }
      }));
      console.log('[Server] 生产模式：托管前端静态文件');
    }
  }

  // HTTP 访问日志
  const { middleware: logMiddlewares } = require('./utils/logger');
  logMiddlewares.forEach(m => app.use(m));

  // API 全局速率限制
  // 测试模式跳过；生产环境 1000次/分钟（支持几十人并发使用）
  // 排除登录（login已有独立限流）和健康检查（避免误判服务器离线）
  const isTest = process.env.DISABLE_RATE_LIMIT === '1';
  const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isTest ? 10000 : isProduction ? 1000 : 500,
    skip: (req) => isTest || req.path === '/auth/login' || req.path === '/health',
    message: { code: 429, msg: '请求过于频繁，请稍后再试' },
    standardHeaders: true,
    legacyHeaders: false,
    // 限流触发时记录日志（便于排查）
    handler: (req, res) => {
      console.warn(`[RateLimit] IP=${req.ip} path=${req.originalUrl} 触发限流`);
      res.status(429).json({ code: 429, msg: '请求过于频繁，请稍后再试' });
    }
  });
  app.use('/api', apiLimiter);

  // API 路由
  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  app.use('/api/task', taskRoutes);
  app.use('/api/log', logRoutes);
  app.use('/api/config', configRoutes);
  app.use('/api/notification', notificationRoutes);
  app.use('/api/comment', commentRoutes);
  app.use('/api/export', exportRoutes);
  app.use('/api/score', scoreRoutes);
app.use('/api/announcement', announcementRoutes);
  app.use('/api/shop', shopRoutes);

  // 健康检查
  app.get('/api/health', (req, res) => {
    res.json({ code: 0, msg: 'ok', time: new Date().toISOString() });
  });

  // SPA fallback（仅生产模式）
  if (isProduction) {
    const indexPath = path.join(distDir, 'index.html');
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/') || req.path.startsWith('/upload/') || req.path.startsWith('/releases/')) return next();
      if (fs.existsSync(indexPath)) res.sendFile(indexPath);
      else next();
    });
  }

  // 全局错误处理
  const errorHandler = require('./middleware/errorHandler');
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
