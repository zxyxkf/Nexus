/**
 * 数据库配置 - 双引擎支持 (MySQL / SQLite)
 * 自动检测: 优先连接 MySQL, 连接失败自动回退 SQLite
 * 零配置: 小白用户无需安装 MySQL 即可直接运行
 */

const path = require('path');
const fs = require('fs');
const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = require('./env');

// ===== 配置 =====
const DB_MODE_KEY = 'design_db_mode';

function getDbConfig() {
  const userDataPath = process.env.DATA_DIR
    ? process.env.DATA_DIR
    : process.env.APPDATA
      ? path.join(process.env.APPDATA, 'design-art-manager')
      : path.join(__dirname, '..', '..', 'data');
  
  // 确保数据目录存在
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  // SQLite 配置（零配置，自动创建）
  const sqliteConfig = {
    type: 'sqlite',
    dbPath: path.join(userDataPath, 'design.db'),
    userDataPath
  };

  // MySQL 配置（高性能，需手动创建用户）
  const mysqlConfig = {
    type: 'mysql', // 内部标识，传给 mysql2 前需去除
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 50,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    supportBigNumbers: true,
    bigNumberStrings: true,
    dateStrings: true
  };

  return { sqlite: sqliteConfig, mysql: mysqlConfig, userDataPath };
}

module.exports = { getDbConfig, DB_MODE_KEY };
