/**
 * 数据库连接配置 - 双引擎支持
 * 自动检测 MySQL 可用性，失败自动回退 SQLite
 * 零配置：小白用户无需安装 MySQL
 */

const path = require('path');
const fs = require('fs');
const dbEngine = require('./db-engine');

// ===== 初始化 SQL 表（兼容 SQLite 和 MySQL） =====

const CREATE_TABLES_SQL = {
  sqlite: [
    `CREATE TABLE IF NOT EXISTS sys_user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      real_name TEXT DEFAULT '',
      role TEXT DEFAULT 'operator',
      store TEXT DEFAULT '',
      is_team_lead INTEGER DEFAULT 0,
      email TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      status INTEGER DEFAULT 1,
      last_login_time TEXT,
      create_time TEXT DEFAULT (datetime('now', 'localtime')),
      update_time TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS sys_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT DEFAULT '',
      role TEXT DEFAULT '',
      operation TEXT DEFAULT '',
      module TEXT DEFAULT '',
      request_url TEXT DEFAULT '',
      request_params TEXT DEFAULT '',
      result_code INTEGER DEFAULT 0,
      result_msg TEXT DEFAULT '',
      cost_time INTEGER DEFAULT 0,
      ip_addr TEXT DEFAULT '',
      create_time TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS sys_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT NOT NULL UNIQUE,
      config_value TEXT DEFAULT '',
      config_group TEXT DEFAULT 'system',
      config_desc TEXT DEFAULT '',
      editable INTEGER DEFAULT 1,
      create_time TEXT DEFAULT (datetime('now', 'localtime')),
      update_time TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    // 通知表
    `CREATE TABLE IF NOT EXISTS sys_notification (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      type TEXT DEFAULT 'system',
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      task_id INTEGER,
      is_read INTEGER DEFAULT 0,
      create_time TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    // 评论表
    `CREATE TABLE IF NOT EXISTS sys_comment (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER,
      username TEXT DEFAULT '',
      real_name TEXT DEFAULT '',
      role TEXT DEFAULT '',
      content TEXT DEFAULT '',
      images TEXT DEFAULT '',
      is_deleted INTEGER DEFAULT 0,
      create_time TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    // 兼容旧路由使用的 task_info 表
    `CREATE TABLE IF NOT EXISTS task_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_no TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority INTEGER DEFAULT 2,
      status TEXT DEFAULT 'wait',
      publisher_id INTEGER,
      publisher_name TEXT DEFAULT '',
      designer_id INTEGER,
      designer_name TEXT DEFAULT '',
      reject_reason TEXT DEFAULT '',
      deadline TEXT,
      score_item_id INTEGER,
      score REAL DEFAULT 0,
      ref_path TEXT DEFAULT '',
      style_number TEXT DEFAULT '',
      specified_color TEXT DEFAULT '',
      wangwang_id TEXT DEFAULT '',
      applied_score REAL DEFAULT 0,
      score_review_status TEXT DEFAULT '',
      score_review_reason TEXT DEFAULT '',
      finished_at TEXT,
      create_time TEXT DEFAULT (datetime('now', 'localtime')),
      update_time TEXT DEFAULT (datetime('now', 'localtime')),
      finish_time TEXT,
      submit_time TEXT,
      task_group TEXT DEFAULT 'design',
      shop_name TEXT DEFAULT '',
      quantity INTEGER DEFAULT 1,
      task_file_path TEXT DEFAULT '',
      work_path TEXT DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS task_file (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      file_name TEXT DEFAULT '',
      file_path TEXT DEFAULT '',
      file_size INTEGER DEFAULT 0,
      file_type TEXT DEFAULT '',
      mime_type TEXT DEFAULT '',
      uploader_id INTEGER,
      file_category TEXT DEFAULT 'work',
      create_time TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS sys_oper_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT DEFAULT '',
      role TEXT DEFAULT '',
      operation TEXT DEFAULT '',
      module TEXT DEFAULT '',
      method TEXT DEFAULT '',
      request_url TEXT DEFAULT '',
      request_params TEXT DEFAULT '',
      result_code INTEGER DEFAULT 0,
      result_msg TEXT DEFAULT '',
      error_msg TEXT DEFAULT '',
      ip_addr TEXT DEFAULT '',
      cost_time INTEGER DEFAULT 0,
      create_time TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS sys_score_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      score REAL DEFAULT 0,
      score_desc TEXT DEFAULT '',
      create_time TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS sys_score_item_operator (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      score REAL DEFAULT 0,
      score_desc TEXT DEFAULT '',
      create_time TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS sys_score_item_cs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      score REAL DEFAULT 0,
      score_desc TEXT DEFAULT '',
      create_time TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS sys_score_record (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      task_id INTEGER,
      score_item_id INTEGER,
      score REAL DEFAULT 0,
      remark TEXT DEFAULT '',
      create_time TEXT DEFAULT (datetime('now', 'localtime'))
    )`,
    `CREATE TABLE IF NOT EXISTS sys_refresh_token (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      revoked INTEGER DEFAULT 0,
      create_time TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (user_id) REFERENCES sys_user(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS sys_announcement (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      created_by INTEGER,
      create_time TEXT DEFAULT (datetime('now', 'localtime')),
      update_time TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (created_by) REFERENCES sys_user(id)
    )`
  ],
  mysql: [
    `CREATE TABLE IF NOT EXISTS sys_user (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      real_name VARCHAR(100) DEFAULT '',
      role VARCHAR(20) DEFAULT 'operator',
      store VARCHAR(100) DEFAULT '',
      is_team_lead TINYINT DEFAULT 0,
      email VARCHAR(200) DEFAULT '',
      phone VARCHAR(50) DEFAULT '',
      remark TEXT,
      status TINYINT DEFAULT 1,
      last_login_time DATETIME,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS sys_shop (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      sort_order INT DEFAULT 0,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS sys_log (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      username VARCHAR(100) DEFAULT '',
      role VARCHAR(20) DEFAULT '',
      operation VARCHAR(200) DEFAULT '',
      module VARCHAR(100) DEFAULT '',
      request_url VARCHAR(500) DEFAULT '',
      request_params TEXT,
      result_code INT DEFAULT 0,
      result_msg TEXT,
      cost_time INT DEFAULT 0,
      ip_addr VARCHAR(50) DEFAULT '',
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS sys_config (
      id INT AUTO_INCREMENT PRIMARY KEY,
      config_key VARCHAR(100) NOT NULL UNIQUE,
      config_value TEXT,
      config_group VARCHAR(50) DEFAULT 'system',
      config_desc VARCHAR(500) DEFAULT '',
      editable TINYINT DEFAULT 1,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS sys_notification (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      type VARCHAR(20) DEFAULT 'system',
      title VARCHAR(200) DEFAULT '',
      content TEXT,
      task_id INT,
      is_read TINYINT DEFAULT 0,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS sys_comment (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      user_id INT,
      username VARCHAR(100) DEFAULT '',
      real_name VARCHAR(100) DEFAULT '',
      role VARCHAR(20) DEFAULT '',
      content TEXT,
      images TEXT,
      is_deleted TINYINT DEFAULT 0,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS task_info (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_no VARCHAR(50) NOT NULL UNIQUE,
      title VARCHAR(500) NOT NULL,
      description TEXT,
      priority TINYINT DEFAULT 2,
      status VARCHAR(20) DEFAULT 'wait',
      publisher_id INT,
      publisher_name VARCHAR(100) DEFAULT '',
      designer_id INT,
      designer_name VARCHAR(100) DEFAULT '',
      reject_reason TEXT,
      deadline DATETIME,
      score_item_id INT,
      score DECIMAL(10,2) DEFAULT 0,
      ref_path VARCHAR(1000) DEFAULT '',
      style_number VARCHAR(100) DEFAULT '',
      specified_color VARCHAR(100) DEFAULT '',
      wangwang_id VARCHAR(100) DEFAULT '',
      applied_score DECIMAL(10,2) DEFAULT 0,
      score_review_status VARCHAR(20) DEFAULT '',
      score_review_reason TEXT,
      finished_at DATETIME,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      finish_time DATETIME,
      submit_time DATETIME,
      task_group VARCHAR(20) DEFAULT 'design',
      shop_name VARCHAR(100) DEFAULT '',
      quantity INT DEFAULT 1,
      task_file_path VARCHAR(1000) DEFAULT '',
      work_path VARCHAR(1000) DEFAULT ''
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS task_file (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT,
      file_name VARCHAR(500) DEFAULT '',
      file_path VARCHAR(1000) DEFAULT '',
      file_size INT DEFAULT 0,
      file_type VARCHAR(50) DEFAULT '',
      mime_type VARCHAR(100) DEFAULT '',
      uploader_id INT,
      file_category VARCHAR(20) DEFAULT 'work',
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS sys_oper_log (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      username VARCHAR(100) DEFAULT '',
      role VARCHAR(20) DEFAULT '',
      operation VARCHAR(200) DEFAULT '',
      module VARCHAR(100) DEFAULT '',
      method VARCHAR(20) DEFAULT '',
      request_url VARCHAR(500) DEFAULT '',
      request_params TEXT,
      result_code INT DEFAULT 0,
      result_msg TEXT,
      error_msg TEXT,
      ip_addr VARCHAR(50) DEFAULT '',
      cost_time INT DEFAULT 0,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS sys_score_item (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL UNIQUE,
      score DECIMAL(10,2) DEFAULT 0,
      score_desc VARCHAR(500) DEFAULT '',
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS sys_score_item_operator (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL UNIQUE,
      score DECIMAL(10,2) DEFAULT 0,
      score_desc VARCHAR(500) DEFAULT '',
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS sys_score_item_cs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL UNIQUE,
      score DECIMAL(10,2) DEFAULT 0,
      score_desc VARCHAR(500) DEFAULT '',
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS sys_score_record (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT,
      task_id INT,
      score_item_id INT,
      score DECIMAL(10,2) DEFAULT 0,
      remark VARCHAR(500) DEFAULT '',
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS sys_refresh_token (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token VARCHAR(255) NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      revoked TINYINT DEFAULT 0,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES sys_user(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    `CREATE TABLE IF NOT EXISTS sys_announcement (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      content TEXT NOT NULL,
      is_active TINYINT DEFAULT 0,
      created_by INT,
      create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES sys_user(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
  ]
};

const SEED_DATA = {
  sqlite: [
    `INSERT OR IGNORE INTO sys_user (username, password, real_name, role, status)
     VALUES ('admin', '$2a$10$9WDdMTCuUjrMYBfknNbFY.gxfRHodF2wnkIS/LpsuXUmhrdNWDlOi', '管理员', 'admin', 1)`
  ],
  mysql: [
    `INSERT IGNORE INTO sys_user (username, password, real_name, role, status)
     VALUES ('admin', '$2a$10$9WDdMTCuUjrMYBfknNbFY.gxfRHodF2wnkIS/LpsuXUmhrdNWDlOi', '管理员', 'admin', 1)`
  ]
};

/**
 * 初始化数据库
 */
async function initDatabase() {
  try {
    const { mode } = await dbEngine.initEngine();
    console.log(`[DB] 引擎模式: ${mode}`);

    // 建表
    const tableSqls = CREATE_TABLES_SQL[mode] || CREATE_TABLES_SQL.sqlite;
    for (const sql of tableSqls) {
      try { await dbEngine.execute(sql); } catch (err) {
        console.warn('[DB] 建表警告:', err.message);
      }
    }

    const alterSqls = mode === 'mysql' ? [
      `ALTER TABLE sys_user ADD COLUMN store VARCHAR(100) DEFAULT '' AFTER role`,
      `ALTER TABLE sys_user MODIFY COLUMN role VARCHAR(20) DEFAULT 'operator'`,
      `ALTER TABLE task_info ADD COLUMN score_item_id INT AFTER reject_reason`,
      `ALTER TABLE task_info ADD COLUMN score DECIMAL(10,2) DEFAULT 0 AFTER score_item_id`,
      `ALTER TABLE task_info ADD COLUMN ref_path VARCHAR(1000) DEFAULT '' AFTER score`,
      `ALTER TABLE task_info ADD COLUMN style_number VARCHAR(100) DEFAULT '' AFTER ref_path`,
      `ALTER TABLE task_info ADD COLUMN wangwang_id VARCHAR(100) DEFAULT '' AFTER style_number`,
      `ALTER TABLE task_info ADD COLUMN publisher_name VARCHAR(100) DEFAULT '' AFTER publisher_id`,
      `ALTER TABLE task_info ADD COLUMN designer_name VARCHAR(100) DEFAULT '' AFTER designer_id`,
      `ALTER TABLE task_info ADD COLUMN finish_time DATETIME AFTER update_time`,
      `ALTER TABLE sys_oper_log ADD COLUMN error_msg TEXT AFTER result_msg`,
      `ALTER TABLE task_file ADD COLUMN file_category VARCHAR(20) DEFAULT 'work' AFTER uploader_id`,
      `ALTER TABLE task_info ADD COLUMN task_group VARCHAR(20) DEFAULT 'design'`,
      `ALTER TABLE task_info ADD COLUMN specified_color VARCHAR(100) DEFAULT ''`,
      `ALTER TABLE sys_score_item ADD COLUMN task_group VARCHAR(20) DEFAULT NULL`,
      `ALTER TABLE task_info ADD COLUMN shop_name VARCHAR(100) DEFAULT ''`,
      `ALTER TABLE task_info ADD COLUMN quantity INT DEFAULT 1`,
      `ALTER TABLE task_info ADD COLUMN actual_quantity INT DEFAULT 0`,
      `ALTER TABLE task_info ADD COLUMN task_file_path VARCHAR(1000) DEFAULT ''`,
      `ALTER TABLE sys_user ADD COLUMN is_team_lead TINYINT DEFAULT 0`,
      `ALTER TABLE task_info ADD COLUMN applied_score DECIMAL(10,2) DEFAULT 0`,
      `ALTER TABLE task_info ADD COLUMN score_review_status VARCHAR(20) DEFAULT ''`,
      `ALTER TABLE task_info ADD COLUMN score_review_reason TEXT`,
      `ALTER TABLE task_info ADD COLUMN work_path VARCHAR(1000) DEFAULT ''`,
      `ALTER TABLE task_info ADD COLUMN submit_time DATETIME`,
      `CREATE TABLE IF NOT EXISTS sys_score_item_operator (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL UNIQUE,
        score DECIMAL(10,2) DEFAULT 0,
        score_desc VARCHAR(500) DEFAULT '',
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      `INSERT IGNORE INTO sys_score_item_operator (name, score, score_desc, create_time)
       SELECT name, score, score_desc, create_time FROM sys_score_item WHERE task_group = 'operator'`,
      `DELETE FROM sys_score_item WHERE task_group = 'operator'`,
      `DELETE FROM sys_score_item WHERE name IN ('补单表格整理后发财务审核','走钉钉申请一天请补单款项','销售额填写','出评数量检查，催评价','补单+备注插旗','找评价+做评价','补退款单','返款','补单平台售后问题处理','中差评检查、差评处理','评价加精和置顶——种草','修改商品编码','聚水潭铺货上架产品','手动创建商品','昨日上新产品检查','上新产品数据表填写','新品运营/新品橱窗报名','营销托管','品牌新享','搜集主图图片','查询客服聊天记录','竞店上新统计','每月店铺动销率统计','每月销售额拆解表完成进度数据填写','新品推广数据记录','表格/数据统计')`,
      `CREATE TABLE IF NOT EXISTS sys_score_item_cs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(200) NOT NULL UNIQUE,
        score DECIMAL(10,2) DEFAULT 0,
        score_desc VARCHAR(500) DEFAULT '',
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    ] : [
      `ALTER TABLE sys_user ADD COLUMN store TEXT DEFAULT ''`,
      `ALTER TABLE task_info ADD COLUMN score_item_id INTEGER`,
      `ALTER TABLE task_info ADD COLUMN score REAL DEFAULT 0`,
      `ALTER TABLE task_info ADD COLUMN ref_path TEXT DEFAULT ''`,
      `ALTER TABLE task_info ADD COLUMN style_number TEXT DEFAULT ''`,
      `ALTER TABLE task_info ADD COLUMN wangwang_id TEXT DEFAULT ''`,
      `ALTER TABLE task_info ADD COLUMN designer_name TEXT DEFAULT ''`,
      `ALTER TABLE task_info ADD COLUMN finish_time TEXT`,
      `ALTER TABLE sys_oper_log ADD COLUMN error_msg TEXT DEFAULT ''`,
      `ALTER TABLE task_file ADD COLUMN file_category TEXT DEFAULT 'work'`,
      `ALTER TABLE task_info ADD COLUMN task_group TEXT DEFAULT 'design'`,
      `ALTER TABLE task_info ADD COLUMN specified_color TEXT DEFAULT ''`,
      `ALTER TABLE sys_score_item ADD COLUMN task_group TEXT DEFAULT NULL`,
      `ALTER TABLE task_info ADD COLUMN shop_name TEXT DEFAULT ''`,
      `ALTER TABLE task_info ADD COLUMN quantity INTEGER DEFAULT 1`,
      `ALTER TABLE task_info ADD COLUMN actual_quantity INTEGER DEFAULT 0`,
      `ALTER TABLE task_info ADD COLUMN task_file_path TEXT DEFAULT ''`,
      `ALTER TABLE sys_user ADD COLUMN is_team_lead INTEGER DEFAULT 0`,
      `ALTER TABLE task_info ADD COLUMN applied_score REAL DEFAULT 0`,
      `ALTER TABLE task_info ADD COLUMN score_review_status TEXT DEFAULT ''`,
      `ALTER TABLE task_info ADD COLUMN score_review_reason TEXT DEFAULT ''`,
      `ALTER TABLE task_info ADD COLUMN work_path TEXT DEFAULT ''`,
      `ALTER TABLE task_info ADD COLUMN submit_time TEXT`,
      `CREATE TABLE IF NOT EXISTS sys_score_item_cs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        score REAL DEFAULT 0,
        score_desc TEXT DEFAULT '',
        create_time TEXT DEFAULT (datetime('now', 'localtime'))
      )`,
      `CREATE TABLE IF NOT EXISTS sys_score_item_operator (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        score REAL DEFAULT 0,
        score_desc TEXT DEFAULT '',
        create_time TEXT DEFAULT (datetime('now', 'localtime'))
      )`,
      `INSERT OR IGNORE INTO sys_score_item_operator (name, score, score_desc, create_time)
       SELECT name, score, score_desc, create_time FROM sys_score_item WHERE task_group = 'operator'`,
      `DELETE FROM sys_score_item WHERE task_group = 'operator'`,
      `DELETE FROM sys_score_item WHERE name IN ('补单表格整理后发财务审核','走钉钉申请一天请补单款项','销售额填写','出评数量检查，催评价','补单+备注插旗','找评价+做评价','补退款单','返款','补单平台售后问题处理','中差评检查、差评处理','评价加精和置顶——种草','修改商品编码','聚水潭铺货上架产品','手动创建商品','昨日上新产品检查','上新产品数据表填写','新品运营/新品橱窗报名','营销托管','品牌新享','搜集主图图片','查询客服聊天记录','竞店上新统计','每月店铺动销率统计','每月销售额拆解表完成进度数据填写','新品推广数据记录','表格/数据统计')`
    ];
    for (const sql of alterSqls) {
      try { await dbEngine.execute(sql); } catch (err) {}
    }

    // 插入种子数据（密码已用真实 bcrypt hash 固化，无需额外更新）
    const seeds = SEED_DATA[mode] || SEED_DATA.sqlite;
    for (const sql of seeds) {
      try { await dbEngine.execute(sql); } catch (err) {}
    }

    // 积分项目种子数据
    const scoreItems = generateScoreSeed(mode);
    for (const sql of scoreItems) {
      try { await dbEngine.execute(sql); } catch (err) {}
    }

    // 系统配置种子数据
    const configSeeds = generateConfigSeed(mode);
    for (const sql of configSeeds) {
      try { await dbEngine.execute(sql); } catch (err) {}
    }

    console.log(`[DB] 数据库初始化完成 (${mode})`);
    return { mode, engine: dbEngine };
  } catch (err) {
    console.error('[DB] 初始化失败:', err.message);
    throw err;
  }
}

/**
 * 获取数据库执行器
 */
async function execute(sql, params = []) {
  return dbEngine.execute(sql, params);
}

/**
 * 获取引擎模式
 */
function getMode() {
  return dbEngine.getMode();
}

/**
 * 积分种子数据
 */
function generateScoreSeed(mode) {
  const designItems = [
    ['主图', 3, ''], ['主图+副图', 4, ''], ['主图+SKU图', 4, ''], ['老图修改', 1, ''],
    ['主图（四人以上）', 4, ''], ['SKU 尺码图（多款组合）', 1, ''], ['SKU AI图', 3, ''],
    ['SKU 套版图', 1, ''], ['AI详情页', 0, '丁总打分'], ['套版副图', 1, ''],
    ['原创副图', 2, '两张以上'], ['店铺装修', 0, '丁总打分'], ['海报图', 3, ''],
    ['AI买家秀', 3, '四张以上'], ['特殊情况', 0, '丁总打分'], ['AI副图', 2, '']
  ];
  const operatorItems = [
    ['补单表格整理后发财务审核', 1, '销售额填写 | 天'],
    ['走钉钉申请一天请补单款项', 1, '销售额填写 | 天'],
    ['销售额填写', 1, '销售额填写 | 天'],
    ['出评数量检查，催评价', 2, '补单 | 天'],
    ['补单+备注插旗', 1, '补单 | 单 (0.5分)'],
    ['找评价+做评价', 2, '补单 | 单'],
    ['补退款单', 1, '补单 | 单'],
    ['返款', 0.1, '补单 | 次（转账次数）'],
    ['补单平台售后问题处理', 2, '补单 | 次'],
    ['中差评检查、差评处理', 2, '补单 | 次'],
    ['评价加精和置顶——种草', 1, '补单 | 次'],
    ['修改商品编码', 1, '聚水潭 | 个'],
    ['聚水潭铺货上架产品', 3, '上架 | 个'],
    ['手动创建商品', 3, '上架 | 个'],
    ['昨日上新产品检查', 1, '上架 | 个'],
    ['上新产品数据表填写', 1, '上架 | 个'],
    ['新品运营/新品橱窗报名', 0.1, '上架 | 每个链接'],
    ['营销托管', 1, '上架 | 每个链接'],
    ['品牌新享', 1, '上架 | 每个链接'],
    ['搜集主图图片', 0.2, '找图 | 张'],
    ['查询客服聊天记录', 5, '客服 | 次'],
    ['竞店上新统计', 5, '日常统计 | 次（3个店铺）'],
    ['每月店铺动销率统计', 1, '日常统计 | 次'],
    ['每月销售额拆解表完成进度数据填写', 2, '日常统计 | 次'],
    ['新品推广数据记录', 1, '日常统计 | 个'],
    ['表格/数据统计', 0, '日常统计 | 临时产生的表格或需要统计数据的任务']
  ];
  const insert = mode === 'mysql' ? 'INSERT IGNORE INTO' : 'INSERT OR IGNORE INTO';
  const designSqls = designItems.map(([name, score, desc]) =>
    `${insert} sys_score_item (name, score, score_desc) VALUES ('${name}', ${score}, '${desc}')`
  );
  const operatorSqls = operatorItems.map(([name, score, desc]) =>
    `${insert} sys_score_item_operator (name, score, score_desc) VALUES ('${name}', ${score}, '${desc}')`
  );
  const csSqls = [
    `${insert} sys_score_item_cs (name, score, score_desc) VALUES ('默认1分', 1, '客服基础美工默认积分')`
  ];
  return [...designSqls, ...operatorSqls, ...csSqls];
}

/**
 * 系统配置种子数据
 */
function generateConfigSeed(mode) {
  const path = require('path');
  const insert = mode === 'mysql' ? 'INSERT IGNORE INTO' : 'INSERT OR IGNORE INTO';
  const uploadRoot = path.resolve(__dirname, '..', 'upload').replace(/\\/g, '/');
  const configs = [
    ['upload.max_file_size_mb', '50', 'upload', '上传文件大小上限（MB）', 1],
    ['upload.max_file_count', '10', 'upload', '单次上传最多文件数', 1],
    ['upload.design_images_dir', '/app/host-uploads/design/images', 'upload', '运营+美工图片存储目录', 1],
    ['upload.design_attachments_dir', '/app/host-uploads/design/attachments', 'upload', '运营+美工附件存储目录', 1],
    ['upload.cs_images_dir', '/app/host-uploads/cs/images', 'upload', '客服+基础美工图片存储目录', 1],
    ['upload.cs_attachments_dir', '/app/host-uploads/cs/attachments', 'upload', '客服+基础美工附件存储目录', 1],
    ['upload.operator_images_dir', '/app/host-uploads/operator/images', 'upload', '运营+运营助理图片存储目录', 1],
    ['upload.operator_attachments_dir', '/app/host-uploads/operator/attachments', 'upload', '运营+运营助理附件存储目录', 1],
  ];
  return configs.map(([key, value, group, desc, editable]) =>
    `${insert} sys_config (config_key, config_value, config_group, config_desc, editable) VALUES ('${key}', '${value}', '${group}', '${desc}', ${editable})`
  );
}

/**
 * 关闭数据库
 */
function close() {
  dbEngine.close();
}

/**
 * 获取虚拟连接池（兼容旧代码中的 pool.execute 调用）
 */
function getPool() {
  return {
    execute: async (sql, params) => dbEngine.execute(sql, params)
  };
}

/**
 * 执行事务 — MySQL 走真实事务，SQLite 走快照回滚
 */
async function executeTransaction(callback) {
  const mode = getMode();

  if (mode === 'mysql') {
    const conn = await dbEngine.mysqlPool.getConnection();
    try {
      await conn.beginTransaction();
      const result = await callback(conn);
      await conn.commit();
      return result;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // SQLite: 操作前导出快照，失败时恢复
  const snapshot = dbEngine.sqliteDb.export();
  try {
    const conn = getPool();
    const result = await callback(conn);
    dbEngine.saveSqlite();
    return result;
  } catch (err) {
    dbEngine.restoreFromSnapshot(snapshot);
    throw err;
  }
}

module.exports = {
  initDatabase,
  execute,
  getMode,
  close,
  getPool,
  executeTransaction
};
