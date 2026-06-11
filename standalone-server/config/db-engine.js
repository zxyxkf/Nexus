/**
 * 数据库引擎 - 双模式支持
 * 自动检测 MySQL 可用性，否则回退 SQLite
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

/**
 * 初始化数据库引擎
 * 1. 先尝试 MySQL 连接
 * 2. 失败则自动回退 SQLite
 */
async function initEngine() {
  const config = getDbConfig();

  // 策略：默认 SQLite 零配置启动。设置 USE_MYSQL=1 环境变量启用 MySQL
  const useMySQL = process.env.USE_MYSQL === '1' || process.env.DB_ENGINE === 'mysql';

  // MySQL 模式（需显式开启）
  if (useMySQL) {
    try {
      const tempConn = await mysql.createConnection({
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
      await tempConn.end();

      const { type: _configType, ...mysqlPoolConfig } = config.mysql;
      mysqlPool = mysql.createPool(mysqlPoolConfig);

      // 确保连接池中每个新连接都使用 utf8mb4
      mysqlPool.on('connection', async (conn) => {
        await conn.execute('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
      });

      dbMode = 'mysql';
      console.log('[DB] MySQL 模式已激活（高并发生产模式）');
      return { mode: 'mysql', pool: mysqlPool };
    } catch (err) {
      console.error('[DB] MySQL 连接失败，回退 SQLite:', err.message);
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
async function execute(sql, params = []) {
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

    // 对于写操作，显式获取连接以确保 charset 正确传递
    const trimmed = finalSql.trim().toUpperCase();
    const isMutation = trimmed.startsWith('INSERT') || trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE') || trimmed.startsWith('REPLACE');
    if (isMutation) {
      const conn = await mysqlPool.getConnection();
      try {
        await conn.query('SET NAMES utf8mb4');
        const [rows, fields] = await conn.query(finalSql, finalParams);
        return [rows, fields];
      } finally {
        conn.release();
      }
    }

    const [rows, fields] = await mysqlPool.execute(finalSql, finalParams);
    return [rows, fields];
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
  close,
  saveSqlite,
  restoreFromSnapshot,
  get mysqlPool() { return mysqlPool },
  get sqliteDb() { return sqliteDb }
};
