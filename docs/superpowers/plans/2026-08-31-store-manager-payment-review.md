# Store Manager Payment Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add store-manager identity, a restricted payment-opening view of design reviews, and a store-scoped manager approval queue before non-manager payment records can continue through stage two.

**Architecture:** Keep user identity, task review authorization, payment-opening authorization, payment data scope, and manager approval as separate capabilities. Store only active manager-review requests in a dedicated payment table; approve/reject atomically writes the payment workflow result and removes the active request. Introduce a read-only all-store payment permission for sub-admins without weakening existing write checks.

**Tech Stack:** Vue 3, Vue Router, Pinia, Element Plus, Express, SQLite/MySQL compatibility layer, Jest/Supertest, Playwright.

---

## File Map

- `standalone-server/config/database.js`: ensure `sys_user.is_store_manager` exists in both databases.
- `standalone-server/config/payment-tracking-schema.js`: declare the active manager-review queue table.
- `standalone-server/config/payment-tracking-migration.js`: retire the old manager permission, seed legacy pending requests, and keep migration idempotent.
- `standalone-server/config/permissions.js`: register `payment.view.all`, remove `payment.manager_review`, and update implications/defaults.
- `standalone-server/services/permission.service.js`: remove stale permission rows while computing the new catalog.
- `standalone-server/dao/user.dao.js`, `standalone-server/services/user.service.js`, `standalone-server/routes/auth.js`, `standalone-server/middleware/auth.js`: persist and expose store-manager identity.
- `src/views/admin/Users.vue`: edit operator/operator-assistant store and manager identity.
- `src/utils/permissions.js`, `src/store/index.js`: expose current-user permission and manager helpers.
- `standalone-server/dao/task.dao.js`, `standalone-server/services/task.service.js`, `standalone-server/routes/task/task-query.js`: query restricted same-store design review tasks without changing operator-assistant task flows.
- `src/views/shared/Review.vue`, `src/config/menus.js`, `src/router/index.js`: render row-level review/open actions and allow `payment.open` into the design review page.
- `standalone-server/services/payment-tracking/manager-review.service.js`: own active request listing, authorization, approval, rejection, and recovery behavior.
- `standalone-server/routes/payment-tracking/manager-review-routes.js`: expose manager-review HTTP endpoints.
- `standalone-server/services/payment-tracking/repository.js`, `workflow.service.js`, `record.service.js`, `access.js`: persist requests and enforce pending/read-only action locks.
- `src/api/payment-tracking.js`, `src/views/payment-tracking/ManagerReviewList.vue`, `StageDetail.vue`, `SelectionList.vue`, `RecordsList.vue`: manager-review page and pending/read-only UI.
- `standalone-server/tests/api/user.test.js`, `task.test.js`, `payment-tracking.test.js`, `payment-tracking-schema.test.js`, `standalone-server/tests/unit/permissions.test.js`: backend regression coverage.
- `tests/task-pages/task-page-features.spec.js`, `tests/payment-tracking/payment-tracking.spec.js`: focused browser behavior when existing fixtures support it.

### Task 1: Persist Store-Manager Identity Without Changing Assistant Tasks

**Files:**
- Modify: `standalone-server/config/database.js`
- Modify: `standalone-server/dao/user.dao.js`
- Modify: `standalone-server/services/user.service.js`
- Modify: `standalone-server/routes/auth.js`
- Modify: `standalone-server/middleware/auth.js`
- Modify: `src/views/admin/Users.vue`
- Modify: `src/store/index.js`
- Test: `standalone-server/tests/api/user.test.js`
- Test: `standalone-server/tests/api/auth.test.js`

- [ ] **Step 1: Write failing identity tests**

Add API assertions that operator assistants accept `store` and `isStoreManager`, operators retain required stores, other roles clear both fields, and login/refresh responses contain `isStoreManager`.

```js
expect(createdUser).toMatchObject({
  role: 'operator_assistant',
  store: 'A店',
  is_store_manager: 1
});
expect(login.body.data.user).toMatchObject({
  store: 'A店',
  isStoreManager: 1
});
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `cd standalone-server && npx jest tests/api/user.test.js tests/api/auth.test.js --runInBand`

Expected: FAIL because `is_store_manager` does not exist and operator assistants discard `store`.

- [ ] **Step 3: Add the identity field and validation**

Add idempotent SQLite/MySQL `ALTER TABLE sys_user ADD COLUMN is_store_manager ... DEFAULT 0`. Thread the field through user list/detail/create/update and authentication claims as `isStoreManager`. Validate stores as follows:

```js
const STORE_ROLES = new Set(['operator', 'operator_assistant']);
const normalizedStore = STORE_ROLES.has(role) ? String(store || '').trim() : '';
const normalizedManager = STORE_ROLES.has(role) && isStoreManager ? 1 : 0;
if (STORE_ROLES.has(role) && !normalizedStore) {
  throw new AppError(400, '运营和运营助理必须选择店铺');
}
```

Existing operator-assistant rows with blank stores remain valid until edited; creation and update submissions require a store.

- [ ] **Step 4: Update the user-management form**

Show the store selector for `operator` and `operator_assistant`, show an `el-switch` labelled “是否为店长”, submit `isStoreManager`, clear fields when changing to another role, and display store plus a manager tag in the list.

- [ ] **Step 5: Prove operator-assistant task queries are unchanged**

Add a regression test with assistants in different stores and assert both still see the same original operator task-hall behavior and can be assigned according to the existing role rules.

- [ ] **Step 6: Run tests and commit**

Run: `cd standalone-server && npx jest tests/api/user.test.js tests/api/auth.test.js tests/api/task.test.js --runInBand`

Expected: PASS.

Commit only task files: `git commit -m "feat: add store manager identity"`.

### Task 2: Add Read-Only All-Store Payment Scope and Retire the Old Permission

**Files:**
- Modify: `standalone-server/config/permissions.js`
- Modify: `standalone-server/services/permission.service.js`
- Modify: `standalone-server/services/payment-tracking/constants.js`
- Modify: `standalone-server/services/payment-tracking/access.js`
- Modify: `standalone-server/services/payment-tracking/record.service.js`
- Modify: `src/utils/permissions.js`
- Test: `standalone-server/tests/unit/permissions.test.js`
- Test: `standalone-server/tests/api/payment-tracking.test.js`

- [ ] **Step 1: Write failing permission tests**

```js
expect(defaultPermissionsFor('sub_admin')).toContain('payment.view.all');
expect(defaultPermissionsFor('sub_admin')).not.toContain('payment.manage.all');
expect(PERMISSIONS.map(item => item.code)).not.toContain('payment.manager_review');
expect(expandPermissions(['payment.manage.all'])).toContain('payment.view.all');
```

Add an API test proving a sub-admin can list both stores but receives 403 from create, stage save, delete, restore, and reopen endpoints.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `cd standalone-server && npx jest tests/unit/permissions.test.js tests/api/payment-tracking.test.js --runInBand`

Expected: FAIL because `payment.view.all` is unknown and sub-admins lack payment pages.

- [ ] **Step 3: Implement the permission model**

Register:

```js
{ code: 'payment.view.all', name: '查看全部店铺打款数据', type: 'action', group: '打款跟踪' }
```

Add it to the sub-admin default and to `payment.manage.all` implications. Remove `payment.manager_review` from catalogs and implications. Split access helpers:

```js
function canViewAllPaymentData(user) {
  return canManageAllPaymentData(user)
    || ownsPermission(user, 'payment.view.all')
    || user?.role === 'sub_admin';
}

function canWritePaymentData(user) {
  return canManageAllPaymentData(user)
    || ownsPermission(user, 'payment.selection.view');
}
```

Use all-store view only for list/detail scope. Do not let it satisfy any write assertion.

- [ ] **Step 4: Remove stale permission overrides**

During permission seeding, delete `payment.manager_review` from `sys_user_permission` and `sys_permission` after the new catalog is available. Keep the deletion idempotent.

- [ ] **Step 5: Run tests and commit**

Run: `cd standalone-server && npx jest tests/unit/permissions.test.js tests/api/payment-tracking.test.js --runInBand`

Expected: PASS.

Commit: `git commit -m "feat: add read-only global payment scope"`.

### Task 3: Provide Restricted Design Review Access for Payment Opening

**Files:**
- Modify: `standalone-server/dao/task.dao.js`
- Modify: `standalone-server/services/task.service.js`
- Modify: `standalone-server/routes/task/task-query.js`
- Modify: `standalone-server/services/payment-tracking/open.service.js`
- Modify: `src/config/menus.js`
- Modify: `src/router/index.js`
- Modify: `src/views/shared/Review.vue`
- Test: `standalone-server/tests/api/task.test.js`
- Test: `standalone-server/tests/api/payment-tracking-images.test.js`

- [ ] **Step 1: Write failing restricted-review tests**

Create same-store and cross-store design tasks. For a user with only `payment.open`, assert same-store tasks are listed, cross-store tasks are absent, task detail is readable, review and batch-review return 403, and open-payment succeeds. Assert the original publisher can still review only their own task.

- [ ] **Step 2: Run tests and verify failure**

Run: `cd standalone-server && npx jest tests/api/task.test.js tests/api/payment-tracking-images.test.js --runInBand`

Expected: FAIL because `/my-published` rejects `payment.open` and filters to the current publisher.

- [ ] **Step 3: Add a dedicated review-list capability**

Extend the task query endpoint to accept `payment.open`, but pass an explicit restricted mode rather than broadening every `queryMyPublished` consumer:

```js
const paymentOpenView = query.taskGroup === 'design'
  && ownsPermission(user, 'payment.open');
```

In restricted mode, filter design tasks by the publisher's `sys_user.store`; use all stores only for admin, sub-admin, or `payment.manage.all`. Return row capabilities:

```js
task.allowedActions = {
  review: canReviewTask(task, user),
  openPayment: canOpenPaymentTask(task, user)
};
```

Do not alter operator-assistant task-group queries.

- [ ] **Step 4: Preserve task action authorization**

Keep `/review` and `/batch-review` dependent on task-review permissions and per-task publisher checks. Filter batch review to explicitly reviewable task IDs and reject direct attempts on non-reviewable rows.

- [ ] **Step 5: Render row-level actions**

Allow the design review menu/route when either `operator.review.design` or `payment.open` is present. In `Review.vue`, derive separate selected subsets:

```js
const reviewableSelected = computed(() => selectedRows.value.filter(row => row.allowedActions?.review));
const paymentOpenableSelected = computed(() => selectedRows.value.filter(row => row.allowedActions?.openPayment));
```

Show pass/reject only when `allowedActions.review`; show open-payment only when `allowedActions.openPayment`. Keep task detail and image behavior unchanged.

- [ ] **Step 6: Run tests and commit**

Run: `cd standalone-server && npx jest tests/api/task.test.js tests/api/payment-tracking-images.test.js --runInBand`

Expected: PASS.

Commit: `git commit -m "feat: add restricted payment opening review"`.

### Task 4: Build the Active Manager-Review Queue

**Files:**
- Modify: `standalone-server/config/payment-tracking-schema.js`
- Modify: `standalone-server/config/payment-tracking-migration.js`
- Modify: `standalone-server/services/payment-tracking/repository.js`
- Create: `standalone-server/services/payment-tracking/manager-review.service.js`
- Create: `standalone-server/routes/payment-tracking/manager-review-routes.js`
- Modify: `standalone-server/routes/payment-tracking/index.js`
- Test: `standalone-server/tests/api/payment-tracking-manager-review.test.js`
- Test: `standalone-server/tests/api/payment-tracking-schema.test.js`

- [ ] **Step 1: Write failing schema and authorization tests**

Assert the active queue table exists with a unique `record_id`. Test that same-store managers, admins, sub-admins, and `payment.manage.all` can list/detail requests; non-managers and cross-store managers receive 403.

- [ ] **Step 2: Run tests and verify failure**

Run: `cd standalone-server && npx jest tests/api/payment-tracking-schema.test.js tests/api/payment-tracking-manager-review.test.js --runInBand`

Expected: FAIL because the table and endpoints do not exist.

- [ ] **Step 3: Add the queue schema and repository methods**

Create SQLite/MySQL equivalents of:

```sql
CREATE TABLE IF NOT EXISTS payment_manager_review_request (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER NOT NULL UNIQUE,
  store TEXT NOT NULL,
  applicant_id INTEGER NOT NULL,
  applicant_name TEXT DEFAULT '',
  request_version INTEGER NOT NULL,
  create_time TEXT DEFAULT (datetime('now', 'localtime'))
)
```

Add repository functions to create, find with a transaction lock, list/count by store, and delete by ID.

- [ ] **Step 4: Implement manager authorization and read-only detail**

```js
function canReviewStore(user, store) {
  return user?.role === 'admin'
    || user?.role === 'sub_admin'
    || canManageAllPaymentData(user)
    || (Boolean(user?.isStoreManager) && user?.store === store);
}
```

Return only active requests. Use the existing record presenter in a forced read-only mode for the detail response.

- [ ] **Step 5: Add list/detail/count routes and commit**

Run the focused tests; expected PASS.

Commit: `git commit -m "feat: add payment manager review queue"`.

### Task 5: Integrate Approval, Rejection, and Recovery Into the Workflow

**Files:**
- Modify: `standalone-server/services/payment-tracking/manager-review.service.js`
- Modify: `standalone-server/services/payment-tracking/workflow.service.js`
- Modify: `standalone-server/services/payment-tracking/record.service.js`
- Modify: `standalone-server/services/payment-tracking/access.js`
- Modify: `standalone-server/services/payment-tracking/rules.js`
- Modify: `standalone-server/services/payment-tracking/repository.js`
- Modify: `standalone-server/routes/payment-tracking/manager-review-routes.js`
- Test: `standalone-server/tests/api/payment-tracking-manager-review.test.js`
- Test: `standalone-server/tests/unit/payment-tracking-rules.test.js`

- [ ] **Step 1: Write failing workflow tests**

Cover non-manager submission, direct manager submission, pending locks, approval with required paid time, rejection with the fixed end reason, concurrent second decisions, delete cleanup, and rejection recovery creating a fresh active request.

```js
expect(submitted.body.data).toMatchObject({
  currentStage: 'testing',
  managerReviewPending: true
});
expect(rejected.body.data).toMatchObject({
  processStatus: 'ended',
  endStage: 'testing',
  endReason: '店长未确认开启付费'
});
```

- [ ] **Step 2: Run tests and verify failure**

Run: `cd standalone-server && npx jest tests/api/payment-tracking-manager-review.test.js tests/unit/payment-tracking-rules.test.js --runInBand`

Expected: FAIL because first-stage advance always activates stage two directly.

- [ ] **Step 3: Create pending requests during first-stage advance**

After selection validation, complete selection and insert testing. If the actor is not a store manager/global reviewer, insert the unique queue row in the same transaction. Derive `managerReviewPending` from the active row and force all workflow write actions false while pending.

- [ ] **Step 4: Implement approval and rejection transactions**

Approval requires a valid date-time, writes `paid_enabled = 1`, writes `paid_at`, bumps the record version, deletes the request, and emits notifications after commit. Rejection writes `paid_enabled = 0`, clears `paid_at`, marks testing ended, writes the fixed end snapshot, bumps version, and deletes the request.

- [ ] **Step 5: Implement restore and cleanup**

When restoring `end_type = 'payment_not_enabled'`, clear testing payment fields and create a new active request. Soft deletion of a pending record deletes the active request in the same transaction. Any normal workflow write endpoint rejects while a request exists.

- [ ] **Step 6: Run tests and commit**

Run: `cd standalone-server && npx jest tests/api/payment-tracking-manager-review.test.js tests/api/payment-tracking.test.js tests/unit/payment-tracking-rules.test.js --runInBand`

Expected: PASS.

Commit: `git commit -m "feat: enforce store manager payment approval"`.

### Task 6: Add the Manager Review UI and Pending Locks

**Files:**
- Modify: `src/api/payment-tracking.js`
- Modify: `src/api/index.js`
- Modify: `src/config/menus.js`
- Modify: `src/router/index.js`
- Create: `src/views/payment-tracking/ManagerReviewList.vue`
- Modify: `src/views/payment-tracking/StageDetail.vue`
- Modify: `src/views/payment-tracking/SelectionList.vue`
- Modify: `src/views/payment-tracking/RecordsList.vue`
- Modify: `src/components/payment-tracking/ProductRowCard.vue`
- Modify: `src/views/Layout.vue`
- Test: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: Add failing browser assertions where fixtures permit**

Assert the manager menu and pending badge, read-only detail, required paid-time dialog, rejection disappearance, pending card label, and hidden write actions for sub-admin read-only users.

- [ ] **Step 2: Add API wrappers and route/menu gates**

Expose list/detail/count/approve/reject calls. Add `/payment-tracking/manager-reviews`. The route and menu use an identity-aware helper:

```js
export function canUseManagerReview(user = getUser()) {
  return user?.role === 'admin'
    || user?.role === 'sub_admin'
    || Boolean(user?.isStoreManager)
    || hasPermission('payment.manage.all', user);
}
```

- [ ] **Step 3: Build the pending-only page**

Render filters and a table/card list with exactly three row commands: “查看记录”, “通过”, and “拒绝”. Approval opens an Element Plus date-time dialog and refuses an empty value. Rejection uses one confirmation and no reason field. Reload after 409/processed responses.

- [ ] **Step 4: Render pending and read-only states**

Show “待店长审核” on the selection card and second-stage header. Disable or hide save, advance, end, restore, reopen, image mutation, and link-status mutation according to backend `allowedActions`. Sub-admin global views hide every write command.

- [ ] **Step 5: Add badge polling/realtime refresh**

Use the existing sidebar badge/realtime pattern for active request count. Treat request count, not notification read state, as the source of truth.

- [ ] **Step 6: Run frontend tests without building and commit**

Run: `npx playwright test --config=playwright.payment-tracking.config.js`

Expected: focused payment-tracking tests PASS. Do not run any build command.

Commit: `git commit -m "feat: add store manager review page"`.

### Task 7: Migrate Legacy Pending Records Idempotently

**Files:**
- Modify: `standalone-server/config/payment-tracking-migration.js`
- Modify: `standalone-server/services/permission.service.js`
- Test: `standalone-server/tests/api/payment-tracking-schema.test.js`

- [ ] **Step 1: Add failing migration tests**

Seed an old database with a testing-stage in-progress record whose `paid_enabled` is null, a paid record, a denied record, and stale `payment.manager_review` rows. Run initialization twice.

Assert exactly one active request exists only for the null record, old paid values are unchanged, stale permission rows are gone, and the second initialization creates no duplicates.

- [ ] **Step 2: Run the schema test and verify failure**

Run: `cd standalone-server && npx jest tests/api/payment-tracking-schema.test.js --runInBand`

Expected: FAIL because legacy requests are not backfilled.

- [ ] **Step 3: Implement the idempotent backfill**

Use `INSERT OR IGNORE` for SQLite and `INSERT IGNORE` for MySQL, selecting in-progress testing records with null payment confirmation and no deleted record. Preserve all records with explicit true/false values.

- [ ] **Step 4: Run migration tests and commit**

Run: `cd standalone-server && npx jest tests/api/payment-tracking-schema.test.js --runInBand`

Expected: PASS on first and repeated initialization.

Commit: `git commit -m "fix: migrate pending manager reviews"`.

### Task 8: Full Local Regression and Server Restart

**Files:**
- Modify only test defects directly caused by this feature.

- [ ] **Step 1: Run the complete backend suite**

Run: `cd standalone-server && npm test -- --runInBand`

Expected: all unit and API tests PASS.

- [ ] **Step 2: Run focused frontend suites**

Run: `npx playwright test --config=playwright.task-pages.config.js`

Run: `npx playwright test --config=playwright.payment-tracking.config.js`

Expected: all applicable tests PASS. Do not run Vite/Electron/package builds.

- [ ] **Step 3: Verify dirty-worktree boundaries**

Run: `git status --short` and `git diff --check`.

Expected: unrelated pre-existing changes remain untouched; feature diffs contain no whitespace errors.

- [ ] **Step 4: Restart only local services**

Stop and restart the local backend on `127.0.0.1:18632` and frontend on `127.0.0.1:5173`, using the local SQLite database. Confirm health/login endpoints respond and the frontend loads.

- [ ] **Step 5: Final local commit**

Commit only remaining feature/test files with `git commit -m "test: cover store manager payment review"`. Do not push and do not package.
