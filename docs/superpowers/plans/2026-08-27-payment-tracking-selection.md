# 打款跟踪选品收集 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 Nexus 中交付按店铺隔离、按阶段推进、可从作品审核复制图片创建的选品收集与打款记录功能。

**Architecture:** 后端增加独立的 `payment-tracking` 路由和服务目录，使用核心记录表、阶段表、阶段明细表和图片表保存结构化数据；现有任务模块只通过来源任务 ID 提供只读数据。前端增加独立列表页、归档页和阶段详情页，所有允许访问的阶段与动作以后端返回值为准。

**Tech Stack:** Vue 3、Vue Router、Element Plus、Axios、Express、sql.js/SQLite、MySQL、Jest、Supertest、Playwright。

---

## 执行约束

- 只使用本地 SQLite 开发和测试，确认 `USE_MYSQL=0`、`DB_ENGINE=sqlite`。
- 不运行 `npm run build`、Electron 打包或 Docker 构建。
- 不修改、暂存或提交现有的 `src/views/Layout.vue`、`vite.config.js`、`.local-dev-upload/`、`.superpowers/`。
- 每次提交只包含当前任务列出的文件。
- 所有接口同时执行权限、店铺、状态、阶段和版本校验，不能只在前端隐藏按钮。

## 文件结构

### 后端新文件

- `standalone-server/config/payment-tracking-schema.js`：SQLite/MySQL 表结构和索引。
- `standalone-server/services/payment-tracking/constants.js`：阶段、选项、字段名和权限码。
- `standalone-server/services/payment-tracking/rules.js`：计算、阶段校验和结束原因派生。
- `standalone-server/services/payment-tracking/access.js`：店铺与动作权限判断。
- `standalone-server/services/payment-tracking/repository.js`：记录、阶段、明细和图片 SQL。
- `standalone-server/services/payment-tracking/image.service.js`：上传、复制、预览路径和失败清理。
- `standalone-server/services/payment-tracking/record.service.js`：列表、详情、手动创建和软删除。
- `standalone-server/services/payment-tracking/workflow.service.js`：保存阶段、推进、结束、恢复和重开。
- `standalone-server/services/payment-tracking/open.service.js`：从单条/批量任务开启打款。
- `standalone-server/services/payment-tracking/index.js`：服务出口。
- `standalone-server/routes/payment-tracking/index.js`：路由聚合。
- `standalone-server/routes/payment-tracking/record-routes.js`：列表、详情、创建、删除。
- `standalone-server/routes/payment-tracking/workflow-routes.js`：阶段动作。
- `standalone-server/routes/payment-tracking/image-routes.js`：图片上传、排序、软删除和预览。
- `standalone-server/routes/payment-tracking/open-routes.js`：单条和批量开启。
- `standalone-server/tests/unit/payment-tracking-rules.test.js`：计算和状态机单测。
- `standalone-server/tests/api/payment-tracking-schema.test.js`：自动建表与配置种子测试。
- `standalone-server/tests/api/payment-tracking.test.js`：主业务 API 集成测试。
- `standalone-server/tests/api/payment-tracking-images.test.js`：文件复制与回滚测试。

### 前端新文件

- `src/api/payment-tracking.js`：接口封装和图片 URL。
- `src/config/payment-tracking.js`：阶段、选项和显示标签。
- `src/components/payment-tracking/ProductRowCard.vue`：进行中和归档商品卡。
- `src/components/payment-tracking/StageTimeline.vue`：只展示已进入节点。
- `src/components/payment-tracking/ImageGallery.vue`：上传、封面和全量预览。
- `src/components/payment-tracking/PromotionAdjustments.vue`：动态推广调整时间线。
- `src/views/payment-tracking/SelectionList.vue`：进行中列表。
- `src/views/payment-tracking/RecordsList.vue`：打款记录列表。
- `src/views/payment-tracking/StageDetail.vue`：阶段详情外壳。
- `src/views/payment-tracking/forms/SelectionForm.vue`：信息及选品。
- `src/views/payment-tracking/forms/PreparationForm.vue`：第1-6天。
- `src/views/payment-tracking/forms/TestingForm.vue`：第7-11天。
- `src/views/payment-tracking/forms/MonitoringForm.vue`：第12-18天。
- `src/views/payment-tracking/forms/BreakoutForm.vue`：第12-30天。
- `src/views/payment-tracking/forms/SummaryForm.vue`：生命周期总结。
- `tests/payment-tracking/payment-tracking.spec.js`：前端页面和审核联动 E2E。
- `playwright.payment-tracking.config.js`：仅启动 Vite、全部 API mock 的 E2E 配置。

### 修改文件

- `standalone-server/config/database.js`
- `standalone-server/config/permissions.js`
- `standalone-server/utils/share.js`
- `standalone-server/app.js`
- `standalone-server/tests/unit/permissions.test.js`
- `standalone-server/tests/api/config.test.js`
- `src/api/index.js`
- `src/config/menus.js`
- `src/router/index.js`
- `src/views/shared/Review.vue`
- `package.json`

## Task 1: 注册权限和独立图片目录配置

**Files:**
- Modify: `standalone-server/config/permissions.js:1-133`
- Modify: `standalone-server/utils/share.js:15-238`
- Modify: `standalone-server/config/database.js:833-851`
- Modify: `standalone-server/tests/unit/permissions.test.js`
- Modify: `standalone-server/tests/api/config.test.js`

- [ ] **Step 1: 写权限和配置种子的失败测试**

在 `permissions.test.js` 增加：

```js
const { PERMISSIONS, defaultPermissionsFor } = require('../../config/permissions');

it('registers payment tracking permissions without granting them to ordinary roles by default', () => {
  const codes = PERMISSIONS.map(item => item.code);
  expect(codes).toEqual(expect.arrayContaining([
    'payment.selection.view',
    'payment.records.view',
    'payment.open',
    'payment.manager_review',
    'payment.stage_reopen',
    'payment.delete'
  ]));
  expect(defaultPermissionsFor('operator')).not.toContain('payment.open');
  expect(defaultPermissionsFor('designer')).not.toContain('payment.selection.view');
  expect(defaultPermissionsFor('admin')).toContain('payment.delete');
});
```

在 `config.test.js` 增加：

```js
it('seeds the editable payment tracking image directory', async () => {
  const res = await request(app)
    .get('/api/config/list?group=upload')
    .set('Authorization', `Bearer ${adminToken}`);
  const config = res.body.data.find(item => item.config_key === 'upload.payment_tracking_images_dir');
  expect(config).toMatchObject({ editable: 1, config_group: 'upload' });
  expect(config.config_value).toContain('payment-tracking');
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd standalone-server && npm test -- --runInBand tests/unit/permissions.test.js tests/api/config.test.js`

Expected: FAIL，缺少6个权限码和 `upload.payment_tracking_images_dir`。

- [ ] **Step 3: 注册权限，不给普通角色默认授权**

在 `PERMISSIONS` 的页面权限区加入前两项，在动作权限区加入后四项：

```js
{ code: 'payment.selection.view', name: '选品收集', type: 'page', group: '打款跟踪' },
{ code: 'payment.records.view', name: '打款记录', type: 'page', group: '打款跟踪' },
{ code: 'payment.open', name: '开启打款', type: 'action', group: '打款跟踪' },
{ code: 'payment.manager_review', name: '店长审核准备工作', type: 'action', group: '打款跟踪' },
{ code: 'payment.stage_reopen', name: '阶段重开与流程恢复', type: 'action', group: '打款跟踪' },
{ code: 'payment.delete', name: '删除选品记录', type: 'action', group: '打款跟踪' }
```

不要把这些权限加入普通角色的 `ROLE_DEFAULTS`；`admin` 通过 `PERMISSIONS.map` 自动获得全部权限。

- [ ] **Step 4: 扩展图片目录运行时配置**

在 `share.js` 增加固定属性，并导出专用 getter：

```js
const DEFAULT_CONFIG = {
  design_images_dir: process.env.DESIGN_IMAGE_DIR || path.join(HOST_UPLOAD_ROOT, 'design', 'images'),
  design_attachments_dir: process.env.DESIGN_ATTACHMENT_DIR || path.join(HOST_UPLOAD_ROOT, 'design', 'attachments'),
  cs_images_dir: process.env.CS_IMAGE_DIR || path.join(HOST_UPLOAD_ROOT, 'cs', 'images'),
  cs_attachments_dir: process.env.CS_ATTACHMENT_DIR || path.join(HOST_UPLOAD_ROOT, 'cs', 'attachments'),
  operator_images_dir: process.env.OPERATOR_IMAGE_DIR || path.join(HOST_UPLOAD_ROOT, 'operator', 'images'),
  operator_attachments_dir: process.env.OPERATOR_ATTACHMENT_DIR || path.join(HOST_UPLOAD_ROOT, 'operator', 'attachments'),
  payment_tracking_images_dir: process.env.PAYMENT_TRACKING_IMAGE_DIR || path.join(HOST_UPLOAD_ROOT, 'payment-tracking', 'images')
};

function getPaymentTrackingImageDir() {
  const dir = storageConfig.payment_tracking_images_dir || DEFAULT_CONFIG.payment_tracking_images_dir;
  ensureDir(dir);
  return dir;
}
```

同时将 `upload.payment_tracking_images_dir` 加入 `keys`、`propMap` 和 `module.exports`。

- [ ] **Step 5: 增加系统配置种子**

在 `generateConfigSeed()` 的 `configs` 中加入：

```js
['upload.payment_tracking_images_dir', '/app/host-uploads/payment-tracking/images', 'upload', '打款跟踪图片存储目录', 1]
```

- [ ] **Step 6: 运行测试并确认通过**

Run: `cd standalone-server && npm test -- --runInBand tests/unit/permissions.test.js tests/api/config.test.js`

Expected: PASS。

- [ ] **Step 7: 本地提交**

```bash
git add standalone-server/config/permissions.js standalone-server/utils/share.js standalone-server/config/database.js standalone-server/tests/unit/permissions.test.js standalone-server/tests/api/config.test.js
git commit -m "feat: register payment tracking permissions and storage"
```

## Task 2: 添加幂等数据库结构

**Files:**
- Create: `standalone-server/config/payment-tracking-schema.js`
- Modify: `standalone-server/config/database.js:1-470`
- Create: `standalone-server/tests/api/payment-tracking-schema.test.js`

- [ ] **Step 1: 写自动建表失败测试**

```js
const { setupApp } = require('./helpers/setup');
const { execute } = require('../../config/database');

beforeAll(async () => {
  await setupApp();
});

it('creates every payment tracking table and unique index', async () => {
  const expected = [
    'payment_selection_record',
    'payment_selection_image',
    'payment_selection_stage',
    'payment_selection_preparation',
    'payment_selection_testing',
    'payment_selection_monitoring',
    'payment_selection_adjustment',
    'payment_selection_breakout',
    'payment_selection_summary'
  ];
  const [tables] = await execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  expect(tables.map(row => row.name)).toEqual(expect.arrayContaining(expected));
  const [indexes] = await execute('PRAGMA index_list(payment_selection_record)');
  expect(indexes.some(index => index.name === 'uk_payment_store_seq')).toBe(true);
  expect(indexes.some(index => index.name === 'uk_payment_source_task')).toBe(true);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd standalone-server && npm test -- --runInBand tests/api/payment-tracking-schema.test.js`

Expected: FAIL，数据表不存在。

- [ ] **Step 3: 创建 SQLite/MySQL schema 模块**

`payment-tracking-schema.js` 必须导出 `{ sqlite, mysql }`。两种方言包含相同列和约束：

```js
const sqlite = [
  `CREATE TABLE IF NOT EXISTS payment_selection_record (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    store TEXT NOT NULL,
    store_seq INTEGER NOT NULL,
    planner_id INTEGER NOT NULL,
    planner_name TEXT DEFAULT '',
    source_task_id INTEGER,
    source_task_no TEXT DEFAULT '',
    selection_date TEXT,
    style_number TEXT DEFAULT '',
    cost REAL,
    sale_price REAL,
    product_id TEXT DEFAULT '',
    selection_method TEXT DEFAULT '',
    detail_text TEXT DEFAULT '',
    design_main_image INTEGER DEFAULT 0,
    sku_le_200 INTEGER,
    listing_date TEXT,
    listing_category TEXT DEFAULT '',
    current_stage TEXT NOT NULL DEFAULT 'selection',
    process_status TEXT NOT NULL DEFAULT 'in_progress',
    end_stage TEXT,
    end_type TEXT,
    end_reason TEXT DEFAULT '',
    ended_at TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    deleted_at TEXT,
    create_time TEXT DEFAULT (datetime('now', 'localtime')),
    update_time TEXT DEFAULT (datetime('now', 'localtime'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uk_payment_store_seq ON payment_selection_record(store, store_seq)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uk_payment_source_task ON payment_selection_record(source_task_id) WHERE source_task_id IS NOT NULL`,
  `CREATE INDEX IF NOT EXISTS idx_payment_status_store ON payment_selection_record(process_status, store, deleted_at)`,
  `CREATE TABLE IF NOT EXISTS payment_selection_image (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    storage_root TEXT NOT NULL,
    relative_path TEXT NOT NULL,
    original_name TEXT DEFAULT '',
    mime_type TEXT DEFAULT '',
    file_size INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    source_task_file_id INTEGER,
    uploader_id INTEGER,
    deleted_at TEXT,
    create_time TEXT DEFAULT (datetime('now', 'localtime'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_payment_image_record ON payment_selection_image(record_id, category, deleted_at, sort_order)`,
  `CREATE TABLE IF NOT EXISTS payment_selection_stage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    stage_code TEXT NOT NULL,
    stage_status TEXT NOT NULL DEFAULT 'active',
    is_reopened INTEGER DEFAULT 0,
    entered_at TEXT DEFAULT (datetime('now', 'localtime')),
    completed_at TEXT,
    UNIQUE(record_id, stage_code)
  )`,
  `CREATE TABLE IF NOT EXISTS payment_selection_preparation (
    record_id INTEGER PRIMARY KEY,
    review_count INTEGER,
    new_ops_registered INTEGER,
    paid_enabled INTEGER,
    paid_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS payment_selection_testing (
    record_id INTEGER PRIMARY KEY,
    car_promotion_method TEXT DEFAULT '',
    car_clicks INTEGER,
    car_ctr REAL,
    car_qualifies INTEGER,
    site_promotion_method TEXT DEFAULT '',
    overall_visitors INTEGER,
    search_visitors INTEGER,
    buyers INTEGER,
    average_ctr REAL,
    potential_status TEXT DEFAULT '',
    unqualified_action TEXT DEFAULT '',
    manager_report_date TEXT,
    wei_stock_reported INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS payment_selection_monitoring (
    record_id INTEGER PRIMARY KEY,
    domestic_sales_count INTEGER,
    added_reviews INTEGER,
    title_optimized_at TEXT,
    qa_count INTEGER,
    detail_optimized_at TEXT,
    material_selected INTEGER,
    sku_optimized_at TEXT,
    campaign_name TEXT DEFAULT '',
    concession_rate REAL,
    quick_peak_done INTEGER,
    abandoned INTEGER DEFAULT 0,
    abandon_reason TEXT DEFAULT '',
    abandon_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS payment_selection_adjustment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    reason TEXT DEFAULT '',
    adjusted_at TEXT,
    fee_ratio_7d REAL,
    payers_7d INTEGER,
    total_budget REAL,
    detail_text TEXT DEFAULT '',
    feedback_text TEXT DEFAULT '',
    UNIQUE(record_id, sort_order)
  )`,
  `CREATE TABLE IF NOT EXISTS payment_selection_breakout (
    record_id INTEGER PRIMARY KEY,
    pit_output_day1 REAL,
    pit_output_day2 REAL,
    pit_output_day3 REAL,
    flash_sale_at TEXT,
    super_breakout_at TEXT,
    rapid_breakout_at TEXT,
    strong_lift_qualified INTEGER,
    search_growth_trend TEXT DEFAULT '',
    payer_trend TEXT DEFAULT '',
    current_budget REAL,
    fee_ratio_7d REAL,
    payers_7d INTEGER,
    adjusted_at TEXT,
    total_budget REAL,
    detail_text TEXT DEFAULT '',
    feedback_text TEXT DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS payment_selection_summary (
    record_id INTEGER PRIMARY KEY,
    exploded INTEGER,
    link_maintenance TEXT DEFAULT '',
    style_definition TEXT DEFAULT '',
    summary_text TEXT DEFAULT '',
    notes TEXT DEFAULT ''
  )`
];
```

MySQL 数组逐表写出完整建表语句，使用 `INT AUTO_INCREMENT`、`VARCHAR`、`DECIMAL(14,4)`、`DATETIME`、`TINYINT`、`ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`。九张表必须分别包含以下列，列名与 SQLite 一致：

- `payment_selection_record`：`id`、`store`、`store_seq`、`planner_id`、`planner_name`、`source_task_id`、`source_task_no`、`selection_date`、`style_number`、`cost`、`sale_price`、`product_id`、`selection_method`、`detail_text`、`design_main_image`、`sku_le_200`、`listing_date`、`listing_category`、`current_stage`、`process_status`、`end_stage`、`end_type`、`end_reason`、`ended_at`、`version`、`deleted_at`、`create_time`、`update_time`。
- `payment_selection_image`：`id`、`record_id`、`category`、`storage_root`、`relative_path`、`original_name`、`mime_type`、`file_size`、`sort_order`、`source_task_file_id`、`uploader_id`、`deleted_at`、`create_time`。
- `payment_selection_stage`：`id`、`record_id`、`stage_code`、`stage_status`、`is_reopened`、`entered_at`、`completed_at`。
- `payment_selection_preparation`：`record_id`、`review_count`、`new_ops_registered`、`paid_enabled`、`paid_at`。
- `payment_selection_testing`：`record_id`、`car_promotion_method`、`car_clicks`、`car_ctr`、`car_qualifies`、`site_promotion_method`、`overall_visitors`、`search_visitors`、`buyers`、`average_ctr`、`potential_status`、`unqualified_action`、`manager_report_date`、`wei_stock_reported`。
- `payment_selection_monitoring`：`record_id`、`domestic_sales_count`、`added_reviews`、`title_optimized_at`、`qa_count`、`detail_optimized_at`、`material_selected`、`sku_optimized_at`、`campaign_name`、`concession_rate`、`quick_peak_done`、`abandoned`、`abandon_reason`、`abandon_at`。
- `payment_selection_adjustment`：`id`、`record_id`、`sort_order`、`reason`、`adjusted_at`、`fee_ratio_7d`、`payers_7d`、`total_budget`、`detail_text`、`feedback_text`。
- `payment_selection_breakout`：`record_id`、`pit_output_day1`、`pit_output_day2`、`pit_output_day3`、`flash_sale_at`、`super_breakout_at`、`rapid_breakout_at`、`strong_lift_qualified`、`search_growth_trend`、`payer_trend`、`current_budget`、`fee_ratio_7d`、`payers_7d`、`adjusted_at`、`total_budget`、`detail_text`、`feedback_text`。
- `payment_selection_summary`：`record_id`、`exploded`、`link_maintenance`、`style_definition`、`summary_text`、`notes`。

主记录表在建表语句中声明：

```js
UNIQUE KEY uk_payment_store_seq (store, store_seq),
UNIQUE KEY uk_payment_source_task (source_task_id),
KEY idx_payment_status_store (process_status, store, deleted_at)
```

图片表声明 `KEY idx_payment_image_record (record_id, category, deleted_at, sort_order)`；阶段表声明 `UNIQUE KEY uk_payment_stage (record_id, stage_code)`；推广调整表声明 `UNIQUE KEY uk_payment_adjustment_order (record_id, sort_order)`。其余子表以 `record_id` 为主键。

- [ ] **Step 4: 接入启动建表**

在 `database.js` 顶部导入；保留现有 `CREATE_TABLES_SQL` 定义不动，在对象定义结束后追加新语句：

```js
const PAYMENT_TRACKING_TABLES = require('./payment-tracking-schema');

CREATE_TABLES_SQL.sqlite.push(...PAYMENT_TRACKING_TABLES.sqlite);
CREATE_TABLES_SQL.mysql.push(...PAYMENT_TRACKING_TABLES.mysql);
```

实际修改时保留现有表定义原位，只在两个数组末尾展开新数组，不重排旧 SQL。

- [ ] **Step 5: 运行 schema 与现有 API 测试**

Run: `cd standalone-server && npm test -- --runInBand tests/api/payment-tracking-schema.test.js tests/api/auth.test.js`

Expected: PASS；重复调用 `setupApp()` 不报表已存在错误。

- [ ] **Step 6: 本地提交**

```bash
git add standalone-server/config/payment-tracking-schema.js standalone-server/config/database.js standalone-server/tests/api/payment-tracking-schema.test.js
git commit -m "feat: add payment tracking database schema"
```

## Task 3: 实现计算和阶段规则

**Files:**
- Create: `standalone-server/services/payment-tracking/constants.js`
- Create: `standalone-server/services/payment-tracking/rules.js`
- Create: `standalone-server/tests/unit/payment-tracking-rules.test.js`

- [ ] **Step 1: 写计算和状态机失败测试**

测试必须覆盖：

```js
const {
  calculateGrossMargin,
  calculateSearchShare,
  validateAdvance,
  deriveEndSnapshot
} = require('../../services/payment-tracking/rules');

expect(calculateGrossMargin(24, 75)).toBe(0.68);
expect(() => calculateGrossMargin(10, 0)).toThrow('售价必须大于0');
expect(calculateSearchShare(32, 180)).toBe(0.1778);
expect(calculateSearchShare(0, 0)).toBeNull();

expect(validateAdvance('preparation', { paid_enabled: 0, paid_at: null })).toEqual({
  ok: false,
  errors: { paid_enabled: '店长必须确认开启付费' }
});
expect(validateAdvance('testing', { potential_status: '不符合' }).ok).toBe(false);
expect(validateAdvance('testing', { potential_status: '符合潜力款标准' }).ok).toBe(true);
expect(deriveEndSnapshot('testing', { potential_status: '不符合', unqualified_action: '直接关闭' })).toEqual({
  endType: 'unqualified',
  endReason: '未达潜力款 · 后续操作：直接关闭'
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd standalone-server && npm test -- --runInBand tests/unit/payment-tracking-rules.test.js`

Expected: FAIL，规则模块不存在。

- [ ] **Step 3: 定义常量**

`constants.js` 导出以下稳定结构：

```js
const STAGES = ['selection', 'preparation', 'testing', 'monitoring', 'breakout', 'summary'];
const NEXT_STAGE = {
  selection: 'preparation',
  preparation: 'testing',
  testing: 'monitoring',
  monitoring: 'breakout',
  breakout: 'summary',
  summary: null
};
const PERMISSIONS = {
  selection: 'payment.selection.view',
  records: 'payment.records.view',
  open: 'payment.open',
  managerReview: 'payment.manager_review',
  reopen: 'payment.stage_reopen',
  delete: 'payment.delete'
};
const POTENTIAL_STATUS = ['符合潜力款标准', '不符合'];
const UNQUALIFIED_ACTIONS = ['设控投产8', '直接关闭', '加入全店推广', '/'];

module.exports = { STAGES, NEXT_STAGE, PERMISSIONS, POTENTIAL_STATUS, UNQUALIFIED_ACTIONS };
```

- [ ] **Step 4: 实现纯函数规则**

`rules.js` 必须做到：

```js
function roundRatio(value) {
  return Math.round(value * 10000) / 10000;
}

function calculateGrossMargin(cost, salePrice) {
  if (salePrice === null || salePrice === undefined || salePrice === '') return null;
  const sale = Number(salePrice);
  const normalizedCost = Number(cost);
  if (!Number.isFinite(sale) || sale <= 0) throw new Error('售价必须大于0');
  if (!Number.isFinite(normalizedCost) || normalizedCost < 0) throw new Error('成本不能为负数');
  return roundRatio((sale - normalizedCost) / sale);
}

function calculateSearchShare(searchVisitors, overallVisitors) {
  const total = Number(overallVisitors);
  const search = Number(searchVisitors);
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(search)) return null;
  return roundRatio(search / total);
}
```

`validateAdvance(stageCode, data)` 返回 `{ ok, errors }`，规则严格按设计文档第4节：信息及选品核心字段必填；准备阶段必须开启付费且有付费时间；测款必须符合潜力款；监测阶段若放弃则禁止推进且原因/时间必填；打爆阶段必须选择强拉升标准；总结无下一阶段。

`deriveEndSnapshot(stageCode, data)` 只读取现有字段，返回以下类型之一：`manual`、`unqualified`、`abandoned`、`completed`。无业务分支原因时返回“主动结束流程”。

- [ ] **Step 5: 运行单测并确认通过**

Run: `cd standalone-server && npm test -- --runInBand tests/unit/payment-tracking-rules.test.js`

Expected: PASS。

- [ ] **Step 6: 本地提交**

```bash
git add standalone-server/services/payment-tracking/constants.js standalone-server/services/payment-tracking/rules.js standalone-server/tests/unit/payment-tracking-rules.test.js
git commit -m "feat: define payment tracking workflow rules"
```

## Task 4: 实现核心记录、店铺隔离和手动创建 API

**Files:**
- Create: `standalone-server/services/payment-tracking/access.js`
- Create: `standalone-server/services/payment-tracking/repository.js`
- Create: `standalone-server/services/payment-tracking/record.service.js`
- Create: `standalone-server/services/payment-tracking/index.js`
- Create: `standalone-server/routes/payment-tracking/record-routes.js`
- Create: `standalone-server/routes/payment-tracking/index.js`
- Modify: `standalone-server/app.js:15-141`
- Create: `standalone-server/tests/api/payment-tracking.test.js`

- [ ] **Step 1: 写手动创建和店铺隔离失败测试**

测试建立A店、B店两个用户，分别授予 `payment.selection.view` 后重新登录。覆盖：

```js
const created = await request(app)
  .post('/api/payment-tracking/records')
  .set('Authorization', `Bearer ${storeAToken}`)
  .send({ selectionDate: '2026-08-27', styleNumber: 'A-100' });
expect(created.body.data).toMatchObject({ store: 'A店', storeSeq: 1, plannerId: storeAUserId });

const second = await request(app)
  .post('/api/payment-tracking/records')
  .set('Authorization', `Bearer ${storeAToken}`)
  .send({ styleNumber: 'A-101' });
expect(second.body.data.storeSeq).toBe(2);

const storeBFirst = await request(app)
  .post('/api/payment-tracking/records')
  .set('Authorization', `Bearer ${storeBToken}`)
  .send({ styleNumber: 'B-100' });
expect(storeBFirst.body.data.storeSeq).toBe(1);

const forbidden = await request(app)
  .get(`/api/payment-tracking/records/${created.body.data.id}`)
  .set('Authorization', `Bearer ${storeBToken}`);
expect(forbidden.body.code).toBe(403);
```

同时测试列表只返回同店铺、admin 返回全部、无页面权限返回403、软删除后默认列表不可见。

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd standalone-server && npm test -- --runInBand tests/api/payment-tracking.test.js`

Expected: FAIL，路由为404。

- [ ] **Step 3: 实现访问判断**

`access.js` 导出：

```js
const AppError = require('../../utils/AppError');
const { ownsPermission } = require('../../middleware/auth');

function isAdmin(user) {
  return user?.role === 'admin' || (user?.permissions || []).includes('*');
}

function assertStoreAccess(record, user) {
  if (isAdmin(user)) return;
  if (!user?.store || record.store !== user.store) throw new AppError(403, '无权访问其他店铺的选品记录');
}

function canManageOwnerRecord(record, user) {
  return isAdmin(user) || Number(record.planner_id) === Number(user.id) || ownsPermission(user, 'payment.stage_reopen');
}

module.exports = { isAdmin, assertStoreAccess, canManageOwnerRecord };
```

- [ ] **Step 4: 实现 repository 的稳定接口**

`repository.js` 只处理 SQL，导出：

```js
module.exports = {
  listRecords,
  countRecords,
  findRecordById,
  findRecordBySourceTaskId,
  allocateStoreSeq,
  insertRecord,
  updateSelection,
  softDeleteRecord,
  listEnteredStages,
  insertInitialStage,
  loadStageData,
  saveStageData,
  listImages,
  insertImage,
  softDeleteImage
};
```

`allocateStoreSeq(conn, store)` 在事务内执行 `SELECT COALESCE(MAX(store_seq), 0) + 1 AS next_seq`。`insertRecord` 依赖 `(store, store_seq)` 唯一约束；发生唯一冲突时 `record.service` 最多重试3次整个事务。

- [ ] **Step 5: 实现 record.service**

返回数据统一为 camelCase，并附加计算值与允许动作：

```js
function presentRecord(record, stages, images, user) {
  return {
    id: record.id,
    store: record.store,
    storeSeq: record.store_seq,
    plannerId: record.planner_id,
    plannerName: record.planner_name,
    sourceTaskId: record.source_task_id,
    sourceTaskNo: record.source_task_no,
    styleNumber: record.style_number,
    grossMargin: calculateGrossMargin(record.cost, record.sale_price),
    currentStage: record.current_stage,
    processStatus: record.process_status,
    endStage: record.end_stage,
    endType: record.end_type,
    endReason: record.end_reason,
    version: record.version,
    stages,
    images,
    allowedActions: buildAllowedActions(record, user)
  };
}
```

手动创建必须拒绝空店铺用户，策划人取 `req.user.id/realName`，状态为 `in_progress`，并在同一事务插入 `selection` 阶段。

- [ ] **Step 6: 注册路由**

路由契约：

```js
router.get('/records', requirePermission('payment.selection.view'), listRecords);
router.get('/records/:id', requireAnyPermission(['payment.selection.view', 'payment.records.view']), getRecord);
router.post('/records', requirePermission('payment.selection.view'), createManualRecord);
router.delete('/records/:id', requirePermission('payment.delete'), softDeleteRecord);
```

`app.js` 注册：

```js
const paymentTrackingRoutes = require('./routes/payment-tracking');
app.use('/api/payment-tracking', paymentTrackingRoutes);
```

- [ ] **Step 7: 运行 API 测试**

Run: `cd standalone-server && npm test -- --runInBand tests/api/payment-tracking.test.js`

Expected: 手动创建、每店铺序号、权限和店铺隔离测试 PASS。

- [ ] **Step 8: 本地提交**

```bash
git add standalone-server/services/payment-tracking standalone-server/routes/payment-tracking standalone-server/app.js standalone-server/tests/api/payment-tracking.test.js
git commit -m "feat: add payment tracking record APIs"
```

## Task 5: 实现阶段保存、推进、结束、恢复和重开

**Files:**
- Create: `standalone-server/services/payment-tracking/workflow.service.js`
- Create: `standalone-server/routes/payment-tracking/workflow-routes.js`
- Modify: `standalone-server/routes/payment-tracking/index.js`
- Modify: `standalone-server/services/payment-tracking/repository.js`
- Modify: `standalone-server/tests/api/payment-tracking.test.js`

- [ ] **Step 1: 写完整流转失败测试**

按以下顺序覆盖真实流程：

```text
selection 保存核心字段 -> advance 成功并创建 preparation
preparation 普通用户修改 paid_enabled -> 403
拥有 payment.manager_review 的用户填 paid_enabled=true + paid_at -> advance 成功
testing potential_status=不符合 -> advance 失败，未来 monitoring 不存在
testing potential_status=符合潜力款标准 -> advance 成功
monitoring abandoned=true 且无原因/时间 -> 保存或推进失败
monitoring 正常 -> breakout
breakout strong_lift_qualified 未选择 -> advance 失败
breakout strong_lift_qualified=false -> summary
summary 保存空字段 -> end 成功并进入 records 列表
planner restore -> 回到 in_progress 和原阶段
非 planner 且无 reopen 权限 -> end/restore 403
reopen 权限用户 -> 重开历史 selection，保存后自动锁回只读
旧 version 保存 -> 409
```

断言详情响应中的 `stages` 永远只包含已进入节点。

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd standalone-server && npm test -- --runInBand tests/api/payment-tracking.test.js`

Expected: FAIL，阶段动作路由不存在。

- [ ] **Step 3: 实现 workflow.service 的动作接口**

```js
module.exports = {
  saveStage,
  advanceStage,
  endProcess,
  restoreProcess,
  reopenStage
};
```

所有动作使用 `executeTransaction`。保存 SQL 必须带乐观锁：

```sql
UPDATE payment_selection_record
SET version = version + 1, update_time = CURRENT_TIMESTAMP
WHERE id = ? AND version = ? AND deleted_at IS NULL
```

受影响行数不是1时抛出 `new AppError(409, '记录已被其他人更新，请刷新后重试')`。

`advanceStage` 必须：加载当前阶段数据 -> `validateAdvance` -> 将当前阶段标记 completed -> `INSERT` 下一阶段 -> 更新 `current_stage`。重复请求发现下一阶段已存在时返回当前详情，不重复插入。

`endProcess` 使用 `deriveEndSnapshot`，无额外原因参数；`restoreProcess` 清空结束快照并保持 `current_stage`；`reopenStage` 只将已完成阶段 `is_reopened=1`，不修改当前阶段。重开阶段保存成功后自动设回0。

- [ ] **Step 4: 注册 workflow 路由**

```js
router.put('/records/:id/stages/:stageCode', requirePermission('payment.selection.view'), saveStage);
router.post('/records/:id/advance', requirePermission('payment.selection.view'), advanceStage);
router.post('/records/:id/end', requirePermission('payment.selection.view'), endProcess);
router.post('/records/:id/restore', requireAnyPermission(['payment.selection.view', 'payment.records.view']), restoreProcess);
router.post('/records/:id/stages/:stageCode/reopen', requirePermission('payment.stage_reopen'), reopenStage);
```

结束与恢复的策划人例外在服务层判断，不能把 `payment.stage_reopen` 直接设为路由必需权限。

- [ ] **Step 5: 运行流转测试**

Run: `cd standalone-server && npm test -- --runInBand tests/unit/payment-tracking-rules.test.js tests/api/payment-tracking.test.js`

Expected: PASS。

- [ ] **Step 6: 本地提交**

```bash
git add standalone-server/services/payment-tracking standalone-server/routes/payment-tracking standalone-server/tests/api/payment-tracking.test.js
git commit -m "feat: add payment tracking workflow actions"
```

## Task 6: 实现独立图片上传、预览和任务图片复制

**Files:**
- Create: `standalone-server/services/payment-tracking/image.service.js`
- Create: `standalone-server/routes/payment-tracking/image-routes.js`
- Modify: `standalone-server/routes/payment-tracking/index.js`
- Modify: `standalone-server/services/payment-tracking/repository.js`
- Create: `standalone-server/tests/api/payment-tracking-images.test.js`

- [ ] **Step 1: 写图片失败测试**

测试使用 `getTmpDir()` 下的 `payment-images`，更新配置后调用 `initStorageConfig(getPool())`。覆盖：

```text
上传2张 product_main -> 两条 DB 记录，sort_order=0/1，文件存在于配置目录
上传 detail_screenshot 和 competitor -> 分类正确
预览同店铺图片 -> 200 image/png
其他店铺预览 -> 403
排序 -> 第一张变化
软删除图片 -> 文件保留但详情不返回
上传非图片 -> 400
任意一次磁盘写入失败 -> DB 和本次已写文件均回滚
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd standalone-server && npm test -- --runInBand tests/api/payment-tracking-images.test.js`

Expected: FAIL，图片路由不存在。

- [ ] **Step 3: 实现安全路径和目录快照**

```js
function resolveStoredImagePath(image) {
  const root = path.resolve(image.storage_root);
  const fullPath = path.resolve(root, image.relative_path);
  if (fullPath !== root && !fullPath.startsWith(root + path.sep)) {
    throw new AppError(400, '非法图片路径');
  }
  return fullPath;
}

function createRelativePath(recordId, originalName) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const extension = path.extname(originalName).toLowerCase();
  return path.join(date, String(recordId), `${uuidv4().replace(/-/g, '')}${extension}`);
}
```

每条图片记录保存当时的 `storage_root` 和相对路径，因此系统配置变更不影响旧图预览。

- [ ] **Step 4: 使用 multer memoryStorage 接收图片**

```js
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: getMaxFileSizeMB() * 1024 * 1024, files: getMaxFileCount() },
  fileFilter: (req, file, callback) => {
    const accepted = file.mimetype.startsWith('image/');
    callback(accepted ? null : new AppError(400, '只允许上传图片'), accepted);
  }
});
```

先校验全部文件，再写磁盘并记下 `writtenPaths`；数据库失败或任意写入失败时逐个删除 `writtenPaths`。

- [ ] **Step 5: 注册图片路由**

```js
router.post('/records/:id/images/:category', requirePermission('payment.selection.view'), upload.array('files'), uploadImages);
router.put('/records/:id/images/order', requirePermission('payment.selection.view'), reorderImages);
router.delete('/records/:id/images/:imageId', requirePermission('payment.selection.view'), softDeleteImage);
router.get('/images/:imageId/preview', optionalAuth, previewImage);
```

`category` 只允许 `product_main`、`detail_screenshot`、`competitor`。

- [ ] **Step 6: 运行图片测试**

Run: `cd standalone-server && npm test -- --runInBand tests/api/payment-tracking-images.test.js`

Expected: PASS。

- [ ] **Step 7: 本地提交**

```bash
git add standalone-server/services/payment-tracking standalone-server/routes/payment-tracking standalone-server/tests/api/payment-tracking-images.test.js
git commit -m "feat: add payment tracking image storage"
```

## Task 7: 实现单条和批量开启打款 API

**Files:**
- Create: `standalone-server/services/payment-tracking/open.service.js`
- Create: `standalone-server/routes/payment-tracking/open-routes.js`
- Modify: `standalone-server/routes/payment-tracking/index.js`
- Modify: `standalone-server/services/payment-tracking/index.js`
- Modify: `standalone-server/tests/api/payment-tracking-images.test.js`

- [ ] **Step 1: 写任务映射和批量跳过失败测试**

在临时 SQLite 中建立：有多张作品图片任务、无图片任务、已开启任务、发布人无店铺任务、源文件丢失任务。断言：

```js
expect(opened).toMatchObject({
  plannerId: publisherId,
  store: 'A店',
  styleNumber: 'STYLE-100',
  sourceTaskId: taskId,
  sourceTaskNo: taskNo
});
expect(opened.images).toHaveLength(2);

expect(batch.body.data).toMatchObject({ successCount: 1, skippedCount: 4 });
expect(batch.body.data.skipped.map(item => item.reason)).toEqual(expect.arrayContaining([
  '已开启打款', '没有作品图片', '任务发布人未绑定店铺', '图片复制失败'
]));
```

重复单条开启返回现有记录，不创建第二条；`payment.open` 不改变 `task_info.status`。

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd standalone-server && npm test -- --runInBand tests/api/payment-tracking-images.test.js`

Expected: FAIL，开启路由不存在。

- [ ] **Step 3: 实现来源查询和图片复制**

来源 SQL 必须只选作品图片：

```sql
SELECT f.*
FROM task_file f
WHERE f.task_id = ?
  AND f.file_type = 'image'
  AND f.file_category NOT IN ('reference', 'reject')
ORDER BY f.create_time ASC, f.id ASC
```

任务查询同时连接发布人：

```sql
SELECT t.id, t.task_no, t.style_number, t.publisher_id,
       COALESCE(u.real_name, t.publisher_name, '') AS planner_name,
       COALESCE(u.store, '') AS publisher_store
FROM task_info t
LEFT JOIN sys_user u ON u.id = t.publisher_id
WHERE t.id = ?
```

复制全部图片成功并插入数据库后才返回。任何失败删除本次目标文件并回滚记录。批量接口逐条调用单条服务，捕获业务错误并继续。

- [ ] **Step 4: 注册开启路由**

```js
router.post('/open/task/:taskId', requirePermission('payment.open'), openFromTask);
router.post('/open/batch', requirePermission('payment.open'), openBatch);
```

批量请求体为 `{ taskIds: number[] }`，响应为：

```js
{
  successCount: 2,
  skippedCount: 1,
  created: [{ taskId: 1, recordId: 10 }],
  skipped: [{ taskId: 2, taskNo: 'T-2', reason: '没有作品图片' }]
}
```

- [ ] **Step 5: 运行后端全模块测试**

Run: `cd standalone-server && npm test -- --runInBand tests/unit/payment-tracking-rules.test.js tests/api/payment-tracking-schema.test.js tests/api/payment-tracking.test.js tests/api/payment-tracking-images.test.js`

Expected: PASS。

- [ ] **Step 6: 本地提交**

```bash
git add standalone-server/services/payment-tracking standalone-server/routes/payment-tracking standalone-server/tests/api/payment-tracking-images.test.js
git commit -m "feat: open payment tracking from reviewed tasks"
```

## Task 8: 添加前端 API、菜单和权限路由

**Files:**
- Create: `src/api/payment-tracking.js`
- Create: `src/config/payment-tracking.js`
- Modify: `src/api/index.js`
- Modify: `src/config/menus.js:6-83`
- Modify: `src/router/index.js:10-265`
- Create: `src/views/payment-tracking/SelectionList.vue`
- Create: `src/views/payment-tracking/RecordsList.vue`
- Create: `src/views/payment-tracking/StageDetail.vue`

- [ ] **Step 1: 创建前端常量**

`src/config/payment-tracking.js` 固定导出：

```js
export const PAYMENT_STAGES = [
  { code: 'selection', label: '信息及选品' },
  { code: 'preparation', label: '第1-6天准备工作' },
  { code: 'testing', label: '第7-11天测款' },
  { code: 'monitoring', label: '第12-18天数据监测' },
  { code: 'breakout', label: '第12-30天打爆' },
  { code: 'summary', label: '总结阶段：生命周期' }
];

export const SELECTION_METHODS = [
  '方式一：通过类目飙升热搜词选品',
  '方式二：搜索分析长尾词',
  '方式三：通过趋势热点选款',
  '方式四: 聊天自检',
  '方式五：跟款',
  '方式六：应季新品',
  '方式七：爆款视觉裂变'
];

export const UNQUALIFIED_ACTIONS = ['设控投产8', '直接关闭', '加入全店推广', '/'];
export const LIFECYCLE_OPTIONS = ['大爆款', '小爆款', '强动销', '次动销', '盈利款', '放弃款'];
```

同文件还导出推广方式、营销活动、让利比例、趋势和是/否选项，值严格使用原 Excel 文本。

- [ ] **Step 2: 创建完整 API 封装**

```js
import request from './http';
import { getServerBase } from '@/utils/server-base';
import { getToken } from '@/utils/auth';

export const listPaymentRecordsApi = params => request.get('/api/payment-tracking/records', { params });
export const getPaymentRecordApi = id => request.get(`/api/payment-tracking/records/${id}`);
export const createPaymentRecordApi = data => request.post('/api/payment-tracking/records', data);
export const savePaymentStageApi = (id, stageCode, data) => request.put(`/api/payment-tracking/records/${id}/stages/${stageCode}`, data);
export const advancePaymentStageApi = (id, data) => request.post(`/api/payment-tracking/records/${id}/advance`, data);
export const endPaymentProcessApi = (id, data) => request.post(`/api/payment-tracking/records/${id}/end`, data);
export const restorePaymentProcessApi = (id, data) => request.post(`/api/payment-tracking/records/${id}/restore`, data);
export const reopenPaymentStageApi = (id, stageCode, data) => request.post(`/api/payment-tracking/records/${id}/stages/${stageCode}/reopen`, data);
export const deletePaymentRecordApi = id => request.delete(`/api/payment-tracking/records/${id}`);
export const openPaymentFromTaskApi = taskId => request.post(`/api/payment-tracking/open/task/${taskId}`);
export const openPaymentBatchApi = taskIds => request.post('/api/payment-tracking/open/batch', { taskIds });

export function getPaymentImageUrl(image) {
  const token = getToken();
  return `${getServerBase()}/api/payment-tracking/images/${image.id}/preview?token=${encodeURIComponent(token || '')}`;
}
```

同时实现并从 `src/api/index.js` 导出：`uploadPaymentImagesApi(id, category, files)`、`sortPaymentImagesApi(id, imageIds)`、`deletePaymentImageApi(id, imageId)`。

- [ ] **Step 3: 注册菜单和路由**

菜单增加：

```js
{ key: 'payment_tracking', label: '打款跟踪' }
{ group: 'payment_tracking', path: '/payment-tracking/selections', icon: 'List', label: '选品收集', permission: 'payment.selection.view' }
{ group: 'payment_tracking', path: '/payment-tracking/records', icon: 'Document', label: '打款记录', permission: 'payment.records.view' }
```

路由增加：

```js
{
  path: 'payment-tracking/selections',
  name: 'PaymentSelectionList',
  component: () => import('@/views/payment-tracking/SelectionList.vue'),
  meta: { title: '选品收集', permission: 'payment.selection.view' }
},
{
  path: 'payment-tracking/records',
  name: 'PaymentRecordsList',
  component: () => import('@/views/payment-tracking/RecordsList.vue'),
  meta: { title: '打款记录', permission: 'payment.records.view' }
},
{
  path: 'payment-tracking/records/:id/stages/:stageCode',
  name: 'PaymentStageDetail',
  component: () => import('@/views/payment-tracking/StageDetail.vue'),
  meta: { title: '选品阶段详情', permissions: ['payment.selection.view', 'payment.records.view'] }
}
```

- [ ] **Step 4: 创建可加载的页面骨架**

三个页面先只渲染 `.payment-page`、标题和 loading/empty 状态，并调用各自 API。不得加入营销式说明文字。

- [ ] **Step 5: 启动 Vite 做编译检查，不执行 build**

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite 启动成功，控制台无 import 或模板编译错误。检查后用 Ctrl+C 停止本次临时进程；已有用户开发服务器不停止。

- [ ] **Step 6: 本地提交**

```bash
git add src/api/payment-tracking.js src/api/index.js src/config/payment-tracking.js src/config/menus.js src/router/index.js src/views/payment-tracking
git commit -m "feat: add payment tracking frontend routes"
```

## Task 9: 实现商品卡、进行中列表和打款记录

**Files:**
- Create: `src/components/payment-tracking/StageTimeline.vue`
- Create: `src/components/payment-tracking/ProductRowCard.vue`
- Modify: `src/views/payment-tracking/SelectionList.vue`
- Modify: `src/views/payment-tracking/RecordsList.vue`

- [ ] **Step 1: 实现只显示已进入节点的时间线**

组件契约：

```js
const props = defineProps({
  stages: { type: Array, default: () => [] },
  currentStage: { type: String, default: '' },
  endStage: { type: String, default: '' },
  readonly: Boolean
});
const emit = defineEmits(['select']);
```

模板只遍历 `props.stages`，禁止从 `PAYMENT_STAGES` 补齐未来节点。完成节点使用成功色，当前节点使用主色，结束节点使用警告色；节点按钮有稳定宽度，不因标签变化造成卡片高度跳动。

- [ ] **Step 2: 实现单行商品卡**

卡片固定布局：72px封面、核心信息列、阶段时间线、操作列。进行中卡显示“继续填写”；归档卡在时间线前直接显示：

```vue
<div v-if="record.processStatus === 'ended'" class="end-summary">
  <strong>结束于：{{ stageLabel(record.endStage) }}</strong>
  <span>{{ record.endReason }}</span>
</div>
```

点击图片打开全量产品主图预览，点击已进入节点跳转对应详情路由。

- [ ] **Step 3: 完成两个列表页**

`SelectionList.vue` 请求 `status=in_progress`；`RecordsList.vue` 请求 `status=ended`。两个页面共享筛选参数：`keyword`、`plannerId`、`stageCode`、`page`、`pageSize`。超级管理员额外显示店铺筛选，普通用户不发送任意店铺值。

进行中页提供“新增记录”；打款记录页在 `allowedActions.restore` 时显示恢复按钮。删除按钮只在 `allowedActions.delete` 时显示并二次确认。

- [ ] **Step 4: 本地浏览器检查**

使用浏览器 API mock 显示至少三种记录：信息及选品、测款进行中、测款未达标结束。确认第二条只显示已进入的3个节点，结束记录不显示后续阶段。

- [ ] **Step 5: 本地提交**

```bash
git add src/components/payment-tracking/StageTimeline.vue src/components/payment-tracking/ProductRowCard.vue src/views/payment-tracking/SelectionList.vue src/views/payment-tracking/RecordsList.vue
git commit -m "feat: add payment tracking list timelines"
```

## Task 10: 实现阶段详情、信息及选品和前两阶段

**Files:**
- Create: `src/components/payment-tracking/ImageGallery.vue`
- Create: `src/views/payment-tracking/forms/SelectionForm.vue`
- Create: `src/views/payment-tracking/forms/PreparationForm.vue`
- Create: `src/views/payment-tracking/forms/TestingForm.vue`
- Modify: `src/views/payment-tracking/StageDetail.vue`

- [ ] **Step 1: 完成 StageDetail 数据流**

加载详情后验证路由 `stageCode` 存在于后端返回的 `stages`；不存在时提示“该阶段尚未进入”并返回列表。根据阶段动态映射组件：

```js
const FORM_COMPONENTS = {
  selection: SelectionForm,
  preparation: PreparationForm,
  testing: TestingForm,
  monitoring: MonitoringForm,
  breakout: BreakoutForm,
  summary: SummaryForm
};
```

页面保存时提交 `{ version, data }`；成功后用响应覆盖本地详情。进入下一阶段、结束和历史重开均使用 `allowedActions` 控制并二次确认。

- [ ] **Step 2: 实现 ImageGallery**

支持多图上传、排序、软删除、第一张封面和 Element Plus 全屏预览。`readonly` 时隐藏上传、排序和删除。产品主图、说明截图、竞品主图分别传入固定 category。

- [ ] **Step 3: 实现 SelectionForm**

字段包括选品日期、货号、成本、售价、毛利、策划人、产品主图、产品 ID、选品方式、详细说明、说明截图、竞品主图、通过并设计主图、SKU 数是否不超过200、上架日期和上架类目。数值输入使用 `el-input-number`，日期使用 `el-date-picker`，选品方式使用下拉，`通过并设计主图`使用 checkbox，SKU使用是/否单选。毛利只读显示：

```js
const grossMarginText = computed(() => {
  if (props.model.grossMargin === null || props.model.grossMargin === undefined) return '-';
  return `${(props.model.grossMargin * 100).toFixed(2)}%`;
});
```

说明区同时提供多行文字和说明截图，两者互不依赖。

- [ ] **Step 4: 实现 PreparationForm**

评价数量只允许非负整数；报名成功为是/否；只有 `allowedActions.managerReview` 时可修改开启付费和付费时间。开启付费为是时付费时间必填。

- [ ] **Step 5: 实现 TestingForm**

页面显示两个同级、始终展开的大项。搜索访客占比只读：

```js
const searchShareText = computed(() => {
  const share = props.model.searchVisitorShare;
  return share === null || share === undefined ? '-' : `${(share * 100).toFixed(2)}%`;
});
```

选择“不符合”后显示“不符合后续操作”；选择符合后才显示可用的“进入下一阶段”。两个推广区域不存在互相解锁逻辑。

- [ ] **Step 6: 启动本地前后端联调，不执行 build**

Run: `npm run dev:full`

Expected: 使用本地 SQLite 登录后能手动创建、上传图片、保存三个阶段并按规则推进。检查完成后保留用户原有开发服务状态，不启动第二套长期服务。

- [ ] **Step 7: 本地提交**

```bash
git add src/components/payment-tracking/ImageGallery.vue src/views/payment-tracking/StageDetail.vue src/views/payment-tracking/forms/SelectionForm.vue src/views/payment-tracking/forms/PreparationForm.vue src/views/payment-tracking/forms/TestingForm.vue
git commit -m "feat: add payment tracking core stage forms"
```

## Task 11: 实现后续阶段和动态推广调整

**Files:**
- Create: `src/components/payment-tracking/PromotionAdjustments.vue`
- Create: `src/views/payment-tracking/forms/MonitoringForm.vue`
- Create: `src/views/payment-tracking/forms/BreakoutForm.vue`
- Create: `src/views/payment-tracking/forms/SummaryForm.vue`

- [ ] **Step 1: 实现 PromotionAdjustments**

组件通过 `v-model` 接收数组，每条记录字段固定为：`reason`、`adjustedAt`、`feeRatio7d`、`payers7d`、`totalBudget`、`detailText`、`feedbackText`。新增时追加：

```js
{
  sortOrder: modelValue.length,
  reason: '',
  adjustedAt: null,
  feeRatio7d: null,
  payers7d: null,
  totalBudget: null,
  detailText: '',
  feedbackText: ''
}
```

记录使用折叠面板，标题显示“第N次调整 + 日期 + 原因”，允许无限新增和删除未保存项。

- [ ] **Step 2: 实现 MonitoringForm**

字段包括改内销件数、补评价条数、标题优化时间、问大家数量、详情页优化时间、素材是否精选、SKU 优化时间、营销活动名称、让利比例、20天内新品运营快速冲顶是否完成、潜力款后放弃、放弃原因、放弃时间和推广调整。营销活动选项：`超级立减`、`营销托管`、`新客礼金`；让利比例：`5%`、`10%`、`15%`、`20%`、`25%`、`25%以上`。

选择潜力款后放弃时显示并要求放弃原因、放弃时间；此时隐藏“进入下一阶段”，保留“结束流程”。

- [ ] **Step 3: 实现 BreakoutForm**

常规字段包括补坑产第一天、第二天、第三天、进秒杀时间、进超级打爆或极速爆单时间、商品速爆时间、是否符合强拉升标准。选择是时展开搜索涨幅趋势、付款人数趋势、当前预算、当前费比（7天）、当前付款人数（7天）、调整日期、总预算、投产/调整细节和3-5天后数据反馈；趋势选项为`持续上升`、`保持平稳`、`持续下跌`。选择否时不渲染强拉升字段。

- [ ] **Step 4: 实现 SummaryForm**

`是否打爆`、`链接维护`、`款式定义`、`总结`和`备注`全部选填。链接维护与款式定义分别使用 `LIFECYCLE_OPTIONS`，不能绑定到同一个 model 字段。

- [ ] **Step 5: 联调终止分支**

验证测款不符合、监测阶段放弃、任意阶段主动结束、总结完成四种结束类型；打款记录卡显示阶段和已有原因，未进入节点不出现。

- [ ] **Step 6: 本地提交**

```bash
git add src/components/payment-tracking/PromotionAdjustments.vue src/views/payment-tracking/forms/MonitoringForm.vue src/views/payment-tracking/forms/BreakoutForm.vue src/views/payment-tracking/forms/SummaryForm.vue
git commit -m "feat: add payment tracking later stage forms"
```

## Task 12: 在作品审核接入单条和批量开启

**Files:**
- Modify: `src/views/shared/Review.vue:9-15,100-120,339-580`
- Modify: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: 写审核按钮前端失败测试**

Playwright mock 一个有2张作品图片任务、一个无图片任务、一个已开启任务。断言：

```js
await expect(page.getByRole('button', { name: /批量开启打款/ })).toBeVisible();
await expect(page.getByRole('button', { name: '开启打款' }).first()).toBeEnabled();
await expect(page.getByRole('button', { name: '开启打款' }).nth(1)).toBeDisabled();
```

无 `payment.open` 权限时两个入口均不可见。批量结果提示包含“成功1条，跳过2条”。

- [ ] **Step 2: 添加权限判断和 API import**

```js
import { hasPermission } from '@/utils/permissions';
import { openPaymentFromTaskApi, openPaymentBatchApi } from '@/api';

const canOpenPayment = computed(() => taskGroup.value === 'design' && hasPermission('payment.open'));
const paymentOpeningIds = ref(new Set());
const batchPaymentOpening = ref(false);
```

只有运营美工作品审核 `taskGroup === 'design'` 显示，不在客服或运营助理审核页出现。

- [ ] **Step 3: 添加单条按钮**

按钮位于操作列：

```vue
<el-button
  v-if="canOpenPayment"
  type="warning"
  link
  size="small"
  :disabled="!getWorkImages(row.files).length || row.payment_tracking_opened"
  :loading="paymentOpeningIds.has(row.id)"
  @click="handleOpenPayment(row)"
>开启打款</el-button>
```

`handleOpenPayment` 只调用开启接口，不调用审核接口；成功后刷新当前列表以获得 `payment_tracking_opened` 标记。

- [ ] **Step 4: 添加批量按钮**

按钮紧邻“批量审核通过”：

```vue
<el-button
  v-if="canOpenPayment"
  type="warning"
  :disabled="selectedRows.length === 0"
  :loading="batchPaymentOpening"
  @click="handleBatchOpenPayment"
>批量开启打款 ({{ selectedRows.length }})</el-button>
```

结果弹窗列出成功数和跳过项，不因一条失败中断其余任务。

- [ ] **Step 5: 运行定向 Playwright 测试**

Run: `npx playwright test tests/payment-tracking/payment-tracking.spec.js --config=playwright.payment-tracking.config.js --grep "作品审核开启打款"`

Expected: PASS。

- [ ] **Step 6: 本地提交**

```bash
git add src/views/shared/Review.vue tests/payment-tracking/payment-tracking.spec.js
git commit -m "feat: add payment opening actions to review"
```

## Task 13: 完成端到端页面验证和响应式检查

**Files:**
- Create: `playwright.payment-tracking.config.js`
- Create: `tests/payment-tracking/payment-tracking.spec.js`
- Modify: `package.json`

- [ ] **Step 1: 创建专用 Playwright 配置**

```js
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PAYMENT_TRACKING_TEST_PORT || 5175);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/payment-tracking',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  webServer: {
    command: `cmd /c "set VITE_FORCE_LOCAL_API=1&& set VITE_DEV_PORT=${PORT}&& npm run dev -- --host 127.0.0.1"`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } } },
    { name: 'compact-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } }
  ]
});
```

在 `package.json` 增加：

```json
"test:payment-tracking": "playwright test --config=playwright.payment-tracking.config.js"
```

- [ ] **Step 2: 覆盖进行中与打款记录页面**

Mock 登录用户、权限和全部 payment-tracking API。测试：

```text
侧边栏出现独立“选品收集”和“打款记录”
选品收集只显示进行中记录
商品卡显示第一张封面、货号、毛利、当前阶段
时间线只显示后端返回的已进入节点
直接访问未来 stageCode 被提示并返回
归档卡直接显示结束阶段和已有原因
恢复按钮把记录移回进行中
```

- [ ] **Step 3: 覆盖六个阶段表单**

逐阶段 mock 保存和推进响应，断言所有必填校验、条件显示、只读历史节点、店长审核权限、动态调整、强拉升分支和总结选填行为。

- [ ] **Step 4: 运行 E2E 并保存失败证据**

Run: `npm run test:payment-tracking`

Expected: desktop 和 compact-desktop 全部 PASS；失败时查看 Playwright trace，不通过扩大 timeout 掩盖问题。

- [ ] **Step 5: 截图检查关键页面**

使用 Playwright 截图检查1600x900和1280x720：进行中列表、打款记录、信息及选品、第7-11天、第12-18天。确认无横向页面溢出、文字遮挡、按钮换行错位、卡片嵌套卡片或未来节点泄露。

- [ ] **Step 6: 本地提交**

```bash
git add playwright.payment-tracking.config.js tests/payment-tracking/payment-tracking.spec.js package.json
git commit -m "test: cover payment tracking user flows"
```

## Task 14: 完整本地回归与交付检查

**Files:**
- Verify only; do not modify unrelated files.

- [ ] **Step 1: 运行后端全量测试**

Run: `cd standalone-server && npm test -- --runInBand`

Expected: 全部 Jest 测试 PASS，没有测试连接 MySQL 或生产数据库。

- [ ] **Step 2: 运行现有任务页面测试**

Run: `npm run test:task-pages`

Expected: 现有任务页面 Playwright 测试 PASS。

- [ ] **Step 3: 运行打款跟踪测试**

Run: `npm run test:payment-tracking`

Expected: 两个桌面视口全部 PASS。

- [ ] **Step 4: 检查数据库迁移幂等性**

使用测试环境连续两次创建应用：

Run: `cd standalone-server && npm test -- --runInBand tests/api/payment-tracking-schema.test.js`

Expected: 第二次初始化不丢失插入的测试记录，不报重复表、重复列或重复索引错误。

- [ ] **Step 5: 检查工作区和提交范围**

Run: `git status --short`

Expected: 用户原有 `src/views/Layout.vue`、`vite.config.js`、`.local-dev-upload/` 和 `.superpowers/` 仍未被本功能提交；不存在 `dist/`、`release/` 或打包产物变化。

- [ ] **Step 6: 最终本地提交**

仅当回归中产生必要修复时提交：

用 `git diff --name-only` 确认回归修复文件均属于本功能后，逐个显式传给 `git add`，再执行：

```bash
git commit -m "fix: complete payment tracking regression fixes"
```

禁止执行 `git push`。交付时报告测试命令、结果、本地开发 URL、数据库路径和未执行打包。
