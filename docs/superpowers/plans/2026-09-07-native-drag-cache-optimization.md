# Native Drag Cache Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Electron native file dragging feel immediate by warming the local drag cache as files become visible, reusing valid cache files after restart, and downloading multiple files with bounded concurrency.

**Architecture:** The renderer keeps a deduplicated preload queue and gives an explicit drag request high priority. Electron stores cache metadata in a small atomic manifest under its existing temp cache directory, restores only matching and fresh files at startup, and runs at most three downloads concurrently. Native dragging remains gated on a valid local file; an incomplete cache never falls back to a tokenized browser URL in Electron.

**Tech Stack:** Vue/JavaScript renderer, Electron IPC, Node.js `fs`/`http`/`https`, Playwright.

---

### Task 1: Lock down renderer drag-cache behavior

**Files:**
- Modify: `src/api/upload.js:20-350`
- Test: `tests/task-pages/task-page-features.spec.js:1240-1345`

- [x] **Step 1: Add regression assertions for priority and no URL fallback**

Extend the existing Electron drag assertions so native drag requests include `fileName`, `downloadPath`, and `token`; a pending drag marks the item `priority: "high"`; and `dragstart` leaves all browser transfer fields empty.

- [x] **Step 2: Run the focused tests and observe the pre-change behavior**

Run: `npx playwright test --config=playwright.task-pages.config.js tests/task-pages/task-page-features.spec.js -g "Electron|drag"`

Expected before the implementation: existing native-drag assertions pass, while the new queue/priority assertions fail because the current renderer sends independent one-file requests without shared priority state.

- [x] **Step 3: Implement the renderer request registry**

Replace the single-flight `preloadingDragFileIds` path with `dragPreloadRequests: Map<fileId:fileName, { file, options, priority, promise }>`; merge duplicate requests, issue one normal preload, and issue a deduplicated high-priority promotion when dragstart occurs. `preloadFilesForDrag(files, options)` includes the existing naming/download path plus `priority` in each IPC item and `setupFileDrag` never writes browser URL data in Electron.

- [x] **Step 4: Run the focused tests again**

Run: `npx playwright test --config=playwright.task-pages.config.js tests/task-pages/task-page-features.spec.js -g "Electron|drag"`

Expected: all drag tests pass, including the new deduplication and pending-drag assertions.

### Task 2: Persist and restore Electron drag cache metadata

**Files:**
- Modify: `electron/main.js:314-390,433-482`
- Modify: `electron/preload.js:13-18` only if the IPC request shape needs the explicit priority field

- [x] **Step 1: Add manifest helpers beside the existing cache maps**

Create `loadDragManifest()`, `persistDragManifest()`, and `restoreDragCache()` using JSON `{ version: 1, entries: [...] }`. Each entry records `fileId`, sanitized `fileName`, `downloadPath`, `tempPath`, `size`, `updatedAt`, normalized server URL, and a stable auth scope derived from the JWT user identity (with a hash fallback); the token itself is never stored. Write through a temporary manifest file followed by rename so a process interruption cannot leave a half-written index.

- [x] **Step 2: Restore only valid entries at app startup**

After Electron is ready and before the first renderer request, scan the manifest. Keep an entry only when the temp file exists, the stored name/path still match, and `updatedAt` is less than one hour old; delete stale or malformed files and persist the cleaned manifest. Restoration must not touch server upload directories or any database.

- [x] **Step 3: Update cache mutation and cleanup paths**

Make `cacheDragFile()` replace an existing entry for the same `fileId:fileName` without deleting a valid file first, then persist metadata. Make `removeCachedDragFile()` and `cleanExpiredCache()` remove matching manifest entries and persist once per cleanup pass. Preserve the existing sanitized filename and task-number naming rules.

### Task 3: Add bounded concurrent preparation in the main process

**Files:**
- Modify: `electron/main.js:433-451`

- [x] **Step 1: Implement a three-worker preparation queue**

Normalize and deduplicate incoming items by `fileId:fileName`; sort high-priority items ahead of normal items; reuse an in-flight promise for duplicate keys. Start no more than three `httpGetBuffer` calls at once. A failed item removes only its partial cache state and resolves the batch without rejecting other items.

- [x] **Step 2: Preserve download-path and token behavior**

Continue to resolve material-library downloads through `resolveDragDownloadPath`, use the configured server URL, and pass the caller token only to the existing HTTP helper. Do not send a URL back through `do-file-drag` or alter the service API.

- [x] **Step 3: Run Electron syntax checks**

Run: `node --check electron/main.js; node --check electron/preload.js`

Expected: both commands exit with code 0.

### Task 4: Regression and integration verification

**Files:**
- Modify: `tests/task-pages/task-page-features.spec.js` for focused drag-cache assertions
- Modify: `tests/payment-tracking/payment-tracking.spec.js` to align the Electron pending-drag contract

- [x] **Step 1: Run the focused drag suite**

Run: `npx playwright test --config=playwright.task-pages.config.js tests/task-pages/task-page-features.spec.js -g "drag|Electron"`

- [x] **Step 2: Run the existing task-page suite**

Run: `npm run test:task-pages`

- [x] **Step 3: Check the diff and repository hygiene**

Run: `git diff --check`

Expected: no whitespace errors; only the renderer, Electron bridge, focused tests, and this plan contain changes attributable to this optimization. No build or package artifact is generated.

- [x] **Step 4: Review cache safety manually**

Verify the implementation uses `app.getPath('temp')/nexus-drag` only, never the configured upload directory; Electron pending drags keep `DownloadURL`, `text/uri-list`, `text/plain`, and `text/html` empty; and non-Electron browser drag behavior remains unchanged.

Verification completed on 2026-09-07:

- `npm run test:task-pages`: 52 passed.
- `npm run test:payment-tracking`: 42 passed.
- `node --check electron/main.js` and `node --check electron/preload.js`: passed.
- `git diff --check`: passed (only CRLF normalization warnings from the existing worktree).
