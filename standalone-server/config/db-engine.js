/**
 * 数据库引擎 - 双模式支持
 * 显式启用 MySQL 时尝试连接；生产环境失败则停止，其他环境可回退 SQLite
 */

const mysql = require('mysql2/promise');
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const { getDbConfig } = require('./db-config');

let dbMode = null; // 'mysql' | 'sqlite'
let mysqlPool = null;
let sqliteDb = null;
let SQL = null; // sql.js 库引用
let mysqlPoolLimit = 0;
let mysqlQueueLimit = 0;
let mysqlConnectTimeout = 0;
const mysqlPoolStats = {
  activeConnections: 0,
  waitingForConnection: 0,
  totalQueries: 0,
  slowQueries: 0,
  transactions: 0,
  slowTransactions: 0,
  errors: 0,
  lastErrorAt: null
};

const PRODUCTION_MYSQL_STARTUP_ATTEMPTS = 10;
const PRODUCTION_MYSQL_RETRY_DELAY_MS = 3000;

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getSlowQueryThresholdMs() {
  const value = Number.parseInt(process.env.DB_SLOW_QUERY_MS, 10);
  return Number.isFinite(value) && value > 0 ? value : 1000;
}

function summarizeSql(sql) {
  const normalized = String(sql || '').replace(/\s+/g, ' ').trim();
  return normalized.length > 240 ? `${normalized.slice(0, 237)}...` : normalized;
}

function recordMysqlError(operation, durationMs, error) {
  mysqlPoolStats.errors += 1;
  mysqlPoolStats.lastErrorAt = new Date().toISOString();
  console.error('[DB] MySQL 操作失败:', {
    operation,
    durationMs,
    errorCode: error?.code || null,
    errorMessage: error?.message || String(error)
  });
}

function recordMysqlQuery(sql, startedAt, error = null) {
  const durationMs = Date.now() - startedAt;
  mysqlPoolStats.totalQueries += 1;
  if (error) recordMysqlError(summarizeSql(sql), durationMs, error);
  if (durationMs >= getSlowQueryThresholdMs()) {
    mysqlPoolStats.slowQueries += 1;
    console.warn(`[DB] MySQL 慢查询 ${durationMs}ms: ${summarizeSql(sql)}`);
  }
}

async function acquireMysqlConnection() {
  if (!mysqlPool) throw new Error('MySQL 连接池尚未初始化');
  const startedAt = Date.now();
  mysqlPoolStats.waitingForConnection += 1;
  try {
    const conn = await mysqlPool.getConnection();
    const waitMs = Date.now() - startedAt;
    if (waitMs >= getSlowQueryThresholdMs()) {
      console.warn(`[DB] MySQL 获取连接等待 ${waitMs}ms`);
    }
    mysqlPoolStats.activeConnections += 1;
    return conn;
  } catch (error) {
    if (error?.message === 'Queue limit reached.') error.code = 'DB_POOL_QUEUE_LIMIT';
    recordMysqlError('POOL_ACQUIRE', Date.now() - startedAt, error);
    throw error;
  } finally {
    mysqlPoolStats.waitingForConnection = Math.max(0, mysqlPoolStats.waitingForConnection - 1);
  }
}

function releaseMysqlConnection(conn) {
  try {
    conn?.release();
  } finally {
    mysqlPoolStats.activeConnections = Math.max(0, mysqlPoolStats.activeConnections - 1);
  }
}

function recordMysqlTransaction(durationMs, error = null) {
  mysqlPoolStats.transactions += 1;
  if (error) recordMysqlError('TRANSACTION', durationMs, error);
  if (durationMs >= getSlowQueryThresholdMs()) {
    mysqlPoolStats.slowTransactions += 1;
    console.warn(`[DB] MySQL 慢事务 ${durationMs}ms`);
  }
}

function isExpectedMigrationError(sql, error) {
  const normalizedSql = String(sql || '').trim().toUpperCase();
  const code = error?.code;
  const message = String(error?.message || '').toLowerCase();

  if (code === 'ER_DUP_FIELDNAME') return normalizedSql.startsWith('ALTER TABLE');
  if (code === 'ER_DUP_KEYNAME') return /^CREATE\s+(UNIQUE\s+)?INDEX\b/.test(normalizedSql);
  if (code === 'ER_TABLE_EXISTS_ERROR') return normalizedSql.startsWith('CREATE TABLE');

  // SQLite reports schema idempotency failures through the message instead of a stable code.
  if (normalizedSql.startsWith('ALTER TABLE') && message.includes('duplicate column name')) return true;
  if (/^CREATE\s+(UNIQUE\s+)?INDEX\b/.test(normalizedSql) && message.includes('already exists')) return true;

  return false;
}

function getPoolStats() {
  return {
    mode: dbMode,
    connectionLimit: mysqlPoolLimit,
    queueLimit: mysqlQueueLimit,
    connectTimeoutMs: mysqlConnectTimeout,
    activeConnections: mysqlPoolStats.activeConnections,
    waitingForConnection: mysqlPoolStats.waitingForConnection,
    totalQueries: mysqlPoolStats.totalQueries,
    slowQueries: mysqlPoolStats.slowQueries,
    transactions: mysqlPoolStats.transactions,
    slowTransactions: mysqlPoolStats.slowTransactions,
    errors: mysqlPoolStats.errors,
    lastErrorAt: mysqlPoolStats.lastErrorAt,
    slowQueryThresholdMs: getSlowQueryThresholdMs()
  };
}

async function verifyMySqlConnection(config) {
  let tempConn = null;
  try {
    tempConn = await mysql.createConnection({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      charset: 'utf8mb4',
      connectTimeout: 3000
    });

    await tempConn.execute(
      `CREATE DATABASE IF NOT EXISTS \`${config.mysql.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  } finally {
    if (tempConn) {
      try {
        await tempConn.end();
      } catch (cleanupError) {
        console.warn('[DB] 关闭 MySQL 临时连接失败，继续按初始化结果处理:', cleanupError.message);
      }
    }
  }
}

async function activateMySql(config) {
  const { type: _configType, ...mysqlPoolConfig } = config.mysql;
  const pool = mysql.createPool(mysqlPoolConfig);

  try {
    // 确保连接池中每个新连接都使用 utf8mb4
    pool.on('connection', async (conn) => {
      await conn.execute('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
    });
  } catch (error) {
    try {
      await pool.end();
    } catch (cleanupError) {
      console.warn('[DB] 关闭未完成初始化的 MySQL 连接池失败:', cleanupError.message);
    }
    throw error;
  }

  mysqlPool = pool;
  mysqlPoolLimit = Number(mysqlPoolConfig.connectionLimit) || 0;
  mysqlQueueLimit = Number(mysqlPoolConfig.queueLimit) || 0;
  mysqlConnectTimeout = Number(mysqlPoolConfig.connectTimeout) || 0;
  Object.keys(mysqlPoolStats).forEach(key => {
    mysqlPoolStats[key] = key === 'lastErrorAt' ? null : 0;
  });
  dbMode = 'mysql';
  console.log('[DB] MySQL 模式已激活（高并发生产模式）');
  return { mode: 'mysql', pool: mysqlPool };
}

/**
 * 初始化数据库引擎
 * 1. 显式启用时尝试 MySQL 连接
 * 2. 生产环境重试后仍失败则停止；其他环境失败可回退 SQLite
 */
async function initEngine() {
  const config = getDbConfig();

  // 策略：默认 SQLite 零配置启动。设置 USE_MYSQL=1 环境变量启用 MySQL
  const useMySQL = process.env.USE_MYSQL === '1' || process.env.DB_ENGINE === 'mysql';

  // MySQL 模式（需显式开启）
  if (useMySQL) {
    const production = process.env.NODE_ENV === 'production';
    const attempts = production ? PRODUCTION_MYSQL_STARTUP_ATTEMPTS : 1;
    let lastError;
    let connectionReady = false;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        await verifyMySqlConnection(config);
        connectionReady = true;
        break;
      } catch (err) {
        lastError = err;
        if (production && attempt < attempts) {
          console.warn(`[DB] MySQL 连接失败（${attempt}/${attempts}），${PRODUCTION_MYSQL_RETRY_DELAY_MS / 1000} 秒后重试:`, err.message);
          await wait(PRODUCTION_MYSQL_RETRY_DELAY_MS);
        }
      }
    }

    if (!connectionReady) {
      if (production) {
        console.error(`[DB] MySQL 连续 ${attempts} 次连接失败，生产环境拒绝回退 SQLite:`, lastError.message);
        throw lastError;
      }

      console.error('[DB] MySQL 连接失败，回退 SQLite:', lastError.message);
    } else {
      try {
        return await activateMySql(config);
      } catch (err) {
        if (production) {
          console.error('[DB] MySQL 连接池初始化失败，生产环境拒绝回退 SQLite:', err.message);
          throw err;
        }
        console.error('[DB] MySQL 连接池初始化失败，回退 SQLite:', err.message);
      }
    }
  }

  // SQLite 模式（默认，零配置）
  try {
    SQL = await initSqlJs();
    
    if (fs.existsSync(config.sqlite.dbPath)) {
      const buffer = fs.readFileSync(config.sqlite.dbPath);
      sqliteDb = new SQL.Database(buffer);
    } else {
      sqliteDb = new SQL.Database();
      const dir = path.dirname(config.sqlite.dbPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    sqliteDb.run('PRAGMA journal_mode=WAL');
    // WAL 模式下 synchronous=NORMAL 兼顾安全与并发性能
    sqliteDb.run('PRAGMA synchronous=NORMAL');
    // 并发写入遇到锁时最多等待 5 秒再报错（默认 0，立即抛 SQLITE_BUSY）
    sqliteDb.run('PRAGMA busy_timeout=5000');
    // 缓存大小 64MB（默认 2MB），提升大量查询时的性能
    sqliteDb.run('PRAGMA cache_size=-65536');
    dbMode = 'sqlite';
    console.log('[DB] SQLite 模式已激活（零配置开箱即用）:', config.sqlite.dbPath);
    return { mode: 'sqlite', db: sqliteDb };
  } catch (err) {
    console.error('[DB] SQLite 初始化失败:', err.message);
    throw err;
  }
}

/**
 * 保存 SQLite 数据库到文件
 */
function saveSqlite() {
  if (dbMode === 'sqlite' && sqliteDb) {
    const config = getDbConfig();
    const data = sqliteDb.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(config.sqlite.dbPath, buffer);
  }
}

/**
 * 将 MySQL SQL 转换为 SQLite 兼容语法
 * 仅在 SQLite 模式下执行
 */
function transformSql(sql) {
  if (dbMode !== 'sqlite') return sql;

  let result = sql;

  // 1. NOW() → datetime('now', 'localtime')
  result = result.replace(/\bNOW\(\)/gi, "datetime('now','localtime')");

  // 2. CURDATE() → date('now')
  result = result.replace(/\bCURDATE\(\)/gi, "date('now')");

  // 3. DATE_SUB(CURDATE(), INTERVAL n DAY) → date('now', '-n days')
  result = result.replace(/DATE_SUB\s*\(\s*(?:CURDATE\(\)|date\('now'\))\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, "date('now','-$1 days')");

  // 4. DATE_SUB(date, INTERVAL n DAY) → date(date, '-n days')
  result = result.replace(/DATE_SUB\s*\(\s*(\w+(?:\.\w+)?)\s*,\s*INTERVAL\s+(\d+)\s+DAY\s*\)/gi, "date($1,'-$2 days')");

  // 5. FOR UPDATE → 移除（SQLite 不支持行锁）
  if (/FOR\s+UPDATE/i.test(result)) {
    console.warn('[DB] SQLite 模式不支持 FOR UPDATE，已移除。该查询无行锁保护:', result.substring(0, 80));
    result = result.replace(/\s+FOR\s+UPDATE\s*$/gim, '');
  }

  // 6. CONCAT(a, b) → a || b
  // 简单处理：如果参数是两个字段
  result = result.replace(/CONCAT\s*\(([^,]+),([^)]+)\)/gi, "$1 || $2");

  // 7. 反引号 → 移除
  result = result.replace(/`/g, '');

  // 8. MySQL JSON 函数 → SQLite 等价
  result = result.replace(/\bJSON_ARRAYAGG\s*\(/gi, 'json_group_array(');
  result = result.replace(/\bJSON_OBJECT\s*\(/gi, 'json_object(');
  result = result.replace(/\bJSON_ARRAY\s*\(\s*\)/gi, 'json_array()');
  result = result.replace(/\bIFNULL\s*\(/gi, 'ifnull(');

  // 9. MySQL 日期提取函数 → SQLite strftime
  result = result.replace(/\bMONTH\s*\(\s*([^)]+?)\s*\)/gi, "CAST(strftime('%m', $1) AS INTEGER)");
  result = result.replace(/\bYEAR\s*\(\s*([^)]+?)\s*\)/gi, "CAST(strftime('%Y', $1) AS INTEGER)");

  return result;
}

/**
 * 执行 SQL 查询（统一接口，兼容 mysql2 返回格式 [rows, fields]）
 * MySQL 模式自动内联 LIMIT/OFFSET 参数（mysql2 不支持参数化 LIMIT）
 */
async function execute(sql, params = [], options = {}) {
  if (dbMode === 'mysql') {
    let finalSql = sql;
    let finalParams = params;

    // 修复：MySQL 不支持参数化 LIMIT ? OFFSET ?，内联处理
    if (/LIMIT\s+\?\s+OFFSET\s+\?/i.test(finalSql)) {
      const limitVal = parseInt(params[params.length - 2]) || 15;
      const offsetVal = parseInt(params[params.length - 1]) || 0;
      finalSql = finalSql.replace(/LIMIT\s+\?\s+OFFSET\s+\?/i, `LIMIT ${limitVal} OFFSET ${offsetVal}`);
      finalParams = params.slice(0, -2);
    }

    const conn = await acquireMysqlConnection();
    const startedAt = Date.now();
    const trimmed = finalSql.trim().toUpperCase();
    const isMutation = trimmed.startsWith('INSERT') || trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE') || trimmed.startsWith('REPLACE');
    try {
      // 连接池已在连接初始化时设置 utf8mb4，避免每次写操作重复发送 SET NAMES。
      const [rows, fields] = isMutation
        ? await conn.query(finalSql, finalParams)
        : await conn.execute(finalSql, finalParams);
      recordMysqlQuery(finalSql, startedAt);
      return [rows, fields];
    } catch (error) {
      if (options.suppressExpectedMigrationErrors && isExpectedMigrationError(finalSql, error)) {
        recordMysqlQuery(finalSql, startedAt);
        return [{ affectedRows: 0, insertId: 0 }, undefined];
      }
      recordMysqlQuery(finalSql, startedAt, error);
      throw error;
    } finally {
      releaseMysqlConnection(conn);
    }
  } else {
    const transformedSql = transformSql(sql);
    const stmt = sqliteDb.prepare(transformedSql);
    if (params && params.length > 0) {
      // 将 Date 对象转为本地时间字符串（避免 UTC 转换导致跨时区日期偏移）
      const safeParams = params.map(p => {
        if (p instanceof Date) {
          const pad2 = n => String(n).padStart(2, '0');
          return `${p.getFullYear()}-${pad2(p.getMonth()+1)}-${pad2(p.getDate())} ${pad2(p.getHours())}:${pad2(p.getMinutes())}:${pad2(p.getSeconds())}`;
        }
        return p;
      });
      stmt.bind(safeParams);
    }
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    const affectedRows = sqliteDb.getRowsModified();
    // 获取最后插入的 ID（SQLite 需要额外查询）
    let insertId = 0;
    try {
      const idStmt = sqliteDb.prepare('SELECT last_insert_rowid() AS id');
      if (idStmt.step()) {
        const row = idStmt.getAsObject();
        insertId = row.id;
      }
      idStmt.free();
    } catch (_) {}
    saveSqlite();

    const metadata = { affectedRows, insertId };
    // 匹配 mysql2 行为：SELECT 返回 [rows, fields]，INSERT/UPDATE/DELETE 返回 [result, undefined]
    const trimmed = transformedSql.trim().toUpperCase();
    const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('WITH') || trimmed.startsWith('PRAGMA');
    if (isSelect) {
      return [rows, metadata];
    } else {
      return [metadata, rows];
    }
  }
}

/**
 * 获取数据库模式
 */
function getMode() {
  return dbMode;
}

/**
 * 关闭数据库连接
 */
function close() {
  if (dbMode === 'mysql' && mysqlPool) {
    mysqlPool.end().catch(() => {});
  }
  if (dbMode === 'sqlite' && sqliteDb) {
    saveSqlite();
    sqliteDb.close();
  }
}

/**
 * SQLite 快照恢复 — 从二进制快照重建内存数据库并刷盘
 * 用于 executeTransaction 失败回滚
 */
function restoreFromSnapshot(buffer) {
  if (dbMode === 'sqlite' && SQL && buffer) {
    if (sqliteDb) sqliteDb.close();
    sqliteDb = new SQL.Database(Buffer.from(buffer));
    saveSqlite();
    console.log('[DB] SQLite 事务回滚：已从快照恢复');
  }
}

module.exports = {
  initEngine,
  execute,
  getMode,
  getPoolStats,
  getSlowQueryThresholdMs,
  isExpectedMigrationError,
  acquireMysqlConnection,
  releaseMysqlConnection,
  recordMysqlTransaction,
  close,
  saveSqlite,
  restoreFromSnapshot,
  get mysqlPool() { return mysqlPool },
  get sqliteDb() { return sqliteDb }
};
