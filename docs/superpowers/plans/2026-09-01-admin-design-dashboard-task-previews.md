# Admin Design Dashboard And Task Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the advanced designer dashboard and add fast reference/work image previews plus style-number search to the design all-tasks page.

**Architecture:** Keep dashboard changes presentation-only. Extend the existing all-task DAO query with design-only style-number matching and one existing batched file lookup per page, then reuse the shared file helpers and drag bridge in the current all-task table.

**Tech Stack:** Vue 3, Element Plus, ECharts, Node.js, Express, SQLite/MySQL-compatible SQL, Jest, Supertest, Playwright

---

## File Structure

- Modify `src/views/admin/Dashboard.vue`: rename/remove design statistic cards and remove the retired efficiency chart and its lifecycle code.
- Modify `src/views/admin/AllTasks.vue`: add the design-only search hint and two image preview columns using existing preview and drag behavior. Preserve all pre-existing uncommitted detail-layout changes in this file.
- Modify `standalone-server/dao/task.dao.js`: add design-only `style_number` matching and batch-attach files to all-task list rows.
- Modify `standalone-server/tests/api/task.test.js`: verify style-number search and file arrays on the all-task endpoint.
- Modify `tests/task-pages/task-page-features.spec.js`: verify dashboard card/chart visibility and design all-task preview/drag behavior. Preserve unrelated existing test changes.

### Task 1: Lock The All-Task API Contract

**Files:**
- Modify: `standalone-server/tests/api/task.test.js`
- Modify: `standalone-server/dao/task.dao.js:535-563`

- [ ] **Step 1: Add a failing API regression test**

Add a query test that creates a uniquely styled design task, inserts one reference image and one work image, and queries by a partial style number:

```js
it('design all-task search matches style number and returns row files', async () => {
  const suffix = Date.now();
  const styleNumber = `ALL-STYLE-${suffix}`;
  const created = await request(app)
    .post('/api/task/create')
    .set('Authorization', `Bearer ${operatorToken}`)
    .send({
      title: `all task preview ${suffix}`,
      taskGroup: 'design',
      priority: 1,
      designerId,
      styleNumber
    });
  expect(created.body.code).toBe(0);
  const taskId = created.body.data.id;
  const { execute } = require('../../config/database');

  try {
    for (const file of [
      { name: `reference-${suffix}.png`, category: 'reference' },
      { name: `work-${suffix}.png`, category: 'work' }
    ]) {
      await execute(
        `INSERT INTO task_file
           (task_id, file_name, file_path, file_size, file_type, mime_type, uploader_id, file_category)
         VALUES (?, ?, ?, 1, 'image', 'image/png', ?, ?)`,
        [taskId, file.name, `design/images/${file.name}`, operatorId, file.category]
      );
    }

    const result = await request(app)
      .get(`/api/task/all?taskGroup=design&keyword=${encodeURIComponent(`STYLE-${suffix}`)}&pageSize=20`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(result.body.code).toBe(0);
    const row = result.body.data.list.find(item => Number(item.id) === Number(taskId));
    expect(row).toMatchObject({ style_number: styleNumber });
    expect(row.files).toEqual(expect.arrayContaining([
      expect.objectContaining({ file_category: 'reference', file_type: 'image' }),
      expect.objectContaining({ file_category: 'work', file_type: 'image' })
    ]));
  } finally {
    await request(app)
      .post('/api/task/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ taskId });
  }
});
```

- [ ] **Step 2: Run the test and verify the red phase**

Run:

```powershell
cd standalone-server
npx jest tests/api/task.test.js --runInBand
```

Expected: the new test fails because `queryAllTasks` only matches title/task number and does not attach `files`.

- [ ] **Step 3: Add design-only style-number matching**

Replace the keyword clause in `queryAllTasks` with:

```js
if (keyword) {
  const like = `%${keyword}%`;
  if (taskGroup === 'design') {
    where += ' AND (t.title LIKE ? OR t.task_no LIKE ? OR t.style_number LIKE ?)';
    params.push(like, like, like);
  } else {
    where += ' AND (t.title LIKE ? OR t.task_no LIKE ?)';
    params.push(like, like);
  }
}
```

- [ ] **Step 4: Batch-attach files to the paginated rows**

Keep `paginate` unchanged. In `queryAllTasks`, collect its result and reuse the existing helper:

```js
const result = await paginate({
  countSql: `SELECT COUNT(*) as total FROM task_info t ${where}`,
  countParams: params,
  dataSql: `SELECT ${TASK_SELECT} FROM task_info t ${TASK_JOIN} ${where} ${buildTaskOrderBy(sortField, sortOrder, 't.create_time DESC')} LIMIT ? OFFSET ?`,
  dataParams: [...params, pageSize, offset],
  page,
  pageSize
});
result.list = await attachFilesToTasksForList(result.list);
return result;
```

- [ ] **Step 5: Run the API test and verify green**

Run:

```powershell
cd standalone-server
npx jest tests/api/task.test.js --runInBand
```

Expected: all tests in `task.test.js` pass, including the new contract.

### Task 2: Lock The Frontend Display Contract

**Files:**
- Modify: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: Add a failing dashboard regression test**

Register exact dashboard API mocks inside the test, log in as admin, and verify the design dashboard labels:

```js
test('advanced designer dashboard shows the simplified cards and no efficiency rank', async ({ page }) => {
  await page.route('**/api/task/stats/dashboard', route => json(route, {
    code: 0,
    data: {
      designStats: { total: 6, wait_count: 0, accepted_count: 1, doing_count: 5, finished_count: 0, rejected_count: 2 },
      operatorStats: {},
      csStats: {},
      designerCurrentMonthRank: [],
      designerLastMonthRank: [],
      designerRank: [{ name: 'designer', finished_count: 1, rejected_count: 1 }]
    }
  }));
  await page.route('**/api/task/stats/admin/detail', route => json(route, { code: 0, data: {} }));
  await loginAs(page, users.admin);
  await page.goto('/#/dashboard');

  await expect(page.getByText('待审核', { exact: true })).toBeVisible();
  await expect(page.getByText('作图中', { exact: true })).toHaveCount(0);
  await expect(page.getByText('已驳回', { exact: true })).toHaveCount(0);
  await expect(page.getByText('美工完成效率排行', { exact: true })).toHaveCount(0);
});
```

- [ ] **Step 2: Add a failing design all-task preview test**

Use the existing mocked design row and file array:

```js
test('design all tasks expose draggable reference and work previews', async ({ page }) => {
  await loginAs(page, users.admin);
  await page.goto('/#/admin/tasks/design');

  await expect(page.getByPlaceholder('搜索编号/标题/款号')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '参考图' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: '作品预览' })).toBeVisible();

  const row = page.locator('.el-table__body tr').filter({ hasText: 'T-ACCEPTED' });
  const previews = row.locator('[draggable="true"]');
  await expect(previews).toHaveCount(2);
  expectBrowserDragData(await dispatchDragStart(previews.first()));

  await row.locator('.el-image img').first().click();
  await expect(page.locator('.el-image-viewer__wrapper')).toBeVisible();
});
```

- [ ] **Step 3: Run only the new tests and verify red**

Run:

```powershell
npx playwright test --config=playwright.task-pages.config.js -g "advanced designer dashboard|design all tasks expose"
```

Expected: both tests fail before the dashboard and table changes.

### Task 3: Simplify The Advanced Designer Dashboard

**Files:**
- Modify: `src/views/admin/Dashboard.vue:47-57, 413-440, 455-462, 846-875, 905-908`

- [ ] **Step 1: Update the design statistic cards**

Keep the existing field mapping but change the displayed collection to:

```js
const statCards = [
  { key: 'total', label: '任务总量', color: '#4361ee' },
  { key: 'wait_count', label: '待接单', color: '#7b8ba3' },
  { key: 'accepted_count', label: '已接单', color: '#f7931a' },
  { key: 'doing_count', label: '待审核', color: '#4361ee' },
  { key: 'finished_count', label: '已完成', color: '#2ec4b6' }
]
```

- [ ] **Step 2: Remove the retired efficiency chart cleanly**

Delete the “美工完成效率排行” template row, `designerChartRef`, `designerChart`, its `initCharts` block, and its entries in `disposeCharts` and `handleResize`. Do not alter any other chart or API call.

- [ ] **Step 3: Run the dashboard regression test**

Run:

```powershell
npx playwright test --config=playwright.task-pages.config.js -g "advanced designer dashboard"
```

Expected: the dashboard test passes.

### Task 4: Add The Design All-Task Preview Columns

**Files:**
- Modify: `src/views/admin/AllTasks.vue:12, 59-63, 99-152`

- [ ] **Step 1: Use the design-specific search placeholder**

Bind the input to a computed placeholder:

```vue
<el-input v-model="filter.keyword" :placeholder="filterPlaceholder" clearable style="width:200px;" @clear="loadData" @keyup.enter="loadData" />
```

```js
const filterPlaceholder = computed(() => taskGroup.value === 'design'
  ? '搜索编号/标题/款号'
  : '搜索编号/标题')
```

- [ ] **Step 2: Reuse the shared file helpers**

Import and initialize the established helper without replacing existing detail code:

```js
import { useFileHelpers } from '@/composables/useFileHelpers'

const { getRefImages, getFirstImage, getRefImageSrcList, getImageSrcList } = useFileHelpers()
```

- [ ] **Step 3: Add the two design-only columns**

Insert after the designer column and before release time. Both columns show only images:

```vue
<el-table-column v-if="taskGroup === 'design'" label="参考图" width="120" align="center">
  <template #default="{ row }">
    <div
      v-if="getRefImages(row.files).length"
      draggable="true"
      @dragstart="setupFileDrag($event, getRefImages(row.files)[0])"
      @mouseenter="preloadFilesForDrag(getRefImages(row.files))"
      style="display:inline-block;"
    >
      <el-image
        :src="getFileUrl(getRefImages(row.files)[0])"
        fit="cover"
        :preview-src-list="getRefImageSrcList(row.files)"
        preview-teleported
        style="width:48px;height:48px;border-radius:6px;cursor:pointer;border:1px solid #e4e7ed;"
      />
    </div>
    <span v-else class="empty-image">-</span>
  </template>
</el-table-column>
<el-table-column v-if="taskGroup === 'design'" label="作品预览" width="120" align="center">
  <template #default="{ row }">
    <div
      v-if="getFirstImage(row.files)"
      draggable="true"
      @dragstart="setupFileDrag($event, getFirstImage(row.files))"
      @mouseenter="preloadFilesForDrag(row.files || [])"
      style="display:inline-block;"
    >
      <el-image
        :src="getFileUrl(getFirstImage(row.files))"
        fit="cover"
        :preview-src-list="getImageSrcList(row.files)"
        :initial-index="0"
        preview-teleported
        style="width:48px;height:48px;border-radius:6px;cursor:pointer;border:1px solid #e4e7ed;"
      />
    </div>
    <span v-else class="empty-image">-</span>
  </template>
</el-table-column>
```

- [ ] **Step 4: Run the table regression test**

Run:

```powershell
npx playwright test --config=playwright.task-pages.config.js -g "design all tasks expose"
```

Expected: the placeholder, columns, preview viewer, and browser drag data checks pass.

### Task 5: Verify And Commit Locally

**Files:**
- Verify all files listed above.

- [ ] **Step 1: Run the complete backend suite**

```powershell
cd standalone-server
npm test -- --runInBand
```

Expected: all backend test suites pass.

- [ ] **Step 2: Run the complete task-page suite**

```powershell
npm run test:task-pages
```

Expected: all Playwright task-page tests pass.

- [ ] **Step 3: Check exact diffs without building**

```powershell
git diff --check -- src/views/admin/Dashboard.vue src/views/admin/AllTasks.vue standalone-server/dao/task.dao.js standalone-server/tests/api/task.test.js tests/task-pages/task-page-features.spec.js
git diff --stat -- src/views/admin/Dashboard.vue src/views/admin/AllTasks.vue standalone-server/dao/task.dao.js standalone-server/tests/api/task.test.js tests/task-pages/task-page-features.spec.js
```

Expected: no whitespace errors. Do not run `npm run build`, Electron packaging, or any remote Git command.

- [ ] **Step 4: Commit only this feature's hunks**

`Dashboard.vue`, `task.dao.js`, and `task.test.js` can be staged normally if clean before implementation. `AllTasks.vue` and `task-page-features.spec.js` already contain unrelated work, so stage only the new search/preview/test hunks and verify the staged diff before committing:

```powershell
git add -- src/views/admin/Dashboard.vue standalone-server/dao/task.dao.js standalone-server/tests/api/task.test.js
git add -p -- src/views/admin/AllTasks.vue tests/task-pages/task-page-features.spec.js
git diff --cached --check
git diff --cached --name-only
git diff --cached
git commit -m "feat: add admin design task previews"
```

Expected: the staged diff contains this feature only and preserves all prior uncommitted frontend changes in the working tree.

- [ ] **Step 5: Restart and verify the isolated local services**

Restart only the backend on `127.0.0.1:18632` with `USE_MYSQL=0`, `DB_ENGINE=sqlite`, and workspace-local `DATA_DIR`, `UPLOAD_DIR`, and `LOG_DIR`. Verify `/api/health` returns `code: 0` and the existing frontend on `127.0.0.1:5173` remains HTTP 200.
