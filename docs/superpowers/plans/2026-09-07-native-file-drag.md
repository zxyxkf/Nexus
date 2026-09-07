# Native Desktop File Drag Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every file that currently supports desktop dragging work as a real local-file drag into WeCom, Photoshop, and similar Windows applications, while applying task-number names only for客服 and基础美工 users.

**Architecture:** Keep the existing Electron temporary-file cache and `webContents.startDrag()` path. Extend file metadata with `task_no`, derive a safe drag filename in the frontend from the authenticated role (with an explicit override available to callers), preload using that filename, and prevent Electron from falling back to URL/text drag data when the cache is not ready.

**Tech Stack:** Vue 3, Electron IPC, Node.js filesystem APIs, existing Playwright and Jest suites.

---

### Task 1: Make task numbers available on task files

**Files:**
- Modify: `standalone-server/dao/task.dao.js:73-161`
- Modify: `standalone-server/routes/task/helpers.js:39-58`

- [ ] **Step 1: Extend list file projection**

Change the list query from `SELECT tf.* FROM task_file tf` to join `task_info` and select `t.task_no`:

```js
const [files] = await pool.execute(
  `SELECT tf.*, t.task_no
   FROM task_file tf
   INNER JOIN task_info t ON t.id = tf.task_id
   LEFT JOIN task_reject_record tr ON tr.id = tf.reject_record_id
   WHERE tf.task_id IN (${placeholders})
   ORDER BY tf.create_time ASC, tf.id ASC`,
  taskIds
);
```

- [ ] **Step 2: Extend detail and modification-history file projections**

Apply the same `INNER JOIN task_info t` and `t.task_no` selection in `getTaskFiles()` and the reject-record file query. Preserve all existing `fileUrl`, `downloadUrl`, ordering, and reject metadata.

- [ ] **Step 3: Keep the shared route helper consistent**

Update `standalone-server/routes/task/helpers.js` so any caller of its `attachFilesToTasks()` also receives `task_no` without changing its response shape otherwise.

- [ ] **Step 4: Run the backend task tests**

Run from `standalone-server`:

```powershell
npm test -- --runInBand tests/unit/task-file-view.test.js tests/api/task.test.js
```

Expected: all selected suites pass; no schema or business-flow changes are introduced.

### Task 2: Add role-aware safe drag filename resolution

**Files:**
- Modify: `src/api/upload.js:1-290`
- Modify: `src/App.vue:1-50`

- [ ] **Step 1: Add filename helpers**

Import `getUser` and add helpers with these rules:

```js
const TASK_NUMBER_ROLES = new Set(['cs_agent', 'basic_designer'])

function getDragNamingMode(options = {}) {
  if (options.namingMode === 'task' || options.namingMode === 'original') {
    return options.namingMode
  }
  return TASK_NUMBER_ROLES.has(getUser()?.role) ? 'task' : 'original'
}

function getFileExtension(fileName = '') {
  const match = String(fileName).match(/(\.[^./\\]+)$/)
  return match ? match[1] : ''
}

function getDragFileName(file, options = {}) {
  const originalName = file?.file_name || `file-${file?.id || 'download'}`
  if (getDragNamingMode(options) !== 'task') return originalName
  const taskNo = String(options.taskNo || file?.task_no || file?.taskNo || '').trim()
  if (!taskNo) return originalName
  return `${taskNo}${getFileExtension(originalName)}`
}
```

The existing `sanitizeDragFileName()` remains the final Windows filename sanitizer. The helper must never alter the server-side `file_name`.

- [ ] **Step 2: Thread the desired name through preloading**

Change `prepareFileDragCache(file)` and `preloadFilesForDrag(files, options)` so each IPC item sends the resolved output name as `fileName`, while `downloadPath` remains the existing API path. Key the in-flight preload set by `file.id + fileName` so switching between original/task naming cannot suppress a needed cache refresh. For task-number mode, keep a renderer-side map keyed by `task_no + file.id`; the first file gets `task_no`, subsequent files get `task_no_1`, `task_no_2`, and so on, regardless of extension. This makes names stable across repeated drags while preserving each file's extension.

- [ ] **Step 3: Use the resolved name in native drag readiness checks**

Change `tryElectronFileDrag(file, options)` to call:

```js
const fileName = getDragFileName(file, options)
if (window.electronAPI.isFileCached?.({ fileId: file.id, fileName })) {
  return Boolean(window.electronAPI.doFileDrag?.({ fileId: file.id }))
}
prepareFileDragCache(file, options)
return false
```

- [ ] **Step 4: Prevent URL fallback in Electron**

In `setupFileDrag(event, file, options = {})`, branch before `applyFileDragData()`:

```js
if (window.electronAPI?.doFileDrag) {
  if (tryElectronFileDrag(file, options)) {
    event?.preventDefault?.()
    return ''
  }
  event?.preventDefault?.()
  window.dispatchEvent(new CustomEvent('nexus:file-drag-pending'))
  return ''
}
return applyFileDragData(event, file)
```

This keeps browser behavior unchanged, but ensures Electron never sends an authenticated URL to a local target when its local copy is not ready.

- [ ] **Step 5: Add a single user-facing pending message**

Handle `nexus:file-drag-pending` once in the app shell or existing notification layer and display `文件正在准备，请稍后再拖拽` with a short deduped duration. Do not add a new notification system.

### Task 3: Make Electron cache and native drag accept role-specific names

**Files:**
- Modify: `electron/preload.js:10-20`
- Modify: `electron/main.js:314-466`

- [ ] **Step 1: Forward the complete drag request through preload**

Keep backward compatibility while accepting an object in `doFileDrag`:

```js
doFileDrag: (request) => ipcRenderer.sendSync('do-file-drag', request)
```

The renderer passes `{ fileId }`; the main process also accepts a legacy scalar file id so unrelated callers do not break.

- [ ] **Step 2: Preserve requested names while creating temp files**

Keep `cacheDragFile(fileId, fileName, buffer)` as the only writer. When another file requests the same base name, retain the existing `_1`, `_2` collision suffix behavior. Store the requested name in `dragFileNameCache` so `is-file-cached` checks the requested logical name while `do-file-drag` uses the actual unique temp path.

- [ ] **Step 3: Keep cache invalidation correct**

When a file is recached with a different requested name, remove its previous cache entry and temp path before writing the new one. Keep the existing one-hour cleanup and do not touch application upload directories.

- [ ] **Step 4: Verify native drag remains synchronous**

Keep `mainWindow.webContents.startDrag({ file: tempPath, icon })` inside the synchronous `do-file-drag` IPC handler. If no cached path exists, return `false`; never synthesize a URL or text payload in the main process.

### Task 4: Ensure every existing drag surface preloads correctly

**Files:**
- Modify: `src/api/upload.js:40-185`
- Modify: `src/App.vue:1-50`
- Modify only if needed: existing drag surfaces under `src/views/**` and `src/components/**`

- [ ] **Step 1: Keep existing explicit attachment preloads**

Do not remove existing `mouseenter="preloadFilesForDrag(...)"` calls. They remain useful for non-image attachments.

- [ ] **Step 2: Preload image targets registered through `getFileUrl()`**

Keep `registerDragFileUrl()` calling `prepareFileDragCache(file)`, now with the resolved role-aware filename. Add a guarded `pointerover` listener in `ensureImageDragBridge()` so an image that becomes draggable after render starts preparation when the pointer first enters it.

- [ ] **Step 3: Cover detail-page files**

Keep `useTaskDetail()` preloading all detail and modification files. Because the backend now includes `task_no`, no detail component API or task flow changes are required.

- [ ] **Step 4: Preserve role behavior**

Do not change task list filtering, task status, upload, review, payment, or permission logic. The only role-sensitive behavior is the temporary drag filename selected by `getDragNamingMode()`.

### Task 5: Verification and regression checks

**Files:**
- Test: existing `tests/task-pages/task-page-features.spec.js`
- Test: existing backend Jest suites

- [ ] **Step 1: Run static checks**

```powershell
git diff --check
```

Expected: no whitespace errors.

- [ ] **Step 2: Run backend tests**

```powershell
Push-Location standalone-server
npm test -- --runInBand
Pop-Location
```

Expected: all existing suites pass.

- [ ] **Step 3: Run task-page Playwright regression**

```powershell
npm run test:task-pages
```

Expected: all existing task-page scenarios pass; browser-mode URL fallback remains unchanged.

- [ ] **Step 4: Perform Electron manual verification without building**

Start the existing local development client only. For a客服 and a基础美工 account, drag a reference image, style image, effect image, original image, and attachment into a local folder, WeCom, and Photoshop. Confirm the local file names follow `task_no + extension`, and repeat with two files from one task to verify `_1`/`_2` collision suffixes.

- [ ] **Step 5: Verify unaffected roles**

Using运营、美工设计师、运营助理、管理员 accounts, drag the same file types and confirm the original uploaded filename is preserved.

- [ ] **Step 6: Verify the pending-cache path**

Throttle or delay the first file download, start a drag immediately, and confirm the client shows the preparation message and does not place a URL in WeCom. Drag again after preparation completes and confirm the native file arrives.

- [ ] **Step 7: Confirm scope safety**

Confirm no production URL, production database, task state, permission, upload endpoint, or server-side stored filename was changed. Do not run `npm run build`, Electron packaging, or remote push for this change.
