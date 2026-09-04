# 客服与基础美工效果图、原图及审核流程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为客服与基础美工任务增加清晰的效果图/原图区分、待上传原图状态和分批原图上传完成流程，同时保持其他角色原有任务逻辑不变。

**Architecture:** 复用现有 `task_info` 与 `task_file`，新增文本状态 `pending_original` 和文件类别 `original`。后端以任务组和任务归属做强校验，前端通过文件选择器区分首次作品、最新效果图和原图；客服/基础美工页面使用新的显示能力，其他角色继续走原有字段与状态。

**Tech Stack:** Node.js、Express、SQLite/MySQL 双引擎、Vue 3、Element Plus、Playwright、Jest。

---

## 文件地图

- Create: `standalone-server/services/task-file-view.js`：后端文件类别和效果图选择纯函数。
- Create: `standalone-server/tests/unit/task-file-view.test.js`：后端文件选择器测试。
- Create: `standalone-server/tests/api/task-original-upload.test.js`：原图状态和接口集成测试。
- Modify: `standalone-server/services/task.service.js`：客服通过状态、原图上传/完成、任务动作授权。
- Modify: `standalone-server/routes/task/task-action.js`：原图上传与完成上传路由及 multer 处理。
- Modify: `standalone-server/dao/task.dao.js`：任务文件锁定、原图查询和统计状态筛选。
- Modify: `standalone-server/utils/notification.js`：待上传原图通知映射（仅补充显示事件，不改既有事件语义）。
- Modify: `src/utils/format.js`：前端状态标签和详情头部时间。
- Modify: `src/composables/useFileHelpers.js`：前端首次作品、效果图、原图选择器。
- Create: `src/components/task/OriginalUploadPanel.vue`：原图分批上传和完成上传面板。
- Modify: `src/components/TaskDetail.vue`：客服/基础美工详情的首次上传、原图和待上传面板。
- Modify: `src/components/TaskDetailImage.vue`：完整比例、拖出和原始文件预览处理。
- Modify: `src/components/task/CsModificationRecords.vue`：新增修改区实时缩略图。
- Modify: `src/views/shared/Review.vue`：客服审核修改入口、效果图/原图列和新状态操作。
- Modify: `src/views/shared/MyTasksPub.vue`：客服我的任务效果图/原图列和状态操作。
- Modify: `src/views/cs/HandoffTasks.vue`：暂存任务效果图列。
- Modify: `src/views/shared/TaskHall.vue`：基础美工任务大厅效果图/原图列。
- Modify: `src/views/basic/MyTasks.vue`：基础美工我的/待做/待审核列表及原图入口。
- Modify: `src/views/admin/AllTasks.vue`：客服/基础美工全量任务的款式图与作品图列（只在目标任务组显示）。
- Modify: `src/api/upload.js`：通用文件拖出和预览 URL 统一处理。
- Modify: `src/api/index.js` 或其实际导出文件：原图上传 API 导出。
- Modify: `standalone-server/tests/unit/task-state-machine.test.js`：补充 `pending_original` 转换规则。
- Modify: `tests/task-pages/task-page-features.spec.js`：目标页面回归断言。

## Task 1: 建立状态和文件选择器的可测试边界

**Files:**
- Create: `standalone-server/services/task-file-view.js`
- Create: `standalone-server/tests/unit/task-file-view.test.js`
- Modify: `standalone-server/tests/unit/task-state-machine.test.js`
- Modify: `src/utils/format.js`
- Modify: `src/composables/useFileHelpers.js`

- [ ] **Step 1: Write failing backend selector tests**

```js
const { getInitialWorkFiles, getEffectFiles, getOriginalFiles } = require('../../services/task-file-view');

test('效果图优先取最新已完成修改轮次', () => {
  const files = [
    { id: 1, file_category: 'work', file_type: 'image', reject_record_id: null },
    { id: 2, file_category: 'work', file_type: 'image', reject_record_id: 3, reject_index: 3 },
    { id: 3, file_category: 'work', file_type: 'image', reject_record_id: 2, reject_index: 2 },
    { id: 4, file_category: 'original', file_type: 'attachment' }
  ];
  expect(getInitialWorkFiles(files).map(file => file.id)).toEqual([1]);
  expect(getEffectFiles(files).map(file => file.id)).toEqual([2]);
  expect(getOriginalFiles(files).map(file => file.id)).toEqual([4]);
});

test('没有修改作品时效果图回退到首次作品', () => {
  const files = [{ id: 1, file_category: 'work', file_type: 'image', reject_record_id: null }];
  expect(getEffectFiles(files).map(file => file.id)).toEqual([1]);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `cd standalone-server; npm test -- --runInBand tests/unit/task-file-view.test.js`

Expected: FAIL because `task-file-view.js` and its selectors do not exist.

- [ ] **Step 3: Implement the backend selector module**

```js
function normalizeFiles(files) {
  return Array.isArray(files) ? files.filter(Boolean) : [];
}

function initialWorkFiles(files) {
  return normalizeFiles(files)
    .filter(file => file.file_category === 'work' && !Number(file.reject_record_id));
}

function modificationWorkFiles(files) {
  return normalizeFiles(files)
    .filter(file => file.file_category === 'work' && Number(file.reject_record_id) > 0)
    .sort((left, right) => {
      const roundDiff = (Number(right.reject_index) || Number(right.reject_record_id) || 0)
        - (Number(left.reject_index) || Number(left.reject_record_id) || 0);
      return roundDiff || Number(left.id || 0) - Number(right.id || 0);
    });
}

function getInitialWorkFiles(files) {
  return initialWorkFiles(files);
}

function getEffectFiles(files) {
  const modifications = modificationWorkFiles(files);
  return modifications.length ? modifications : initialWorkFiles(files);
}

function getOriginalFiles(files) {
  return normalizeFiles(files)
    .filter(file => file.file_category === 'original')
    .sort((left, right) => new Date(left.create_time || 0) - new Date(right.create_time || 0)
      || Number(left.id || 0) - Number(right.id || 0));
}

module.exports = { getInitialWorkFiles, getEffectFiles, getOriginalFiles };
```

- [ ] **Step 4: Run the selector test and confirm it passes**

Run: `cd standalone-server; npm test -- --runInBand tests/unit/task-file-view.test.js`

Expected: PASS with both selector cases passing.

- [ ] **Step 5: Extend state-machine and frontend labels**

Update `pending_original` in the state fixture so it accepts only `finished`, is not reviewable, not deletable/transferrable after completion, and is not counted as finished. Add the exact frontend mappings:

```js
// src/utils/format.js
export const STATUS_MAP = {
  wait: '待接单', accepted: '已接单', doing: '待审核',
  pending_original: '待上传原图', finished: '已完成',
  rejected: '修改中', draft: '草稿'
}

export const STATUS_TAG_TYPE = {
  wait: 'info', accepted: 'warning', doing: 'primary',
  pending_original: 'warning', finished: 'success',
  rejected: 'danger', draft: ''
}
```

Update `getTaskHeaderTime` so `pending_original` uses `finish_time || update_time` with label `待上传原图时间` and does not affect other statuses.

- [ ] **Step 6: Add frontend file selectors without changing existing callers**

In `useFileHelpers.js`, exclude `file_category === 'original'` from `isCurrentWorkFile`; add `getInitialWorkFiles`, `getEffectFiles`, and `getOriginalFiles` that mirror the backend rules. Keep `getWorkFiles` as a compatibility alias for existing non-target pages.

- [ ] **Step 7: Run existing unit tests**

Run: `cd standalone-server; npm test -- --runInBand tests/unit/task-state-machine.test.js tests/unit/task-file-view.test.js`

Expected: PASS, with existing transitions unchanged except for the explicit new pending-original path.

- [ ] **Step 8: Commit the selector boundary**

```bash
git add standalone-server/services/task-file-view.js standalone-server/tests/unit/task-file-view.test.js standalone-server/tests/unit/task-state-machine.test.js src/utils/format.js src/composables/useFileHelpers.js
git commit -m "feat: separate task effect and original file selectors"
```

## Task 2: Implement backend pending-original workflow and APIs

**Files:**
- Modify: `standalone-server/services/task.service.js`
- Modify: `standalone-server/routes/task/task-action.js`
- Modify: `standalone-server/dao/task.dao.js`
- Modify: `standalone-server/utils/notification.js`
- Create: `standalone-server/tests/api/task-original-upload.test.js`

- [ ] **Step 1: Add API test fixtures and failing workflow tests**

Create a CS task with a basic designer, insert one initial `work` image, call the existing review endpoint, and assert the new status and access rules:

```js
test('客服通过后进入待上传原图且不立即完成', async () => {
  const response = await request(app)
    .post('/api/task/review')
    .set(authHeader(csUser))
    .send({ taskId, action: 'pass' });
  expect(response.body.code).toBe(0);
  const task = await readTask(taskId);
  expect(task.status).toBe('pending_original');
  expect(task.score_review_status).not.toBe('pending');
});

test('原图可分批上传，完成上传后才变为已完成', async () => {
  const first = await request(app).post('/api/task/upload-original')
    .set(authHeader(basicUser)).field('taskId', taskId)
    .attach('files', fixture('source-a.psd'));
  expect(first.body.code).toBe(0);
  expect((await readTask(taskId)).status).toBe('pending_original');

  const completed = await request(app).post('/api/task/complete-original-upload')
    .set(authHeader(basicUser)).send({ taskId });
  expect(completed.body.code).toBe(0);
  expect((await readTask(taskId)).status).toBe('finished');
});
```

- [ ] **Step 2: Run the API test to verify it fails**

Run: `cd standalone-server; npm test -- --runInBand tests/api/task-original-upload.test.js`

Expected: FAIL because the review path still writes `finished` and the new endpoints do not exist.

- [ ] **Step 3: Add service authorization and original upload implementation**

Add these service functions beside `uploadFiles` and export them:

```js
async function uploadOriginalFiles(taskId, files, user) {
  if (!taskId || !Array.isArray(files) || files.length === 0) throw new AppError(400, '请选择原图文件');
  const storedPaths = [];
  try {
    await executeTransaction(async conn => {
      const task = await taskDao.getTaskForUpdate(conn, taskId);
      if (!task || task.task_group !== 'cs') throw new AppError(400, '仅客服任务支持上传原图');
      if (task.status !== 'pending_original') throw new AppError(400, '当前任务不在待上传原图状态');
      if (Number(task.designer_id) !== Number(user.id) || user.role !== 'basic_designer') {
        throw new AppError(403, '无权上传此任务原图');
      }
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      for (const file of files) {
        file.originalname = fixFilenameEncoding(file.originalname);
        const ext = path.extname(file.originalname).toLowerCase();
        const fileType = IMAGE_EXTS.includes(ext) ? 'image' : 'attachment';
        const filePath = fileType === 'image'
          ? saveImage('cs', dateStr, path.basename(file.path), fs.readFileSync(file.path))
          : saveAttachment('cs', dateStr, path.basename(file.path), file.path);
        storedPaths.push(filePath);
        await taskDao.insertFileRecord(conn, {
          taskId, fileName: file.originalname, filePath, fileSize: file.size,
          fileType, mimeType: file.mimetype || '', uploaderId: user.id,
          fileCategory: 'original', rejectRecordId: null
        });
        try { fs.unlinkSync(file.path); } catch (_) {}
      }
    });
  } catch (error) {
    for (const storedPath of storedPaths) {
      const absolutePath = resolvePath(storedPath);
      if (absolutePath && fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    }
    for (const file of files) {
      try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
    }
    throw error;
  }
  socketEmit('group:cs');
  return { msg: `原图上传成功(${files.length}个文件)` };
}

async function completeOriginalUpload(taskId, user) {
  return withLock(`original-upload:${taskId}`, async () => {
    let taskBrief = null;
    await executeTransaction(async conn => {
      const task = await taskDao.getTaskForUpdate(conn, taskId);
      if (!task || task.task_group !== 'cs') throw new AppError(400, '仅客服任务支持完成原图上传');
      if (Number(task.designer_id) !== Number(user.id) || user.role !== 'basic_designer') {
        throw new AppError(403, '无权完成此任务原图上传');
      }
      if (task.status === 'finished') return;
      if (task.status !== 'pending_original') throw new AppError(400, '当前任务不能完成原图上传');
      const [files] = await conn.execute(
        `SELECT id FROM task_file WHERE task_id = ? AND file_category = 'original' LIMIT 1`, [taskId]
      );
      if (!files.length) throw new AppError(400, '请至少上传一个原图文件');
      await taskDao.updateTaskStatus(conn, taskId, 'finished', {
        finish_time: new Date(), urge_time: null,
        score_review_status: Number(task.applied_score) > 1 ? 'pending' : '',
        score_review_reason: '', score_review_time: null, score_review_score: 0
      });
      taskBrief = { ...task, id: taskId, status: 'finished' };
    });
    if (taskBrief) {
      await notifyTaskEvent('task_review_pass', taskBrief, user);
      socketEmit(`user:${taskBrief.publisher_id}`);
      socketEmit('group:cs');
    }
    return { msg: '原图上传已完成，任务已完成' };
  });
}
```

The service must delete only `original` records during an original-file replacement/cleanup path; existing work and modification deletion behavior remains unchanged.

- [ ] **Step 4: Change single and batch CS review transitions**

In `reviewTask`, replace the CS pass branch with `status = 'pending_original'`, keep `finish_time` unset until completion, and leave score review empty. In `batchReview`, use a `CASE` expression so only `task_group = 'cs'` rows become `pending_original`; design/operator rows remain `finished`.

```sql
status = CASE WHEN task_group = 'cs' THEN 'pending_original' ELSE 'finished' END,
finish_time = CASE WHEN task_group = 'cs' THEN NULL ELSE NOW() END
```

Return the message `审核通过，等待上传原图` for CS tasks and retain the existing message for other groups.

- [ ] **Step 5: Add multer routes with source-file support**

In `task-action.js`, add routes before the generic `/upload` route. The routes use the existing temp-directory pattern, reject path traversal, and accept the configured attachment extensions including PSD/AI/ZIP:

```js
router.post('/upload-original', requireAnyPermission(['task.upload.work'], 'basic_designer'), (req, res, next) => {
  const upload = buildTaskUploadMiddleware({ field: 'files', maxFiles: getMaxFileCount() });
  upload.array('files', getMaxFileCount())(req, res, async err => {
    if (err) return res.json({ code: 400, msg: err.message });
    try {
      const result = await taskService.uploadOriginalFiles(Number(req.body.taskId), req.files || [], req.user);
      res.json({ code: 0, ...result });
    } catch (error) { cleanupUploadedTempFiles(req.files); next(error); }
  });
});

router.post('/complete-original-upload', requireAnyPermission(['task.upload.work'], 'basic_designer'), async (req, res, next) => {
  try {
    const result = await taskService.completeOriginalUpload(Number(req.body.taskId), req.user);
    res.json({ code: 0, ...result });
  } catch (error) { next(error); }
});
```

- [ ] **Step 6: Update queries, notifications, and exports**

Update task list status filters to include `pending_original` for the assigned basic designer and the CS publisher. Add the status label/color to any server-side export map and sidebar counts, while excluding `pending_original` from finished counts and score-review counts until completion. Keep non-CS filters exactly as before.

- [ ] **Step 7: Run the API test and the complete backend suite**

Run: `cd standalone-server; npm test -- --runInBand tests/api/task-original-upload.test.js`

Expected: PASS for single review, batch review, split upload, completion, empty completion rejection, wrong-user rejection, wrong-status rejection, and rollback cleanup.

Run: `npm test -- --runInBand`

Expected: all existing backend suites PASS with no production database connection.

- [ ] **Step 8: Commit backend workflow**

```bash
git add standalone-server/services/task.service.js standalone-server/routes/task/task-action.js standalone-server/dao/task.dao.js standalone-server/utils/notification.js standalone-server/tests/api/task-original-upload.test.js
git commit -m "feat: add pending original upload workflow"
```

## Task 3: Add shared original-file upload and detail media components

**Files:**
- Create: `src/components/task/OriginalUploadPanel.vue`
- Modify: `src/components/TaskDetail.vue`
- Modify: `src/components/TaskDetailImage.vue`
- Modify: `src/components/task/CsModificationRecords.vue`
- Modify: `src/api/upload.js`
- Modify: `src/api/index.js` or its current API barrel

- [ ] **Step 1: Add frontend API functions and write component tests/fixtures**

Expose two functions with the existing axios wrapper:

```js
export function uploadOriginalFiles(taskId, files, onUploadProgress) {
  const form = new FormData();
  form.append('taskId', String(taskId));
  files.forEach(file => form.append('files', file));
  return http.post('/api/task/upload-original', form, {
    onUploadProgress, headers: { 'Content-Type': 'multipart/form-data' }
  });
}

export function completeOriginalUpload(taskId) {
  return http.post('/api/task/complete-original-upload', { taskId });
}
```

- [ ] **Step 2: Implement `OriginalUploadPanel.vue`**

The panel maintains `pendingFiles`, `uploadedFiles`, and `uploading`; it accepts click, drag/drop, and multiple files; it uploads a selected batch, keeps already-uploaded files, disables “完成上传” until the server reports at least one original, and emits `completed` after a successful completion call. Every local file preview uses `URL.createObjectURL` and is revoked on removal/unmount. Images use `contain`; non-images use an extension badge. Each item calls `setupFileDrag` with the server file object once uploaded.

- [ ] **Step 3: Update `TaskDetail.vue` media sections**

For `taskGroup === 'cs'` and contexts `cs-assignee`, `review`, `published`, `handoff`, or `admin`, render a two-column media row: style images on the left and `getOriginalFiles(task.files)` on the right. Rename the existing work label to `首次上传`, keep modification history below, and render `OriginalUploadPanel` only when `task.status === 'pending_original'` and the current user is the assigned basic designer. Do not change fields for operator, operator-assistant, or designer contexts.

- [ ] **Step 4: Fix preview sizing and drag-out**

Change task-detail/list preview image styles from `object-fit: cover` to `contain`, preserve stable aspect-ratio boxes, and keep `preview-teleported`. In `TaskDetailImage.vue`, pass the original `file_name` and `downloadUrl` into `setupFileDrag`; in `upload.js`, ensure `DownloadURL`, `text/uri-list`, and Electron cache paths use the same original file name for images and attachments.

- [ ] **Step 5: Add real-time thumbnails to modification uploads**

In `CsModificationRecords.vue`, render pending local image files below the dropzone using object URLs immediately after `onFileChange`, drag, or paste. Keep filename cards for non-image files, preserve delete/retry behavior, and never replace saved round files until the existing “完成” request succeeds.

- [ ] **Step 6: Run frontend lint/build-free checks**

Run: `npm run test:task-pages -- --grep "详情|修改|上传"`

Expected: existing task-page scenarios pass; no build command is run in this task.

- [ ] **Step 7: Commit shared media components**

```bash
git add src/components/task/OriginalUploadPanel.vue src/components/TaskDetail.vue src/components/TaskDetailImage.vue src/components/task/CsModificationRecords.vue src/api/upload.js src/api/index.js
git commit -m "feat: add original upload panel and clear task previews"
```

## Task 4: Update客服、基础美工 and暂存任务 lists

**Files:**
- Modify: `src/views/shared/Review.vue`
- Modify: `src/views/shared/MyTasksPub.vue`
- Modify: `src/views/cs/HandoffTasks.vue`
- Modify: `src/views/shared/TaskHall.vue`
- Modify: `src/views/basic/MyTasks.vue`
- Modify: `src/views/admin/AllTasks.vue`

- [ ] **Step 1: Add shared list render helpers**

Use the new `getEffectFiles` and `getOriginalFiles` selectors. Render the first image with a `contain` thumbnail and preview source list; render non-image originals as a draggable file badge. Do not call `getWorkFiles` for the new effect/original columns.

- [ ] **Step 2: Update客服审核 actions**

In `Review.vue`, add a `修改` link button beside `通过` for CS tasks. It opens the existing detail overlay, sets an `openModification` flag, and after `nextTick` calls the modification component’s `openNewModification()` method. The button is visible only when the row is reviewable and the user already has the CS review permission. Existing `查看作品`, `通过`, and batch review behavior remains.

- [ ] **Step 3: Update客服/basic list columns and status actions**

Replace labels exactly:

```vue
<el-table-column label="效果图" ... />
<el-table-column label="原图" ... />
```

Change `上传作品` text to `上传`. For `pending_original`, show `原图` and open the detail upload panel; hide ordinary work submission controls for that status. Add `pending_original` to status filters and use `STATUS_MAP` for labels.

- [ ] **Step 4: Add effect preview to暂存任务**

In `HandoffTasks.vue`, add an `效果图` column after the style image column. Use the latest effect selector and keep the existing `查看` and `继承` actions unchanged. A missing effect image renders `-`.

- [ ] **Step 5: Update basic task hall and all-task columns**

In `TaskHall.vue` and `AllTasks.vue`, for CS/basic task groups replace the target columns with `款式图` and `作品图`; render effect and original previews inside the 作品图 cell. Keep operator/designer columns and row actions unchanged.

- [ ] **Step 6: Add frontend route refresh behavior**

After original upload or completion, close/reload the detail overlay and refresh the current list without resetting persisted filters or pagination. Socket updates must update only the affected row.

- [ ] **Step 7: Run Playwright task-page tests**

Run: `npm run test:task-pages`

Expected: all existing task-page scenarios pass, including CS review, basic task views, handoff, and detail overlays.

- [ ] **Step 8: Commit target list changes**

```bash
git add src/views/shared/Review.vue src/views/shared/MyTasksPub.vue src/views/cs/HandoffTasks.vue src/views/shared/TaskHall.vue src/views/basic/MyTasks.vue src/views/admin/AllTasks.vue
git commit -m "feat: show effect and original previews in cs basic lists"
```

## Task 5: Regression tests, quality checks, and local verification

**Files:**
- Modify: `tests/task-pages/task-page-features.spec.js`
- Modify: `standalone-server/tests/api/task-original-upload.test.js` if coverage gaps are found
- No production files or database paths

- [ ] **Step 1: Add Playwright assertions for the new labels and state**

Add mocked rows covering an effect image, an original image, a PSD/ZIP original, and `pending_original`; assert visible labels `效果图`, `原图`, `待上传原图`, and `上传/原图` without asserting unrelated role pages.

- [ ] **Step 2: Add API edge-case assertions**

Cover: empty completion rejected; non-basic user rejected; non-CS task rejected; upload while `doing` rejected; duplicate completion returns a stable success/error without duplicate status changes; original files remain after effect work cleanup.

- [ ] **Step 3: Run all required verification**

Run:

```bash
cd standalone-server; npm test -- --runInBand
cd ..; npm run test:task-pages
git diff --check
git status --short
```

Expected: backend and task-page suites pass, diff check is clean, and only intended source/docs changes plus the user’s pre-existing material-library/local-data changes are present.

- [ ] **Step 4: Check local-only runtime safety**

Confirm the local backend is using `.local-dev-data/design.db` and the local frontend points to `127.0.0.1:18632`; do not run migration against MySQL, do not touch production paths, and do not run `npm run build` or any packaging command.

- [ ] **Step 5: Restart only local development servers**

Stop and restart the local backend/frontend processes on ports `18632` and `18634`, then verify:

```text
GET http://127.0.0.1:18632/api/health -> HTTP 200
GET http://127.0.0.1:18634/ -> HTTP 200
```

- [ ] **Step 6: Commit the final implementation**

```bash
git add standalone-server src tests
git commit -m "feat: complete cs basic original upload workflow"
```

Do not push any commit to a remote repository and do not create a production build unless the user separately requests it.
