# My Tasks Payment Opening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add payment-opening actions to the operator design “My Tasks” page while restoring the review list to self-only scope unless the user also has all-store payment visibility.

**Architecture:** Keep the existing `/api/task/my-published` and payment-opening endpoints. Make the task query honor `selfOnly=true` for ordinary payment openers, then add page-local UI handlers to `MyTasksPub.vue` using the same API contract and eligibility rules as `Review.vue`; do not refactor the working review page.

**Tech Stack:** Vue 3, Element Plus, Express, SQL.js/MySQL-compatible DAO, Jest/Supertest, Playwright.

---

## File Map

- Modify `standalone-server/tests/api/payment-tracking-images.test.js`: lock the self-only and all-store list behavior and verify completed-task opening.
- Modify `standalone-server/services/task.service.js`: decide whether a `my-published` request may use the payment-wide query branch.
- Modify `src/views/shared/MyTasksPub.vue`: add operator-design-only selection, single opening, batch opening, and detail opening actions.
- Modify `tests/payment-tracking/payment-tracking.spec.js`: verify the new My Tasks controls and preserve role isolation.

### Task 1: Protect Review Query Scope

**Files:**
- Test: `standalone-server/tests/api/payment-tracking-images.test.js:497`
- Modify: `standalone-server/services/task.service.js:385`

- [ ] **Step 1: Add failing API assertions for self-only scope**

After the existing `restrictedList` assertion, add queries that reuse the existing payment-only and all-store users:

```javascript
const restrictedSelfOnlyList = await request(app)
  .get('/api/task/my-published?taskGroup=design&status=doing&selfOnly=true&pageSize=100')
  .set('Authorization', `Bearer ${paymentOnlyToken}`);
expect(restrictedSelfOnlyList.body.code).toBe(0);
expect(restrictedSelfOnlyList.body.data.list.some(
  task => Number(task.id) === Number(restrictedSameStoreTask)
)).toBe(false);

const allStoreSelfOnlyList = await request(app)
  .get('/api/task/my-published?taskGroup=design&status=doing&selfOnly=true&pageSize=100')
  .set('Authorization', `Bearer ${allStorePaymentToken}`);
expect(allStoreSelfOnlyList.body.code).toBe(0);
expect(allStoreSelfOnlyList.body.data.list.some(
  task => Number(task.id) === Number(restrictedCrossStoreTask)
)).toBe(true);
```

- [ ] **Step 2: Run the focused API test and verify the ordinary self-only assertion fails**

Run:

```powershell
cd standalone-server
npx jest tests/api/payment-tracking-images.test.js --runInBand
```

Expected before implementation: the test fails because `payment.open` currently overrides `selfOnly=true` and includes `restrictedSameStoreTask`.

- [ ] **Step 3: Make payment-wide scope conditional on the request context**

In `getMyPublished`, normalize `selfOnly` once and enable the payment-wide query only when the request is not self-only or the user may view all payment data:

```javascript
const group = query.taskGroup || (user.role === 'cs_agent' ? 'cs' : 'design');
const selfOnly = query.selfOnly === '1' || query.selfOnly === 'true';
const allPaymentTasks = canViewAllPaymentTasks(user);
const paymentOpenView = group === 'design'
  && hasPermission(user, 'payment.open')
  && (!selfOnly || allPaymentTasks);

const result = await taskDao.queryMyPublished({
  userId: user.id, role: user.role,
  store: user.store || '',
  permissions: user.permissions || [],
  filterGroup: group,
  selfOnly,
  paymentOpenView,
  canViewAllPaymentTasks: allPaymentTasks,
```

Leave `queryMyPublished`, `canOpenPaymentTask`, review actions, and payment-opening services unchanged.

- [ ] **Step 4: Run the focused API test and verify it passes**

Run:

```powershell
cd standalone-server
npx jest tests/api/payment-tracking-images.test.js --runInBand
```

Expected: all tests in the file pass, including ordinary self-only, ordinary same-store non-self-only, and all-store self-only assertions.

- [ ] **Step 5: Commit the backend scope change locally**

```powershell
git add -- standalone-server/services/task.service.js standalone-server/tests/api/payment-tracking-images.test.js
git commit -m "fix: keep ordinary payment review self only"
```

### Task 2: Add Payment Opening to My Tasks

**Files:**
- Modify: `src/views/shared/MyTasksPub.vue:1`
- Test: `tests/payment-tracking/payment-tracking.spec.js:352`
- Test: `tests/payment-tracking/payment-tracking.spec.js:566`
- Test: `tests/payment-tracking/payment-tracking.spec.js:1371`

- [ ] **Step 1: Extend the browser mock with a completed eligible task**

Append this record to `reviewTasks`:

```javascript
{
  id: 204,
  task_no: 'D202608270004',
  title: '审核通过后补开打款',
  status: 'finished',
  task_group: 'design',
  designer_name: '美工四',
  create_time: '2026-08-27 06:00:00',
  payment_tracking_opened: '0',
  allowedActions: { review: false, openPayment: true },
  files: [{ id: 2007, file_name: 'finished.png', file_type: 'image', file_category: 'work' }]
}
```

Update the `/api/task/my-published` mock to honor the requested status so the review page continues receiving only `doing` tasks:

```javascript
const requestedStatuses = String(url.searchParams.get('status') || '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean)
const visibleTasks = requestedStatuses.length
  ? reviewTasks.filter(task => requestedStatuses.includes(task.status))
  : reviewTasks
await route.fulfill({
  json: { code: 0, data: { list: visibleTasks, total: visibleTasks.length, page: 1, pageSize: 15 } }
})
```

Add a single-open mock for the finished task:

```javascript
if (url.pathname === '/api/payment-tracking/open/task/204') {
  await route.fulfill({
    json: { code: 0, msg: '打款已开启', data: { id: 304, sourceTaskId: 204 } }
  })
  return
}
```

- [ ] **Step 2: Add a failing My Tasks browser test**

Add a test that opens `/#/operator/tasks`, confirms the batch button exists, confirms the completed row has a single-open action, opens its detail and confirms the detail action, then verifies the single API request:

```javascript
test('我的任务为待审核和已完成任务提供单条及批量开启打款', async ({ page }) => {
  await page.goto('/#/operator/tasks')

  await expect(page.getByRole('button', { name: /批量开启打款/ })).toBeVisible()
  const finishedRow = page.locator('.el-table__body tr').filter({ hasText: 'D202608270004' })
  const finishedOpen = finishedRow.getByRole('button', { name: '开启打款', exact: true })
  await expect(finishedOpen).toBeEnabled()

  await finishedRow.getByRole('button', { name: '详情', exact: true }).click()
  const overlay = page.locator('.task-detail-overlay')
  await expect(overlay.getByRole('button', { name: '开启打款', exact: true })).toBeEnabled()
  await overlay.getByRole('button', { name: '关闭', exact: true }).click()

  const requestPromise = page.waitForRequest(request => (
    request.method() === 'POST'
    && new URL(request.url()).pathname === '/api/payment-tracking/open/task/204'
  ))
  await finishedOpen.click()
  await requestPromise

  await page.locator('.el-table__header-wrapper .el-checkbox').click()
  await expect(page.getByRole('button', { name: /批量开启打款/ })).toBeEnabled()
})
```

Add two permission-isolation tests. They must confirm the controls are absent without `payment.open`, and absent from the客服基础美工 task group even if the permission is present:

```javascript
test('我的任务开启打款入口按权限和任务分组隔离', async ({ page }) => {
  await installMocks(page, { permissions: ['operator.tasks.design'] })
  await page.goto('/#/operator/tasks')
  await expect(page.getByRole('button', { name: /批量开启打款/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '开启打款', exact: true })).toHaveCount(0)
})

test('客服基础美工我的任务不显示开启打款入口', async ({ page }) => {
  await installMocks(page, { permissions: ['cs.tasks.basic', 'payment.open'] })
  await page.goto('/#/cs/tasks')
  await expect(page.getByRole('button', { name: /批量开启打款/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '开启打款', exact: true })).toHaveCount(0)
})
```

- [ ] **Step 3: Run the browser test and verify it fails because My Tasks has no payment controls**

Run:

```powershell
npx playwright test tests/payment-tracking/payment-tracking.spec.js --config=playwright.payment-tracking.config.js --grep "我的任务为待审核和已完成任务"
```

Expected before implementation: failure finding “批量开启打款”.

- [ ] **Step 4: Add permission and eligibility state to MyTasksPub**

Import `openPaymentFromTaskApi` and `openPaymentBatchApi`. Add state equivalent to the working review page:

```javascript
const canOpenPayment = computed(() => taskGroup.value === 'design' && hasPermission('payment.open'))
const selectedRows = ref([])
const paymentOpeningIds = ref(new Set())
const batchPaymentOpening = ref(false)

function isPaymentOpened(value) {
  return value === true || value === 1 || value === '1'
}

function getWorkImages(files) {
  return getWorkFiles(files).filter(file => file.file_type === 'image')
}

const paymentOpenableSelected = computed(() => selectedRows.value.filter(row => (
  row.allowedActions?.openPayment
  && ['doing', 'finished'].includes(row.status)
  && getWorkImages(row.files).length
  && !isPaymentOpened(row.payment_tracking_opened)
)))

function onSelectChange(rows) {
  selectedRows.value = rows
}
```

- [ ] **Step 5: Add My Tasks table and detail controls**

Above the table, render the batch button only for `canOpenPayment`. Add `@selection-change="onSelectChange"` to the table and a conditional selection column. In the row operation and TaskDetail action slots, add the same button conditions as Review.vue:

```vue
<el-button
  v-if="canOpenPayment"
  type="warning"
  :disabled="paymentOpenableSelected.length === 0"
  :loading="batchPaymentOpening"
  @click="handleBatchOpenPayment"
>批量开启打款 ({{ paymentOpenableSelected.length }})</el-button>
```

```vue
<el-button
  v-if="canOpenPayment && row.allowedActions?.openPayment"
  type="warning"
  link
  size="small"
  :disabled="!getWorkImages(row.files).length || isPaymentOpened(row.payment_tracking_opened)"
  :loading="paymentOpeningIds.has(row.id)"
  @click="handleOpenPayment(row)"
>开启打款</el-button>
```

The detail button uses `currentTask` instead of `row`. Keep all existing task buttons and event handlers unchanged. Increase the fixed operation column width only when `canOpenPayment` is true.

- [ ] **Step 6: Add page-local single and batch handlers**

Copy the observable behavior from Review.vue without refactoring it: call the existing APIs, show restored/already-opened/new messages, reload the list, and show batch details with `white-space: pre-line`. Clear table selection after a completed batch.

- [ ] **Step 7: Run the focused browser test and verify it passes**

Run:

```powershell
npx playwright test tests/payment-tracking/payment-tracking.spec.js --config=playwright.payment-tracking.config.js --grep "我的任务为待审核和已完成任务"
```

Expected: one test passes.

- [ ] **Step 8: Commit the My Tasks feature locally**

```powershell
git add -- src/views/shared/MyTasksPub.vue tests/payment-tracking/payment-tracking.spec.js
git commit -m "feat: open payment tracking from my tasks"
```

### Task 3: Regression Verification

**Files:**
- Verify: `standalone-server/services/task.service.js`
- Verify: `src/views/shared/MyTasksPub.vue`
- Verify: `src/views/shared/Review.vue`

- [ ] **Step 1: Run the complete payment tracking API test file**

```powershell
cd standalone-server
npx jest tests/api/payment-tracking-images.test.js --runInBand
```

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run payment tracking browser tests for both task pages**

```powershell
npx playwright test tests/payment-tracking/payment-tracking.spec.js --config=playwright.payment-tracking.config.js --grep "开启打款|我的任务"
```

Expected: My Tasks entry tests, Review opening tests, and no-permission hiding tests pass.

- [ ] **Step 3: Run the existing task page regression suite**

```powershell
npm run test:task-pages
```

Expected: all task-page tests pass, including task detail role isolation and existing actions.

- [ ] **Step 4: Inspect the final diff and local service state**

```powershell
git diff HEAD~2 --check
git status --short
Invoke-WebRequest http://127.0.0.1:18632/api/health -UseBasicParsing
Invoke-WebRequest http://127.0.0.1:5173/api/health -UseBasicParsing
```

Expected: no whitespace errors, a clean tracked worktree after local commits, and both local health checks return HTTP 200.

- [ ] **Step 5: Restart only the local backend**

Stop the process listening on `127.0.0.1:18632`, then restart `standalone-server/server.js` with explicit local-only settings:

```text
NODE_ENV=development
PORT=18632
HOST=127.0.0.1
USE_MYSQL=0
DB_ENGINE=sqlite
DATA_DIR=<repo>/.local-dev-data
UPLOAD_DIR=<repo>/.local-dev-upload
LOG_DIR=<repo>/.local-dev-logs
```

Verify `/api/health` returns HTTP 200 and the startup log names `.local-dev-data/design.db` as the active SQLite database. Do not stop or contact any production service.
