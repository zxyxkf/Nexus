/**
 * Nexus 服务端启动入口
 * 启动方式: node server.js
 */

require('./config/env');

const http = require('http');
const { Server } = require('socket.io');
const { verifyToken } = require('./middleware/auth');
const { close, getMode } = require('./config/database');
const createApp = require('./app');
const { PORT, HOST, UPLOAD_DIR, NODE_ENV } = require('./config/env');

async function start() {
  const app = await createApp();

  const server = http.createServer(app);

  // Socket.IO — 实时推送任务变更
  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 20000,
    pingInterval: 10000
  });

  // WebSocket 升级后的连接排除 HTTP 层超时，防止与 Socket.IO 心跳冲突
  server.on('upgrade', (req, socket) => {
    socket.setTimeout(120000);
    socket.on('timeout', () => {});
  });

  // Socket.IO 认证中间件
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('未登录'));
    const decoded = verifyToken(token);
    if (!decoded) return next(new Error('Token无效或已过期'));
    const permissions = Array.isArray(decoded.permissions) ? decoded.permissions : [];
    const groups = new Set([
      decoded.role === 'cs_agent' || decoded.role === 'basic_designer' ? 'cs' : decoded.role === 'operator_assistant' ? 'operator' : 'design'
    ]);
    if (decoded.role === 'admin' || permissions.includes('*') || permissions.some(p => p.endsWith('.design'))) groups.add('design');
    if (decoded.role === 'admin' || permissions.includes('*') || permissions.some(p => p.endsWith('.cs') || p.endsWith('.basic'))) groups.add('cs');
    if (decoded.role === 'admin' || permissions.includes('*') || permissions.some(p => p.endsWith('.operator') || p.endsWith('.assistant'))) groups.add('operator');
    socket.data = {
      userId: decoded.id,
      username: decoded.username,
      role: decoded.role,
      realName: decoded.realName,
      taskGroup: [...groups][0],
      taskGroups: [...groups]
    };
    next();
  });

  io.on('connection', (socket) => {
    const { userId, role, taskGroup, taskGroups } = socket.data;
    socket.join(`user:${userId}`);
    socket.join(`role:${role}`);
    for (const group of taskGroups || [taskGroup]) socket.join(`group:${group}`);
    console.log(`[WS] 连接: ${socket.data.username}(${role}) userId=${userId} group=${taskGroup}`);
    if (role === 'basic_designer') {
      socket.to('group:cs').emit('task:update');
    }
    socket.on('disconnect', () => {
      console.log(`[WS] 断开: ${socket.data.username}`);
      if (role === 'basic_designer') {
        socket.to('group:cs').emit('task:update');
      }
    });
  });

  global.io = io;

  const dbMode = getMode();
  const dbConfig = require('./config/db-config').getDbConfig();

  server.listen(PORT, HOST, () => {
    console.log('══════════════════════════════════════════════');
    console.log('  Nexus 服务端已启动');
    console.log(`  地址: http://${HOST}:${PORT}`);
    console.log('══════════════════════════════════════════════');
    console.log(`  环境:     ${NODE_ENV}`);
    console.log(`  数据库:   ${dbMode === 'mysql' ? 'MySQL' : 'SQLite'}`);
    if (dbMode === 'mysql') {
      console.log(`  数据库地址: ${dbConfig.mysql.host}:${dbConfig.mysql.port}`);
      console.log(`  数据库名称: ${dbConfig.mysql.database}`);
      console.log(`  数据库用户: ${dbConfig.mysql.user}`);
    } else {
      console.log(`  数据库文件: ${dbConfig.sqlite.dbPath}`);
    }
    console.log(`  上传目录:   ${UPLOAD_DIR}`);
    console.log(`  健康检查:   http://localhost:${PORT}/api/health`);
    console.log('══════════════════════════════════════════════');
  });

  server.timeout = 30000;           // 空闲连接 30s 回收
  server.keepAliveTimeout = 61000;  // 稍高于浏览器默认 60s keep-alive
  server.headersTimeout = 62000;    // 必须 > keepAliveTimeout
  server.requestTimeout = 30000;    // 请求最长处理时间
  server.maxConnections = 1000;     // 防止异常情况下连接数失控

  // 定期清理过期的 refresh token（每小时）
  setInterval(async () => {
    try {
      const { getPool, getMode } = require('./config/database');
      const pool = getPool();
      const mode = getMode();
      const nowExpr = mode === 'mysql' ? 'NOW()' : "datetime('now')";
      await pool.execute(`DELETE FROM sys_refresh_token WHERE expires_at < ${nowExpr}`);
    } catch { /* 静默 */ }
  }, 60 * 60 * 1000);

  // 优雅关闭
  process.on('SIGINT', () => {
    console.log('\n[Server] 正在关闭...');
    close();
    server.close(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    close();
    server.close(() => process.exit(0));
  });
}

start().catch(err => {
  console.error('[Server] 启动失败:', err.message);
  process.exit(1);
});
