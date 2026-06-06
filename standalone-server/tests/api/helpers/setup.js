/**
 * API 集成测试辅助函数
 * 每次测试使用独立 SQLite 临时数据库
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

let appInstance = null;
let tmpDir = null;

function cleanupDir(dir) {
  if (dir && fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function setupApp() {
  // 每次创建独立临时目录作为模拟的 APPDATA
  tmpDir = path.join(os.tmpdir(), `nexus-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  // 强制 SQLite 模式（测试环境不走 MySQL）
  process.env.USE_MYSQL = '0';
  process.env.DB_ENGINE = 'sqlite';

  // 覆盖 APPDATA 使 SQLite 落在临时目录
  process.env.APPDATA = tmpDir;

  // 清除服务器模块缓存（确保重新初始化 DB）
  const cacheKeys = Object.keys(require.cache).filter(k =>
    k.includes('standalone-server') &&
    !k.includes('node_modules') &&
    !k.includes('tests/')
  );
  for (const key of cacheKeys) {
    delete require.cache[key];
  }

  const createApp = require('../../../app');
  appInstance = await createApp();
  return appInstance;
}

function getApp() {
  if (!appInstance) throw new Error('setupApp() must be called before getApp()');
  return appInstance;
}

function getTmpDir() {
  return tmpDir;
}

afterAll(() => {
  cleanupDir(tmpDir);
});

module.exports = { setupApp, getApp, getTmpDir, cleanupDir };
