# 基础美工仪表盘与统计改进实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 9 项已确认需求：客服/基础美工全量任务状态与搜索、基础美工仪表盘统计、待做任务筛选、个人图片卡片、分组批量下载，以及运营任务参考图 multipart 上传修复。

**Architecture:** 复用现有任务查询、统计和文件分类边界。DAO 负责数据库筛选，服务层负责时间边界与聚合，Vue 页面只负责分组展示和交互；不新增表、不改变任务状态机或权限模型。

**Tech Stack:** Vue 3、Element Plus、Axios、ECharts、Express、Multer、MySQL/SQLite 双引擎、Jest/Playwright。

---

### Task 1: 全量任务客服分组状态与搜索

**Files:**
- Modify: `src/views/admin/AllTasks.vue`
- Modify: `standalone-server/dao/task.dao.js:665-706`
- Test: `standalone-server/tests/unit/task-query.test.js` (extend existing query coverage if present)

- [ ] **Step 1: Add group-specific UI labels and filters**

  In `AllTasks.vue`, make the placeholder return `搜索编号/标题/款号/旺旺ID` for `taskGroup === 'cs'`, keep the design placeholder with 款号, and keep the operator placeholder with 编号/标题. Render `待上传原图` only for the CS group. Make `statusLabel` map `doing` to `审核中` and `rejected` to `修改中` only for the CS group; use the existing `STATUS_MAP` for other groups.

- [ ] **Step 2: Extend the CS query predicate**

  In `queryAllTasks`, keep the design predicate unchanged, add a CS branch with `title`, `task_no`, `style_number`, and `wangwang_id`, and retain the existing fallback predicate for operator/other groups.

- [ ] **Step 3: Run the focused query checks**

  Run `npm --prefix standalone-server test -- --runInBand tests/unit/task-query.test.js` when the existing file is available; otherwise run the existing task DAO/service unit test command and record the result.

### Task 2: 基础美工待做任务状态筛选

**Files:**
- Modify: `src/views/basic/MyTasks.vue`
- Modify: `src/router/index.js` only if the fixed-status metadata prevents the selector from rendering

- [ ] **Step 1: Show the selector on the todo route**

  Replace the `v-if="!fixedStatus"` guard with a guard that permits the basic todo route. Preserve the existing default query `accepted,rejected,pending_original` when no selection is made.

- [ ] **Step 2: Apply selected status without changing task flow**

  When the selector has a value, pass only that value to `getMyAcceptedApi`; when cleared on the todo route, restore `accepted,rejected,pending_original`. Keep labels `已接单`, `审核中`, `修改中`, `待上传原图`, and `已完成`.

- [ ] **Step 3: Verify route behavior**

  Run the targeted task-page test suite or a Playwright smoke check that opens `/basic/tasks/todo`, confirms the selector is visible, and confirms clearing it restores the three-status request.

### Task 3: 图片统计 DAO 与服务层

**Files:**
- Modify: `standalone-server/dao/task.dao.js`
- Modify: `standalone-server/services/task.service.js`

- [ ] **Step 1: Add a date-range file query**

  Add and export `getBasicDesignerFileStats({ start, end, userId })` using:

  ```sql
  SELECT tf.uploader_id, u.real_name AS name,
         tf.file_category, tf.create_time
  FROM task_file tf
  INNER JOIN sys_user u ON u.id = tf.uploader_id
  WHERE u.role = 'basic_designer'
    AND u.status = 1
    AND tf.file_category IN ('work', 'original')
    AND tf.create_time >= ? AND tf.create_time < ?
  ```

  Add `uploader_id = ?` only when `userId` is supplied. Do not filter on `file_type`.

- [ ] **Step 2: Add service aggregators**

  Add helpers that aggregate rows by user/category and by user/date. Return:

  ```js
  basicDesignerImageMonthlyStats: {
    current: [{ id, name, effect_count, original_count }],
    last: [{ id, name, effect_count, original_count }]
  },
  basicDesignerImageDailyStats: [{
    id, user_id, name,
    daily_stats: [{ day, effect_count, original_count }]
  }]
  ```

  Use local calendar boundaries (`new Date(year, month, day)`) and format SQL parameters as local `YYYY-MM-DD HH:mm:ss` strings so SQLite and MySQL behave consistently.

- [ ] **Step 3: Add personal month counters**

  In the `basic_designer` branch of `getMyStats`, query the current-month range with `userId` and return `current_month_effect_images` and `current_month_original_images`. Keep the existing summary fields so other code remains compatible.

- [ ] **Step 4: Include dashboard fields in permission filtering**

  Add both monthly and daily image-stat fields to the CS branch of `filterAdminDetailStatsByPermission`; do not expose them from design/operator branches.

### Task 4: 基础美工仪表盘展示

**Files:**
- Modify: `src/views/admin/Dashboard.vue`

- [ ] **Step 1: Add the 修改中 card**

  Define a `basicStatCards` array copied from the existing card definitions with `{ key: 'rejected_count', label: '修改中' }` inserted between `doing_count` and `finished_count`. Use it only in the CS/basic section; leave design cards unchanged.

- [ ] **Step 2: Add monthly effect/original bar charts**

  Add two chart cards and refs under the CS/basic section. Build grouped bar options from `detailStats.basicDesignerImageMonthlyStats.current` and `.last`, with two series named `效果图` and `原图` and distinct colors. Dispose the chart instances alongside existing charts and resize them with the current resize handler.

- [ ] **Step 3: Add daily image table**

  Build `basicDesignerImageDailyData` from the returned daily structure. Render a table matching `basicDesignerDailyData`, with each day cell displaying `effect_count / original_count`. Keep the current task daily-stat table and click handlers unchanged.

- [ ] **Step 4: Verify empty states and data updates**

  Ensure charts do not throw when there are no users/files and reload with the existing one-minute refresh. Run the dashboard unit/component checks if present and a Playwright page load check.

### Task 5: 基础美工个人统计卡片

**Files:**
- Modify: `src/views/basic/Stats.vue`

- [ ] **Step 1: Replace only the two card definitions**

  Change `total_score` to `{ key: 'current_month_effect_images', label: '当月效果图' }` and `total` to `{ key: 'current_month_original_images', label: '当月原图' }`. Keep all other cards and `StatsPanel` unchanged.

- [ ] **Step 2: Verify personal stats**

  Call `/api/task/stats/my` with a local basic-designer token and confirm the two fields are numeric; load `/basic/stats` and confirm the old labels are absent.

### Task 6: 全量任务按分组下载文件

**Files:**
- Modify: `src/views/admin/AllTasks.vue`
- Modify: `src/api/task.js`
- Modify: `standalone-server/routes/task.js`
- Test: `standalone-server/tests/api/task.test.js` (add focused batch-download cases)

- [ ] **Step 1: Add a group-specific download menu**

  Replace the direct download action with a small menu/popover. For CS expose `reference/style/work/original`; for design expose `reference/work`; for operator keep the design pair only when the route represents operator/design tasks. A blank choice calls the existing download behavior.

- [ ] **Step 2: Pass an optional category parameter**

  Extend `batchDownloadFilesApi` to accept `fileCategories` (comma-separated) while omitting it for the default path. Keep task IDs and response type unchanged.

- [ ] **Step 3: Validate category sets on the server**

  Parse and de-duplicate `fileCategories`. Allow CS `reference/style/work/original`, and design/operator `reference/work`; reject values outside the current task group with HTTP 400. Add `AND f.file_category IN (...)` only when a valid non-empty set is supplied.

- [ ] **Step 4: Preserve archive names and folders**

  Keep the current ZIP entry naming and folder behavior. A filtered selection with no existing files returns the current no-downloadable-files response.

- [ ] **Step 5: Test default and filtered downloads**

  Add API assertions for: blank categories include all files; CS `style` includes only style files; design `work` excludes reference files; invalid CS/design combinations return 400.

### Task 7: 修复参考图 multipart boundary

**Files:**
- Modify: `src/api/task.js`
- Preserve: existing `src/api/http.js` interceptor behavior

- [ ] **Step 1: Remove the manual multipart header from `uploadFilesApi`**

  Keep the `FormData` construction and all fields unchanged, but remove `headers: { 'Content-Type': 'multipart/form-data' }` from that request. Let Axios/browser generate the boundary. Do not change timeout, progress callback, or API path.

- [ ] **Step 2: Exercise the original failure path**

  In a local browser request, publish a design/operator task with one reference file through `uploadFilesApi`. Assert the request header matches `multipart/form-data; boundary=...` and the response is `{ code: 0 }`.

- [ ] **Step 3: Confirm no parser errors**

  Check the local server error log after the request and confirm no new `Malformed part header` or `Multipart: Boundary not found` entry is produced.

### Task 8: 综合验证与本地提交

**Files:**
- Verify only; do not modify unrelated user files.

- [ ] **Step 1: Run syntax and focused tests**

  Run:

  ```powershell
  node --check standalone-server/dao/task.dao.js
  node --check standalone-server/services/task.service.js
  node --check standalone-server/routes/task.js
  npm test -- --runInBand tests/api/sidebar-badges.test.js
  npm --prefix standalone-server test -- --runInBand tests/api/task.test.js
  git diff --check
  ```

- [ ] **Step 2: Verify local-only boundaries**

  Confirm the backend health endpoint is `http://127.0.0.1:18632`, the Vite page is `http://127.0.0.1:18634`, and no production MySQL connection, build, package, or remote push was run.

- [ ] **Step 3: Review the diff**

  Inspect only the intended files and preserve all pre-existing user modifications. Commit the implementation changes locally with a focused message; do not push.
