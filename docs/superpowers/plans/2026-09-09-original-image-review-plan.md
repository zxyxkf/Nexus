# 原图审核流程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** 在客服基础美工任务中加入“待审核原图”中间状态、客服单条原图审核、基础美工原图撤回，并让运营设计任务的款号成为必填，同时保持其他角色和既有任务流转不变。

**Architecture:** 复用现有 `task.service` 的事务、权限范围和通知机制，新增两个独立动作接口，避免复用效果图审核或 `undo-submit` 造成状态串线。前端将新状态纳入现有状态映射、查询筛选和按钮渲染，批量审核仍只提交 `doing` 任务。

**Tech Stack:** Vue 3 + Element Plus、Node.js/Express、SQLite/MySQL 双引擎、Jest/Supertest。

---

### Task 1: 后端状态与允许动作

**Files:**
- Modify: `standalone-server/services/task.service.js`
- Modify: `standalone-server/dao/task.dao.js`
- Modify: `standalone-server/routes/task/task-action.js`
- Modify: `standalone-server/routes/task/task-crud.js`

- [ ] **Step 1: Add the new status to service guards and allowed actions**

Update the task status checks so `pending_original_review` is a first-class status. Keep `canReviewTask` restricted to `doing`, add a separate `canReviewOriginalTask` that reuses the existing review permission and publisher/store visibility rules, and expose `reviewOriginal`/`withdrawOriginal` in `attachAllowedActions` only when the current user can perform them.

- [ ] **Step 2: Change original-upload completion without changing file storage**

In `completeOriginalUpload`, retain the existing task/file ownership checks and “at least one original file” query, but update only to `pending_original_review` with `finish_time = NULL`, `urge_time = NULL`, and no score-review fields. Emit the existing publisher/group refresh events and a task event that tells the客服 reviewer an original image is waiting.

- [ ] **Step 3: Implement transactional original-image review**

Add `reviewOriginalTask(taskId, action, user)` beside `reviewTask`:

```js
if (!['pass', 'reject'].includes(action)) throw new AppError(400, '原图审核操作无效')
// lock task, enforce task_group === 'cs', status === 'pending_original_review'
// require at least one file_category = 'original'
// pass: status = 'finished', finish_time = now, score fields follow existing finalization rules
// reject: status = 'pending_original', preserve files and score fields
```

Use the same publisher/store permission boundary as `reviewTask`; do not create a reject record for this action. Emit the existing notification/socket events after commit.

- [ ] **Step 4: Implement transactional original-image withdrawal**

Add `withdrawOriginalTask(taskId, user)`:

```js
// lock task, require task_group === 'cs'
// require user.role === 'basic_designer' and task.designer_id === user.id
// require status === 'pending_original_review'
// status = 'pending_original', keep all task_file rows and task detail fields
```

Emit publisher/group refresh events after commit. Do not call `undoSubmit`.

- [ ] **Step 5: Add routes with existing permission middleware**

Add `POST /review-original` protected by the existing review permissions and `POST /withdraw-original` protected by `task.upload.work` for `basic_designer`. Export both service methods from `task.service.js`.

- [ ] **Step 6: Add operation-role款号 validation at the service boundary**

In `prepareTaskCreation` (and the multipart publish path through the same service), normalize `styleNumber` and reject only when `user.role === 'operator' && taskGroup === 'design' && styleNumber` is empty:

```js
if (user.role === 'operator' && taskGroup === 'design' && !String(body.styleNumber || '').trim()) {
  throw new AppError(400, '请填写款号')
}
```

Do not apply this rule to `taskGroup === 'operator'`,客服发布, or edit/update flows.

### Task 2: Query, statistics, export, and status metadata

**Files:**
- Modify: `standalone-server/dao/task.dao.js`
- Modify: `standalone-server/routes/export.js`
- Modify: `src/utils/format.js`
- Modify: `src/composables/useTaskStatus.js`

- [ ] **Step 1: Include the new status in task list and red-dot counts**

Extend客服作品审核 queries to include `doing` and `pending_original_review`; add the new status to客服审核 red-dot counts and basic-designer unfinished counts. Keep finished-only score/stat queries unchanged.

- [ ] **Step 2: Update all aggregate SQL status sets**

Add `pending_original_review` anywhere the current SQL counts `pending_original` as unfinished or pending work, but do not add it to finished/score-review sets. Verify dashboard counts do not treat it as finished.

- [ ] **Step 3: Add status labels and progress metadata**

Add `pending_original_review: '待审核原图'` with a warning/info tag and a progress value between upload and finished in both shared status modules. Add header-time formatting for this status.

- [ ] **Step 4: Update exports**

Add the new status label and color to `standalone-server/routes/export.js` so exported task files show “待审核原图”.

### Task 3: Frontend API and客服审核 UI

**Files:**
- Modify: `src/api/task.js`
- Modify: `src/views/shared/Review.vue`
- Modify: `src/views/shared/MyTasksPub.vue`
- Modify: `src/views/admin/AllTasks.vue`

- [ ] **Step 1: Add API clients**

Add:

```js
export const reviewOriginalTaskApi = (data) => taskMutation(request.post('/api/task/review-original', data))
export const withdrawOriginalTaskApi = (data) => taskMutation(request.post('/api/task/withdraw-original', data))
```

- [ ] **Step 2: Load both reviewable statuses in客服作品审核**

Change the review query to request `status=doing,pending_original_review` through the existing `getMyPublishedApi` parameters. Keep permission and store scope supplied by the server.

- [ ] **Step 3: Render state-specific actions**

For `doing`, retain existing “查看作品 / 修改 / 通过”. For `pending_original_review`, render “查看作品 / 审核原图” and hide the effect-image “通过” and “修改” actions. Add an `ElMessageBox.confirm` flow for pass/reject and refresh the current page after either result.

- [ ] **Step 4: Constrain batch review**

Make selection disabled for `pending_original_review`; compute the selected reviewable list from `status === 'doing' && allowedActions.review`. The batch button count and request payload must contain only `doing` rows. Do not add a batch original-review action.

- [ ] **Step 5: Add客服 filters**

Add the “待审核原图” option to客服我的任务 and客服基础美工全量任务. Keep the existing `pending_original` option and all non-CS labels unchanged.

### Task 4: 基础美工撤回原图审核 UI

**Files:**
- Modify: `src/views/basic/MyTasks.vue`
- Leave unchanged: shared task-detail components; the current basic-designer action column is owned by `src/views/basic/MyTasks.vue`

- [ ] **Step 1: Add the status filter**

Add `pending_original_review` to the basic-designer 我的任务/待做任务 filter options and the request status set.

- [ ] **Step 2: Add the撤回 action**

Show “撤回” only when `row.status === 'pending_original_review'` and the row is owned by the current basic designer. Call `withdrawOriginalTaskApi`, then reload the list/detail and refresh the notification count.

- [ ] **Step 3: Preserve existing upload behavior**

Leave the `pending_original` upload entry, file naming, drag/drop, and completion button unchanged except for the new completion response status.

### Task 5: 运营发布任务款号必填

**Files:**
- Modify: `src/views/shared/PublishTask.vue`
- Leave unchanged: `src/views/operator/OpPublishTask.vue` (this is the separate运营助理发布表单)
- Modify: `standalone-server/tests/api/task.test.js`

- [ ] **Step 1: Add the operator-design scoped front-end rule**

In `src/views/shared/PublishTask.vue` (the route `/operator/publish`), add `prop="styleNumber"` and a required rule for the operator design form. Keep the same component’s客服 branch, StylePicker behavior, and placeholders unchanged.

- [ ] **Step 2: Verify the operator design form submits the field**

Ensure the payload already sent to `publishTaskApi` includes the trimmed `styleNumber`; do not rename the field or change other form validation.

- [ ] **Step 3: Add API coverage**

Create an operator user and assert a design publish request with an empty style number returns `400`; repeat with a non-empty value and assert success; assert a客服 publish without this field still follows its existing validation behavior.

### Task 6: Automated regression coverage

**Files:**
- Modify: `standalone-server/tests/unit/task-state-machine.test.js`
- Modify: `standalone-server/tests/api/task-original-upload.test.js`
- Add: `standalone-server/tests/api/task-original-review.test.js`

- [ ] **Step 1: Extend the state-machine fixture**

Add `pending_original_review` to `ALL_STATUSES`, allow only `pending_original -> pending_original_review`, `pending_original_review -> finished`, and `pending_original_review -> pending_original`, and assert invalid direct transitions.

- [ ] **Step 2: Update original upload expectations**

Change the completion expectation from `finished` to `pending_original_review`; assert `finish_time` is empty and `score_review_status` is empty after completion.

- [ ] **Step 3: Test pass/reject/withdraw**

Cover客服 pass,客服 reject, basic-designer withdraw, wrong user, wrong status, missing original file, duplicate review, and finished-task review. Assert original `task_file` rows remain after reject/withdraw.

- [ ] **Step 4: Run focused tests**

Run:

```powershell
npm test -- --runInBand standalone-server/tests/unit/task-state-machine.test.js standalone-server/tests/api/task-original-upload.test.js standalone-server/tests/api/task-original-review.test.js
```

Expected: all focused state and API tests pass with no production database connection.

### Task 7: Verification and local service restart

**Files:** none

- [ ] **Step 1: Run static checks**

Run the repository’s existing frontend lint/typecheck command and backend syntax checks without creating a production build.

- [ ] **Step 2: Inspect the diff**

Run `git diff --check` and `git status --short`; confirm unrelated `.audit-*`, `.local-*`, and root `main.js` files are not staged.

- [ ] **Step 3: Start local backend and frontend only**

Stop only the known local development processes, restart the local backend and frontend ports, and verify the health endpoint and browser page. Do not touch production processes, production database, upload directories, or run packaging/build commands.

- [ ] **Step 4: Commit local implementation**

Commit only the implementation and test files on the current local branch. Do not push the commit to the remote repository.
