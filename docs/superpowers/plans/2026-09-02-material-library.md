# 素材库与客服款式图联动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增全公司共享的三层素材库，并让客服发布任务可搜索选择款式、筛选颜色和复制款式图，同时只改动客服/基础美工展示，不影响其他角色任务流程。

**Architecture:** 后端使用独立素材库 service、DAO、routes 和三张素材表；素材文件使用超级管理员配置的独立目录。客服发布时由后端校验并复制选中的素材图片到现有 `task_file` 的 `style` 分类，任务列表和详情读取独立副本。前端素材库使用三条独立路由，客服联动组件只在 `cs_agent` 模式启用。

**Tech Stack:** Vue 3、Element Plus、Vue Router、Node.js、Express、SQLite/MySQL、Multer、现有任务文件预览/下载/拖出工具。

---

## 文件边界

- 数据迁移：`standalone-server/config/material-library-schema.js`、`standalone-server/config/database.js`、`standalone-server/config/permissions.js`
- 后端素材库：`standalone-server/dao/material-library.dao.js`、`standalone-server/services/material-library.service.js`、`standalone-server/routes/material-library.js`、`standalone-server/utils/material-colors.js`、`standalone-server/app.js`
- 前端素材库：`src/api/material-library.js`、`src/components/material-library/MaterialCard.vue`、`src/components/material-library/MaterialUploadDropzone.vue`、`src/views/material-library/Products.vue`、`src/views/material-library/Styles.vue`、`src/views/material-library/Images.vue`、`src/config/menus.js`、`src/router/index.js`
- 客服联动：`src/components/material-library/StylePicker.vue`、`src/views/shared/PublishTask.vue`
- 任务快照：`standalone-server/services/task.service.js`、`standalone-server/dao/task.dao.js`
- 任务展示：`src/views/shared/MyTasksPub.vue`、`src/views/shared/Review.vue`、`src/components/TaskDetail.vue`、`src/components/TaskDetailOverlay.vue`
- 验证：`standalone-server/tests/api/material-library.test.js`、`standalone-server/tests/api/task-material-snapshot.test.js`、`tests/material-library.spec.js`

## Task 1: 表结构、配置和权限

**Files:** create `standalone-server/config/material-library-schema.js`; modify `standalone-server/config/database.js`, `standalone-server/config/permissions.js`.

- [ ] **Step 1: Define schema SQL**

Export `getMaterialLibrarySchema(mode)` with `material_product`, `material_style`, `material_image` tables. Enforce product name global uniqueness and `(product_id, name)` style uniqueness; cascade child rows. Image fields include `original_name`, `display_name`, `color`, `color_source`, `sort_order`, relative `file_path`, size, MIME and timestamps. Add product/style/order indexes for both SQLite and MySQL.

- [ ] **Step 2: Hook idempotent initialization**

Call the schema from `initDatabase()` after existing tables. Execute each statement independently so local SQLite and production MySQL restarts create only missing objects and never alter task data.

- [ ] **Step 3: Seed storage config**

Add `upload.material_library_dir` to `generateConfigSeed(mode)`, defaulting to `standalone-server/upload/material-library` locally and the existing host-upload convention for MySQL. Existing admin config APIs remain the only writer.

- [ ] **Step 4: Seed permission**

Add `{ code: 'material.library', name: '素材库', type: 'page', group: '素材库' }` to `PERMISSIONS`. Do not add it to ordinary role defaults; role/person grants come from the existing admin user-permission UI.

- [ ] **Step 5: Verify**

Run `npm --prefix standalone-server test -- --runInBand tests/api/config.test.js tests/unit/permissions.test.js`; expect exit code 0 and no uncaught duplicate-table errors.

## Task 2: Backend material-library module

**Files:** create `standalone-server/dao/material-library.dao.js`, `standalone-server/services/material-library.service.js`, `standalone-server/utils/material-colors.js`, `standalone-server/routes/material-library.js`; modify `standalone-server/app.js`.

- [ ] **Step 1: Implement color helpers**

Export `inferColor(name)`, `normalizeColor(value)`, `collectColors(images)`. Infer a leading Chinese segment before Latin letters, digits or separators; return empty for unknown. Manual values use `color_source = 'manual'`; renaming re-infers only non-manual values.

- [ ] **Step 2: Implement DAO/service CRUD**

Provide product/style/image list, create, rename, delete, color update and ordered queries. Convert unique conflicts to HTTP 409. Delete operations enumerate physical files, clean files and cascade rows after final permission/target checks.

- [ ] **Step 3: Implement upload storage**

Use a dedicated Multer disk storage under `<material_library_dir>/<productId>/<styleId>/YYYYMMDD`. Reuse existing image extension and per-file size checks; append new images to the end of `sort_order` without a per-style count limit.

- [ ] **Step 4: Implement routes**

Register authenticated endpoints:

```text
GET/POST/PUT/DELETE /products
GET/POST/PUT/DELETE /products/:productId/styles
GET/POST/PUT/DELETE /styles/:styleId/images
PUT /images/reorder
PUT /images/:imageId/color
GET /search?q=...
```

Every route requires `material.library` and returns `{ code, msg, data }`. Reject 403 unauthorized, 409 duplicate names, 400 invalid input/path, 413 oversized files and 404 missing targets/files.

- [ ] **Step 5: Register and verify**

Mount `/api/material-library` in `app.js`; run the new API tests for permissions, CRUD, cascade deletion, upload, rename/color correction, sorting, search and path traversal rejection.

## Task 3: Frontend material-library pages

**Files:** create `src/api/material-library.js`, `src/components/material-library/MaterialCard.vue`, `MaterialUploadDropzone.vue`, `src/views/material-library/Products.vue`, `Styles.vue`, `Images.vue`; modify `src/config/menus.js`, `src/router/index.js`.

- [ ] **Step 1: API wrapper**

Expose product/style/image CRUD, upload, reorder, color update and search methods. Upload uses multipart form data and does not alter the existing task upload wrapper.

- [ ] **Step 2: Navigation and route guards**

Add `material_library` section after payment tracking and before data. Add `/material-library/products`, `/material-library/products/:productId/styles`, `/material-library/styles/:styleId/images`, all guarded by `material.library`.

- [ ] **Step 3: Product/style card pages**

Use one card component for create/enter/rename/delete. Product names are globally unique; style names are unique within the current product. Add breadcrumb back navigation and a search field on the product page. Search results for styles display `product / style` and navigate directly to the image page.

- [ ] **Step 4: Image page**

Put a click-or-drag upload dropzone at the top. Render uploaded images immediately below it, lazy/batched on continued scroll, ordered by `sort_order`. Add preview, download, drag-out, rename, delete, manual color correction and drag sorting.

- [ ] **Step 5: Verify**

Run `npm run build`; expect Vite exit code 0. Use Playwright to verify three independent pages, dropzone behavior, search, deletion confirmation and persisted order.

## Task 4: Customer-service publishing integration

**Files:** create `src/components/material-library/StylePicker.vue`; modify `src/views/shared/PublishTask.vue`, `standalone-server/services/task.service.js`, `standalone-server/dao/task.dao.js`.

- [ ] **Step 1: StylePicker state**

Maintain `styleId`, `colorFilter`, `visibleImages`, `selectedImageIds`. Default selection is empty; changing color filters visibility only, preserves prior selections, appends new selections and deduplicates IDs.

- [ ] **Step 2: CS-only two-column layout**

When `taskGroup === 'cs'`, keep the original form on the left and show the picker on the right. The searchable optional `款号` select loads style images and colors. Keep the original reference-image dropzone and add a separate live `款式图` area. Non-CS pages retain the existing layout.

- [ ] **Step 3: Snapshot selected images**

Accept optional `materialStyleId` and `materialImageIds` in the task payload. Validate all IDs belong to the selected style and source files exist, copy selected files to a task-owned directory, and insert `task_file.file_category = 'style'`. Clean temporary files on copy/transaction failure; no style rows are created for an empty selection.

- [ ] **Step 4: Verify**

Test no style, style with no images, multi-image selection, cross-color append, source deletion after publish, and copy-failure cleanup. Existing task status and reference-file behavior must remain unchanged.

## Task 5: Customer/basic-designer display changes

**Files:** modify `src/views/shared/MyTasksPub.vue`, `src/views/shared/Review.vue`, `src/components/TaskDetail.vue`, `src/components/TaskDetailOverlay.vue`; modify `TaskDetailImage.vue` only if its call sites require it.

- [ ] **Step 1: Style-file display model**

Read `style` files separately from reference/work files. Reuse existing preview/download/drag-out handlers.

- [ ] **Step 2: CS list/review**

Only for `taskGroup === 'cs'`, replace the “指定颜色” column in customer-service My Tasks with “款式图” showing first thumbnail plus count, and add the same summary beside “款号” in CS Works Review. Do not add or alter review actions.

- [ ] **Step 3: CS/basic detail**

Only customer-service and basic-designer detail views replace the specified-color field with the full style-image gallery. Keep reference images separate. All operator, assistant, designer and admin detail views remain unchanged.

- [ ] **Step 4: Verify**

Open CS and basic-designer list/review/detail pages locally and confirm modal layering, preview, download and drag-out. Open operator, assistant and designer pages and confirm no style-image field appears.

## Task 6: Regression tests and local handoff

**Files:** create `standalone-server/tests/api/material-library.test.js`, `standalone-server/tests/api/task-material-snapshot.test.js`, `tests/material-library.spec.js`.

- [ ] **Step 1: API tests**

Cover permission denial, uniqueness, cascade deletion, upload, rename/re-infer, manual color correction, reorder, search and invalid paths.

- [ ] **Step 2: Snapshot tests**

Cover optional payloads, selection deduplication across color filters, independent task copies and cleanup after failure.

- [ ] **Step 3: Playwright tests**

Cover three-level navigation, click/drag upload, real-time image list, color filtering with preserved selections, CS two-column publish and CS/basic-designer display; assert other roles retain original fields.

- [ ] **Step 4: Run verification**

```bash
npm --prefix standalone-server test -- --runInBand tests/api/material-library.test.js tests/api/task-material-snapshot.test.js tests/unit/permissions.test.js
npx playwright test tests/material-library.spec.js
npm run build
git diff --check
```

Expected: all commands exit 0; no database files, `.env`, upload data or Electron packages enter Git.

## Constraints

- Do not run `npm run electron:build` unless explicitly requested.
- Do not touch production server, production database, local SQLite data, `.env` or upload data.
- Do not push remote; commits remain local.
- Guard every customer-service change by `taskGroup === 'cs'` so operator, operator-assistant, designer and admin pages and task flows remain unchanged.
