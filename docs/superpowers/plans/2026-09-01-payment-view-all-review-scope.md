# All-Store Payment Review Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users with both `payment.open` and `payment.view.all` to see and open eligible design tasks from every store without granting task review actions.

**Architecture:** Reuse the payment-tracking access module as the single source of truth for all-store payment scope. The task review list and open-payment service will call `canViewAllPaymentData(user)`; `payment.open` remains independently enforced by the existing route and service assertions.

**Tech Stack:** Node.js, Express, Jest, Supertest, SQLite test database

---

## File Structure

- Modify `standalone-server/services/task.service.js`: apply all-store payment view scope to the restricted design-review task list and row capabilities.
- Modify `standalone-server/services/payment-tracking/open.service.js`: allow cross-store opening only when the caller also has all-store payment view scope.
- Modify `standalone-server/tests/api/payment-tracking-images.test.js`: cover open-only, view-all-only, and combined permission behavior.

### Task 1: Add Regression Coverage For Combined Permissions

**Files:**
- Modify: `standalone-server/tests/api/payment-tracking-images.test.js`

- [ ] **Step 1: Add test users for the permission matrix**

Extend the existing test setup with one operator-assistant that has `payment.open` plus `payment.view.all`, and one operator-assistant that has only `payment.view.all`:

```js
let allStorePaymentToken;
let viewAllOnlyToken;

const allStorePaymentUsername = `image_payment_all_store_${suffix}`;
const viewAllOnlyUsername = `image_payment_view_only_${suffix}`;
for (const user of [
  { username: allStorePaymentUsername, realName: 'All-store payment opener' },
  { username: viewAllOnlyUsername, realName: 'All-store payment viewer' }
]) {
  await request(app)
    .post('/api/user/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      ...user,
      password: 'test123456',
      role: 'operator_assistant',
      store: '图片A店',
      isStoreManager: false
    });
}

const permissionUsers = await request(app)
  .get('/api/user/list?role=operator_assistant&pageSize=100')
  .set('Authorization', `Bearer ${adminToken}`);
const permissionUserByName = new Map(
  permissionUsers.body.data.list.map(user => [user.username, user])
);

await request(app)
  .post('/api/user/permissions/save')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    userId: permissionUserByName.get(allStorePaymentUsername).id,
    permissions: ['payment.open', 'payment.view.all'],
    deniedPermissions: []
  });
await request(app)
  .post('/api/user/permissions/save')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({
    userId: permissionUserByName.get(viewAllOnlyUsername).id,
    permissions: ['payment.view.all'],
    deniedPermissions: []
  });

allStorePaymentToken = await login(allStorePaymentUsername);
viewAllOnlyToken = await login(viewAllOnlyUsername);
```

- [ ] **Step 2: Assert the combined user sees cross-store tasks without review actions**

Add assertions to the existing `opens payment tracking from task images and reports batch skip reasons` test:

```js
const allStoreList = await request(app)
  .get('/api/task/my-published?taskGroup=design&status=doing&pageSize=100')
  .set('Authorization', `Bearer ${allStorePaymentToken}`);

expect(allStoreList.body.data.list).toEqual(expect.arrayContaining([
  expect.objectContaining({
    id: restrictedCrossStoreTask,
    allowedActions: { review: false, openPayment: true }
  })
]));
```

- [ ] **Step 3: Assert cross-store opening succeeds only with both permissions**

```js
const denied = await request(app)
  .post(`/api/payment-tracking/open/task/${restrictedCrossStoreTask}`)
  .set('Authorization', `Bearer ${viewAllOnlyToken}`);
expect(denied.status).toBe(403);

const opened = await request(app)
  .post(`/api/payment-tracking/open/task/${restrictedCrossStoreTask}`)
  .set('Authorization', `Bearer ${allStorePaymentToken}`);
expect(opened.body.code).toBe(0);
```

Also assert `POST /api/task/review` and `POST /api/task/batch-review` return `403` for `allStorePaymentToken`.

- [ ] **Step 4: Run the targeted test and verify the red phase**

Run:

```powershell
npx jest tests/api/payment-tracking-images.test.js --runInBand
```

Expected: the combined user cannot see or open the cross-store task before the implementation change.

### Task 2: Reuse All-Store Payment Scope In Task Listing And Opening

**Files:**
- Modify: `standalone-server/services/task.service.js`
- Modify: `standalone-server/services/payment-tracking/open.service.js`

- [ ] **Step 1: Use `canViewAllPaymentData` for restricted task visibility**

Replace the narrower management-only import and helper implementation in `task.service.js`:

```js
const { canViewAllPaymentData } = require('./payment-tracking/access');

function canViewAllPaymentTasks(user) {
  return canViewAllPaymentData(user);
}
```

- [ ] **Step 2: Use the same scope in open-payment store validation**

Update `open.service.js`:

```js
const {
  assertPermission,
  assertStoreAccess,
  canViewAllPaymentData
} = require('./access');

if (!canViewAllPaymentData(user) && user.store !== task.publisher_store) {
  throw attachTask(new AppError(403, '无权为其他店铺的任务开启打款'), task);
}
```

Do not remove the existing `assertPermission(user, PERMISSIONS.open)` call; it is what prevents `payment.view.all` alone from opening a task.

- [ ] **Step 3: Run the targeted test and verify the green phase**

Run:

```powershell
npx jest tests/api/payment-tracking-images.test.js --runInBand
```

Expected: all tests in the file pass, including the new cross-store permission matrix.

- [ ] **Step 4: Run the full backend suite**

Run:

```powershell
npm test -- --runInBand
```

Expected: all backend test suites pass.

- [ ] **Step 5: Check the exact diff**

Run:

```powershell
git diff --check -- standalone-server/services/task.service.js standalone-server/services/payment-tracking/open.service.js standalone-server/tests/api/payment-tracking-images.test.js
git diff --stat -- standalone-server/services/task.service.js standalone-server/services/payment-tracking/open.service.js standalone-server/tests/api/payment-tracking-images.test.js
```

Expected: no whitespace errors and only the three planned files changed for implementation.

- [ ] **Step 6: Commit the implementation locally**

```powershell
git add -- standalone-server/services/task.service.js standalone-server/services/payment-tracking/open.service.js standalone-server/tests/api/payment-tracking-images.test.js
git commit -m "feat: extend payment review scope across stores"
```

### Task 3: Restart And Verify The Local Backend

**Files:**
- No source files changed.

- [ ] **Step 1: Restart only the local backend**

Stop the process listening on `127.0.0.1:18632` after confirming it is the expected `node server.js`, then start it with:

```text
USE_MYSQL=0
DB_ENGINE=sqlite
DATA_DIR=D:/WorkBuddy_speace/2026-05-09-task-1/d-design-art-manager/.local-dev-data
UPLOAD_DIR=D:/WorkBuddy_speace/2026-05-09-task-1/d-design-art-manager/.local-dev-upload
LOG_DIR=D:/WorkBuddy_speace/2026-05-09-task-1/d-design-art-manager/.local-dev-logs
PORT=18632
HOST=127.0.0.1
NODE_ENV=development
```

- [ ] **Step 2: Verify local isolation and health**

Run:

```powershell
Invoke-RestMethod http://127.0.0.1:18632/api/health
```

Expected: `code` is `0`, the startup log names `SQLite`, and the database path is `D:/WorkBuddy_speace/2026-05-09-task-1/d-design-art-manager/.local-dev-data/design.db`.

- [ ] **Step 3: Verify the frontend remains available**

Confirm `127.0.0.1:5173` is still listening. Do not build or package the application.
