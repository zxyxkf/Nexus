# Customer Service Handoff, Style Editor, and Batch Submit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add customer-service shift handoff, non-destructive style-image annotation, and filename-driven batch work submission without changing the existing task state machine.

**Architecture:** Keep task lifecycle status and handoff status separate. Put handoff and batch matching in focused backend services, use a dedicated style-snapshot upload path, and use Fabric.js only inside a focused editor component. Existing task submission remains the final authority for ownership, state, score, file, and notification validation.

**Tech Stack:** Vue 3, Element Plus, Pinia, Fabric.js 6, Express, Multer, SQLite/MySQL dual-mode schema, Jest/Supertest, Playwright.

---

## File Map

### Backend

- Modify `standalone-server/config/database.js`: idempotent SQLite/MySQL columns.
- Modify `standalone-server/config/permissions.js`: handoff page/action defaults and implications.
- Modify `standalone-server/routes/auth.js`: return `csShiftStatus` in login and refresh payloads.
- Create `standalone-server/services/cs-handoff.service.js`: shift transitions, pool query, claim, and action guard.
- Create `standalone-server/routes/task/task-handoff.js`: handoff HTTP boundary.
- Modify `standalone-server/routes/task.js`: mount handoff routes.
- Modify `standalone-server/services/task.service.js`: enforce offline restrictions, auto-pool accepted tasks, allow pooled detail access, and expose sidebar count.
- Modify `standalone-server/dao/task.dao.js`: lock/query helpers and pooled-task filtering.
- Create `standalone-server/services/batch-submit.service.js`: deterministic filename matching.
- Create `standalone-server/routes/task/task-batch-submit.js`: resolve filenames without uploading contents.
- Create `standalone-server/routes/task/task-style-snapshot.js`: multipart style manifest and edited images.
- Create `standalone-server/services/task-style-snapshot.service.js`: ordered original copies plus edited task-local snapshots.

### Frontend

- Modify `src/config/menus.js`, `src/router/index.js`, and `src/utils/permissions.js`: route/menu/default permission mirror.
- Create `src/api/cs-handoff.js` and modify `src/api/index.js`: handoff API methods.
- Modify `src/api/task.js`: style snapshot and batch resolve methods.
- Modify `src/store/index.js`: update persisted `csShiftStatus` after toggles.
- Modify `src/views/Layout.vue`: global shift toggle, pooled badge refresh, and basic-designer batch button.
- Create `src/views/cs/HandoffTasks.vue`: shared pool page.
- Create `src/components/basic/BatchWorkSubmit.vue`: anchored upload/match/result panel.
- Create `src/components/task/StyleImageEditor.vue`: Fabric canvas editor.
- Create `src/utils/background-removal.js`: edge-connected color removal.
- Modify `src/views/shared/PublishTask.vue`: editor state and ordered style manifest submission.
- Keep `src/composables/useFileHelpers.js`: exclude `style` from submitted-work previews.
- Modify `package.json` and `package-lock.json`: pin Fabric.js.

### Tests

- Modify `standalone-server/tests/unit/permissions.test.js`.
- Create `standalone-server/tests/unit/batch-submit-matcher.test.js`.
- Create `standalone-server/tests/api/cs-handoff.test.js`.
- Create `standalone-server/tests/api/task-style-snapshot.test.js`.
- Modify `tests/task-pages/task-page-features.spec.js` for UI smoke/regression coverage.

## Task 1: Lock the Work-Preview Classification Fix

**Files:**
- Modify: `src/composables/useFileHelpers.js`
- Test: one-off Node assertion; no new test file needed for this pure one-line regression

- [ ] **Step 1: Reproduce the mixed-file failure**

Run a Node assertion against the exact helper source with this fixture:

```js
const files = [
  { id: 'style', file_category: 'style', file_type: 'image' },
  { id: 'reference', file_category: 'reference', file_type: 'image' },
  { id: 'reject', file_category: 'reject', file_type: 'image' },
  { id: 'work', file_category: 'work', file_type: 'image' }
]
```

Expected before the fix: `getFirstImage(files).id === 'style'`.

- [ ] **Step 2: Keep the minimal classification change**

```js
function isCurrentWorkFile(file) {
  return file &&
    file.file_category !== 'reference' &&
    file.file_category !== 'reject' &&
    file.file_category !== 'style'
}
```

- [ ] **Step 3: Verify all shared selectors**

Expected after the fix:

```js
getFirstImage(files).id === 'work'
getWorkFiles(files).map(file => file.id).join(',') === 'work'
getImageSrcList(files).length === 1
```

- [ ] **Step 4: Commit only the helper**

```bash
git add src/composables/useFileHelpers.js
git commit -m "fix: exclude style snapshots from work previews"
```

## Task 2: Add Schema and Permission Foundations

**Files:**
- Modify: `standalone-server/config/database.js`
- Modify: `standalone-server/config/permissions.js`
- Modify: `src/utils/permissions.js`
- Test: `standalone-server/tests/unit/permissions.test.js`

- [ ] **Step 1: Add failing permission assertions**

```js
expect(defaultPermissionsFor('cs_agent')).toEqual(expect.arrayContaining([
  'cs.handoff.tasks',
  'cs.handoff.claim',
  'cs.shift.toggle'
]))
expect(defaultPermissionsFor('basic_designer')).not.toContain('cs.handoff.claim')
```

Run:

```bash
cd standalone-server
npx jest tests/unit/permissions.test.js --runInBand
```

Expected: fail because the new codes are absent.

- [ ] **Step 2: Add catalog/default/implication entries on backend and frontend**

```js
{ code: 'cs.handoff.tasks', name: '客服暂存任务', type: 'page', group: '客服基础美工' },
{ code: 'cs.handoff.claim', name: '继承客服暂存任务', type: 'action', group: '客服基础美工' },
{ code: 'cs.shift.toggle', name: '切换客服上线状态', type: 'action', group: '客服基础美工' }
```

Add all three to `ROLE_DEFAULTS.cs_agent` and mirror them in `ROLE_PERMISSION_FALLBACK.cs_agent`.

- [ ] **Step 3: Add idempotent schema fields to both engines**

SQLite create/alter definitions:

```sql
cs_shift_status TEXT DEFAULT 'online'
handoff_status TEXT DEFAULT ''
handoff_time TEXT
```

MySQL create/alter definitions:

```sql
cs_shift_status VARCHAR(20) DEFAULT 'online'
handoff_status VARCHAR(20) DEFAULT ''
handoff_time DATETIME NULL
```

Place `cs_shift_status` on `sys_user`; place the other fields on `task_info`. Follow the existing duplicate-column-tolerant alter loop and never run update statements that reset values.

- [ ] **Step 4: Run schema and permission tests**

```bash
cd standalone-server
npx jest tests/unit/permissions.test.js tests/api/task.test.js --runInBand
```

Expected: all tests pass and a twice-initialized SQLite test database retains changed field values.

- [ ] **Step 5: Commit foundations**

```bash
git add standalone-server/config/database.js standalone-server/config/permissions.js src/utils/permissions.js standalone-server/tests/unit/permissions.test.js
git commit -m "feat: add customer service handoff foundations"
```

## Task 3: Implement Customer-Service Handoff Backend

**Files:**
- Create: `standalone-server/services/cs-handoff.service.js`
- Create: `standalone-server/routes/task/task-handoff.js`
- Modify: `standalone-server/routes/task.js`
- Modify: `standalone-server/services/task.service.js`
- Modify: `standalone-server/dao/task.dao.js`
- Modify: `standalone-server/routes/auth.js`
- Test: `standalone-server/tests/api/cs-handoff.test.js`

- [ ] **Step 1: Write API failures first**

Cover these concrete cases with Supertest and the existing API setup helper:

```js
test('offline pools accepted doing rejected and draft but not wait or finished', async () => {})
test('accepting an offline publisher wait task pools it after assignment', async () => {})
test('offline customer service cannot create review or claim', async () => {})
test('claim changes publisher without changing status designer or files', async () => {})
test('two claims on one row produce one success and one conflict', async () => {})
test('pooled detail access does not grant access to ordinary foreign tasks', async () => {})
```

Run:

```bash
cd standalone-server
npx jest tests/api/cs-handoff.test.js --runInBand
```

Expected: fail with missing routes/service.

- [ ] **Step 2: Implement a focused service interface**

```js
async function getShiftStatus(user) {}
async function setShiftStatus(status, user) {}
async function listPooledTasks(query, user) {}
async function claimPooledTask(taskId, user) {}
async function assertCsActionAvailable(user, actionName) {}
async function poolAcceptedTaskIfPublisherOffline(conn, task) {}

module.exports = {
  getShiftStatus,
  setShiftStatus,
  listPooledTasks,
  claimPooledTask,
  assertCsActionAvailable,
  poolAcceptedTaskIfPublisherOffline
}
```

`setShiftStatus('offline')` must lock the user row and execute this semantic update in the same transaction:

```sql
UPDATE task_info
SET handoff_status = 'pooled', handoff_time = NOW(),
    publisher_id = NULL, publisher_name = '', update_time = NOW()
WHERE task_group = 'cs'
  AND publisher_id = ?
  AND status NOT IN ('wait', 'finished')
```

Use the project database adapter's SQLite-compatible `NOW()` normalization.

- [ ] **Step 3: Add authenticated routes**

```js
router.get('/cs-shift/status', requireAnyPermission(['cs.shift.toggle'], 'cs_agent'), handler)
router.post('/cs-shift/status', requireAnyPermission(['cs.shift.toggle'], 'cs_agent'), handler)
router.get('/cs-handoff', requireAnyPermission(['cs.handoff.tasks'], 'cs_agent', 'admin'), handler)
router.post('/cs-handoff/:taskId/claim', requireAnyPermission(['cs.handoff.claim'], 'cs_agent'), handler)
```

Mount `task-handoff.js` after `requireAuth` in `standalone-server/routes/task.js`.

- [ ] **Step 4: Apply service guards at existing mutation points**

Before customer-service task creation, review, batch review, and claim:

```js
if (user.role === 'cs_agent') {
  await csHandoffService.assertCsActionAvailable(user, '当前操作')
}
```

Inside `acceptTask`, after assigning a CS task but before transaction commit, call `poolAcceptedTaskIfPublisherOffline(conn, task)`.

- [ ] **Step 5: Make query behavior explicit**

- Exclude `handoff_status = 'pooled'` from customer-service `queryMyPublished`.
- Add `queryPooledCsTasks` with keyword/status pagination and files.
- Allow task detail only when the task is pooled and the requester has `cs.handoff.tasks`.
- Add `/cs/handoff-tasks` count to `visibleSidebarBadges`.

- [ ] **Step 6: Return shift state in authentication payloads**

Select `cs_shift_status` during login and refresh and return:

```js
csShiftStatus: user.role === 'cs_agent'
  ? (user.cs_shift_status || 'online')
  : undefined
```

Do not put shift state in authorization decisions based only on the JWT claim; mutation guards must read the current database value.

- [ ] **Step 7: Run focused and regression tests**

```bash
cd standalone-server
npx jest tests/api/cs-handoff.test.js tests/api/task.test.js tests/api/sidebar-badges.test.js --runInBand
```

Expected: all tests pass.

- [ ] **Step 8: Commit backend handoff**

```bash
git add standalone-server/services/cs-handoff.service.js standalone-server/routes/task/task-handoff.js standalone-server/routes/task.js standalone-server/services/task.service.js standalone-server/dao/task.dao.js standalone-server/routes/auth.js standalone-server/tests/api/cs-handoff.test.js
git commit -m "feat: add customer service task handoff"
```

## Task 4: Add Handoff Frontend and Global Shift Control

**Files:**
- Modify: `src/config/menus.js`
- Modify: `src/router/index.js`
- Create: `src/api/cs-handoff.js`
- Modify: `src/api/index.js`
- Modify: `src/store/index.js`
- Modify: `src/views/Layout.vue`
- Create: `src/views/cs/HandoffTasks.vue`
- Test: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: Add failing route and UI smoke assertions**

```js
await expect(page.getByText('暂存任务', { exact: true })).toBeVisible()
await expect(page.getByRole('button', { name: /已上线|已下线/ })).toBeVisible()
await page.getByText('暂存任务', { exact: true }).click()
await expect(page.getByRole('heading', { name: '暂存任务' })).toBeVisible()
```

Expected: fail because the menu, route, and page do not exist.

- [ ] **Step 2: Add menu and route**

```js
{ group: 'cs_basic', path: '/cs/handoff-tasks', icon: 'FolderOpened', label: '暂存任务', permission: 'cs.handoff.tasks' }
```

Register it immediately after `/cs/publish`.

- [ ] **Step 3: Add API/store state**

```js
export const getCsShiftStatusApi = () => request.get('/api/task/cs-shift/status')
export const setCsShiftStatusApi = status => taskMutation(request.post('/api/task/cs-shift/status', { status }))
export const getCsHandoffTasksApi = params => request.get('/api/task/cs-handoff', { params })
export const claimCsHandoffTaskApi = taskId => taskMutation(request.post(`/api/task/cs-handoff/${taskId}/claim`))
```

Add a store action that replaces `userInfo.csShiftStatus` and calls `setAuth` so refresh keeps the visible state.

- [ ] **Step 4: Implement the top-bar control**

Render only for `userStore.isCsAgent`. Use a compact Element Plus button/tag immediately beside the role tag. Click once to toggle; do not show a confirmation dialog. Disable during the request and show the backend moved-task count after going offline.

- [ ] **Step 5: Implement `HandoffTasks.vue`**

Use existing task table/detail patterns. Required controls and actions:

```js
const filters = reactive({ keyword: '', status: '', page: 1, pageSize: 15 })
async function loadTasks() {}
async function viewTask(row) {}
async function claimTask(row) {}
```

The claim button is disabled while the current user is offline. The page has no review/edit/delete buttons.

- [ ] **Step 6: Verify route, toggle, claim, and existing pages**

```bash
npx playwright test --config=playwright.task-pages.config.js tests/task-pages/task-page-features.spec.js
```

Expected: new smoke cases and existing task-page cases pass.

- [ ] **Step 7: Commit frontend handoff**

```bash
git add src/config/menus.js src/router/index.js src/api/cs-handoff.js src/api/index.js src/store/index.js src/views/Layout.vue src/views/cs/HandoffTasks.vue tests/task-pages/task-page-features.spec.js
git commit -m "feat: add customer service handoff interface"
```

## Task 5: Build the Style Image Editor Core

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/utils/background-removal.js`
- Create: `src/components/task/StyleImageEditor.vue`
- Modify: `src/views/shared/PublishTask.vue`

- [ ] **Step 1: Install the pinned canvas dependency**

```bash
npm install fabric@6.7.1 --save
```

Expected: only root `package.json` and `package-lock.json` dependency metadata change; do not run a build.

- [ ] **Step 2: Implement the pure edge-connected background algorithm**

Export this interface:

```js
export function removeConnectedBackground(imageData, tolerance = 42) {
  // Seed all four edges, flood only neighboring pixels within tolerance of
  // their edge seed color, and return a new ImageData with alpha set to zero.
}
```

Use an iterative queue rather than recursive flood fill to avoid stack overflow on large logos. Clamp tolerance to `0..255` and never mutate the caller's `ImageData`.

- [ ] **Step 3: Create the Fabric editor component**

Component contract:

```js
const props = defineProps({
  modelValue: Boolean,
  image: Object,
  savedScene: Object
})
const emit = defineEmits(['update:modelValue', 'save'])
```

`save` emits:

```js
{
  materialImageId: props.image.id,
  file: new File([blob], `${baseName}-效果图.png`, { type: 'image/png' }),
  previewUrl,
  scene: canvas.toJSON()
}
```

Required Fabric objects are `Rect`, `Ellipse`, `Polygon`, arrow line/head group, `IText`, and `FabricImage`. The “框选工具” select contains all four shapes. “添加内容” contains only text and image upload.

- [ ] **Step 4: Add editor behavior**

- Wheel zoom clamped to `0.2..5` and stop propagation so the page does not scroll.
- Fabric controls provide drag, proportional scale, and rotation.
- Buttons call `bringObjectForward`, `sendObjectBackwards`, `clone`, and `remove`.
- Keep a bounded undo/redo JSON stack.
- Transparent-background processing applies only to the selected uploaded image object and keeps its original pixel source for restoration.
- Revoke replaced object URLs on close/unmount.

- [ ] **Step 5: Integrate without changing publish semantics**

In `PublishTask.vue`, keep double-click opening. Replace the current read-only dialog with `StyleImageEditor`, and store edited results by material image ID:

```js
const editedMaterialImages = reactive(new Map())
function onEditorSave(result) {
  editedMaterialImages.set(result.materialImageId, result)
}
```

Thumbnail ordering and selection IDs remain based on `materialImages`; only the rendered preview URL changes when an edited result exists.

- [ ] **Step 6: Compile only the affected SFCs without building**

Use `@vue/compiler-sfc` to parse and compile:

```text
src/components/task/StyleImageEditor.vue
src/views/shared/PublishTask.vue
```

Expected: zero parse/template compilation errors.

- [ ] **Step 7: Commit editor core**

```bash
git add package.json package-lock.json src/utils/background-removal.js src/components/task/StyleImageEditor.vue src/views/shared/PublishTask.vue
git commit -m "feat: add task-local style image editor"
```

## Task 6: Save Ordered Original and Edited Style Snapshots

**Files:**
- Create: `standalone-server/routes/task/task-style-snapshot.js`
- Create: `standalone-server/services/task-style-snapshot.service.js`
- Modify: `standalone-server/routes/task.js`
- Modify: `src/api/task.js`
- Modify: `src/views/shared/PublishTask.vue`
- Test: `standalone-server/tests/api/task-style-snapshot.test.js`

- [ ] **Step 1: Add failing API tests**

```js
test('copies originals and edited PNGs in manifest order', async () => {})
test('does not change accepted task status while saving style files', async () => {})
test('rejects material images from another style', async () => {})
test('rolls back records and disk files when one manifest item fails', async () => {})
```

- [ ] **Step 2: Define the manifest**

Frontend sends multipart field `manifest`:

```json
[
  { "materialImageId": 14, "position": 0, "editedField": "" },
  { "materialImageId": 15, "position": 1, "editedField": "edited-15" }
]
```

An edited file is appended with the exact `editedField` key. The backend validates task ownership, task group, style membership, unique positions, image MIME type, and selected-image uniqueness.

- [ ] **Step 3: Save snapshots without task-state side effects**

The service must:

```js
async function saveTaskStyleSnapshots({ taskId, materialStyleId, manifest, files, user }) {}
```

- lock/validate the task;
- remove only existing `file_category = 'style'` files for a retry;
- copy unedited material files;
- save edited PNG buffers;
- insert `task_file` records sequentially in manifest order;
- never call `updateTaskStatus`;
- delete newly written disk files if the transaction fails.

- [ ] **Step 4: Switch publish submission to the manifest API**

Replace the existing simple snapshot call with:

```js
await saveStyleSnapshotsApi({
  taskId,
  materialStyleId: materialStyleId.value,
  images: selectedMaterialImages.value.map((image, position) => ({
    image,
    position,
    edited: editedMaterialImages.get(image.id)
  }))
})
```

- [ ] **Step 5: Run focused API tests**

```bash
cd standalone-server
npx jest tests/api/task-style-snapshot.test.js tests/api/material-library.test.js tests/api/task.test.js --runInBand
```

Expected: all tests pass and task status is unchanged.

- [ ] **Step 6: Commit snapshot flow**

```bash
git add standalone-server/routes/task/task-style-snapshot.js standalone-server/services/task-style-snapshot.service.js standalone-server/routes/task.js src/api/task.js src/views/shared/PublishTask.vue standalone-server/tests/api/task-style-snapshot.test.js
git commit -m "feat: persist edited style snapshots per task"
```

## Task 7: Implement Deterministic Batch Filename Resolution

**Files:**
- Create: `standalone-server/services/batch-submit.service.js`
- Create: `standalone-server/routes/task/task-batch-submit.js`
- Modify: `standalone-server/routes/task.js`
- Modify: `src/api/task.js`
- Test: `standalone-server/tests/unit/batch-submit-matcher.test.js`

- [ ] **Step 1: Write matcher tests first**

```js
test('full task number wins even when filename also contains a wangwang id', () => {})
test('unique wangwang id is used only when no task number exists', () => {})
test('duplicate wangwang ids return conflict', () => {})
test('multiple task numbers return conflict', () => {})
test('doing finished foreign and non-cs tasks are not candidates', () => {})
```

- [ ] **Step 2: Implement a pure matcher**

```js
function resolveBatchFiles(files, candidateTasks) {
  return {
    groups: [],
    unresolved: []
  }
}
```

Each result keeps `clientId`, `name`, `matchedBy: 'task_no' | 'wangwang_id'`, task identity, or a stable reason code such as `multiple_task_numbers`, `duplicate_wangwang`, `not_found`, or `invalid_type`.

- [ ] **Step 3: Add the resolve route**

```js
router.post('/batch-submit/resolve', requireAnyPermission(['task.upload.work'], 'basic_designer'), async (req, res, next) => {})
```

Accept at most 500 file descriptors per resolve request, but no file bytes. Query only current user's `accepted`/`rejected` CS tasks and return groups in the original file order.

- [ ] **Step 4: Verify matcher and task regressions**

```bash
cd standalone-server
npx jest tests/unit/batch-submit-matcher.test.js tests/api/task.test.js --runInBand
```

Expected: all tests pass.

- [ ] **Step 5: Commit matcher**

```bash
git add standalone-server/services/batch-submit.service.js standalone-server/routes/task/task-batch-submit.js standalone-server/routes/task.js src/api/task.js standalone-server/tests/unit/batch-submit-matcher.test.js
git commit -m "feat: resolve batch work files by task identity"
```

## Task 8: Add the Basic-Designer Batch Submit Panel

**Files:**
- Create: `src/components/basic/BatchWorkSubmit.vue`
- Modify: `src/views/Layout.vue`
- Test: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: Add a failing Playwright flow**

Assert that the control is absent for customer service and visible for basic designers. For a basic designer, add files named with two task numbers and verify two groups with independent score inputs.

- [ ] **Step 2: Build the anchored panel**

State shape:

```js
const state = reactive({
  visible: false,
  files: [],
  groups: [],
  unresolved: [],
  results: [],
  resolving: false,
  submitting: false
})
```

Keep a `Map<clientId, File>` locally and send only descriptors during resolve:

```js
files.map(file => ({ clientId: file.uid, name: file.name, size: file.size, type: file.type }))
```

- [ ] **Step 3: Validate and group before upload**

- Accept images only.
- Validate existing per-file size configuration.
- Validate existing maximum file count per task after server grouping.
- Let users remove any file and re-resolve.
- Default each task score to `1`, preserving edits when re-resolving unchanged groups.

- [ ] **Step 4: Submit with bounded per-task concurrency**

Use two concurrent task requests. For each group call existing `uploadFilesApi(taskId, files, 'work', { appliedScore })`. Do not submit unresolved files. A group becomes successful only when the request returns `code === 0`; keep failed group files and score for retry.

- [ ] **Step 5: Refresh normal task views**

Successful uploads already emit `nexus:task-updated`. After the batch ends, refresh sidebar counts and leave the result panel open with per-task messages.

- [ ] **Step 6: Run affected UI tests and SFC compilation**

```bash
npx playwright test --config=playwright.task-pages.config.js tests/task-pages/task-page-features.spec.js
```

Expected: batch UI and existing basic-designer upload/detail flows pass.

- [ ] **Step 7: Commit batch UI**

```bash
git add src/components/basic/BatchWorkSubmit.vue src/views/Layout.vue tests/task-pages/task-page-features.spec.js
git commit -m "feat: add basic designer batch work submission"
```

## Task 9: Final Regression and Local Runtime Verification

**Files:**
- Modify only if a verified regression requires a focused fix.

- [ ] **Step 1: Run backend suites**

```bash
cd standalone-server
npm test -- --runInBand
```

Expected: zero failed suites and zero failed tests.

- [ ] **Step 2: Run task-page Playwright tests**

```bash
npm run test:task-pages
```

Expected: zero failed tests. Record unrelated pre-existing failures separately instead of changing unrelated behavior.

- [ ] **Step 3: Run source-level SFC compilation**

Compile every changed Vue SFC with `@vue/compiler-sfc`. Expected: zero parse/template compilation errors.

- [ ] **Step 4: Exercise the local-only workflow manually**

Use frontend `http://127.0.0.1:5173/` and backend `http://127.0.0.1:18632/` with `.local-dev-data/design.db`:

1. Toggle a customer-service account offline and verify the exact pool range.
2. Accept one of that account's waiting tasks and verify automatic pooling.
3. Claim it from another online customer-service account.
4. Edit a selected style image, remove a white logo background, publish, and inspect the task snapshot.
5. Batch-submit two tasks plus one ambiguous Wangwang-ID file and verify partial handling.

- [ ] **Step 5: Confirm production isolation and diff scope**

```bash
git status --short
git diff --check
```

Confirm no production connection string, production database, `dist`, or `release` output changed.

- [ ] **Step 6: Commit any final focused regression fixes**

Stage only files changed for a reproduced regression and use a scoped local commit. Do not push.
