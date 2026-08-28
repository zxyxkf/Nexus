# 打款跟踪全局管理与上架类目实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 新增可授权的全店铺打款数据管理权限、上架类目配置和选品详情字段精简，同时保持普通账号店铺隔离及原有任务流转。

**Architecture:** 在现有权限目录中增加聚合权限 `payment.manage.all`，由打款跟踪访问层统一判断全局管理范围和操作资格；记录与阶段服务继续复用现有接口和乐观锁。上架类目使用独立表和受 `admin.config` 保护的 CRUD 接口，选品表单通过只读列表接口加载搜索选项。

**Tech Stack:** Vue 3、Element Plus、Express、MySQL/SQLite 双引擎、Jest、Playwright。

---

### Task 1: 添加聚合权限和访问判定

**Files:**
- Modify: `standalone-server/config/permissions.js`
- Modify: `standalone-server/services/payment-tracking/constants.js`
- Modify: `standalone-server/services/payment-tracking/access.js`
- Modify: `standalone-server/services/payment-tracking/record.service.js`
- Modify: `standalone-server/services/payment-tracking/workflow.service.js`
- Modify: `standalone-server/services/payment-tracking/image.service.js`
- Modify: `standalone-server/routes/payment-tracking/record-routes.js`
- Modify: `standalone-server/routes/payment-tracking/workflow-routes.js`
- Modify: `standalone-server/routes/payment-tracking/image-routes.js`
- Test: `standalone-server/tests/unit/permissions.test.js`

- [ ] Add `payment.manage.all` to the payment-tracking permission catalog, add it to admin defaults, and make it imply both page permissions plus all payment-tracking action permissions.
- [ ] Add `canManageAllPaymentData(user)` and use it in `assertStoreAccess`, `canManageOwnerRecord`, and list filters. Keep existing per-action checks; the aggregate permission only supplies the corresponding payment permissions through expansion.
- [ ] Change route guards from individual payment permissions to `requireAnyPermission([currentPermission, 'payment.manage.all'])` where needed, including records, workflow, and image endpoints.
- [ ] Add unit assertions that the new code is catalogued, absent from ordinary role defaults, included for admin, and expands to selection/records/open/delete permissions.
- [ ] Run `cd standalone-server && npx jest tests/unit/permissions.test.js --runInBand` and expect all tests to pass.

### Task 2: Support global-manager record creation and cross-store lists

**Files:**
- Modify: `standalone-server/services/payment-tracking/record.service.js`
- Modify: `standalone-server/services/payment-tracking/access.js`
- Modify: `standalone-server/services/payment-tracking/repository.js`
- Modify: `src/views/payment-tracking/SelectionList.vue`
- Modify: `src/views/payment-tracking/RecordsList.vue`
- Modify: `src/utils/permissions.js` only if a shared helper is required
- Test: `standalone-server/tests/api/payment-tracking.test.js`

- [ ] In `listRecords`, let `payment.manage.all` users pass an optional `store` filter or omit it for all stores; preserve `user.store` filtering for everyone else.
- [ ] In `createManualRecord`, accept users with `payment.manage.all` and no store, save `store: user.store || '管理员'`, and keep `plannerId`/`plannerName` from the current user.
- [ ] Make the two list pages show the store selector when the current user has the aggregate permission, not only for the `admin` role; continue hiding it for ordinary users.
- [ ] Add API coverage for an unbound global manager creating a record (`store === '管理员'`, planner equals current user), listing records from two stores, fetching another store's detail, editing a stage, deleting and restoring it.
- [ ] Run `cd standalone-server && npx jest tests/api/payment-tracking.test.js --runInBand` and expect the existing and new cases to pass.

### Task 3: Add configurable listing-category storage and API

**Files:**
- Modify: `standalone-server/config/payment-tracking-schema.js`
- Modify: `standalone-server/services/payment-tracking/repository.js`
- Create: `standalone-server/services/payment-tracking/category.service.js`
- Create: `standalone-server/routes/payment-tracking/category-routes.js`
- Modify: `standalone-server/routes/payment-tracking/index.js`
- Modify: `standalone-server/services/payment-tracking/record.service.js`
- Modify: `standalone-server/services/payment-tracking/workflow.service.js`
- Modify: `standalone-server/config/database.js` only if schema initialization requires a separate migration statement
- Test: `standalone-server/tests/api/payment-tracking.test.js`

- [ ] Add `payment_listing_category` in both SQLite and MySQL schema definitions with unique trimmed `name`, sort order, active flag, and timestamps; initialization must remain idempotent.
- [ ] Implement category list/create/update/delete methods. Create/update must trim names, reject empty or duplicate names, and reject deleting a category that is already the selected value only at presentation time, never mutate historical records.
- [ ] Add `GET /api/payment-tracking/categories` for authenticated payment-page users and admin-protected POST/PUT/DELETE endpoints using `admin.config`.
- [ ] Validate `listingCategory` against the category table in manual record creation and stage-save normalization; preserve an existing historical value when it is no longer configured, but reject newly submitted unknown values.
- [ ] Run schema initialization twice and the payment-tracking API tests; expect no duplicate-table/index errors and explicit invalid-category responses.

### Task 4: Expose category management and update selection form layout

**Files:**
- Modify: `src/api/payment-tracking.js`
- Modify: `src/views/admin/Config.vue`
- Modify: `src/views/payment-tracking/forms/SelectionForm.vue`
- Modify: `src/views/payment-tracking/StageDetail.vue`
- Test: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] Add API helpers for category list/create/update/delete.
- [ ] Add a “上架类目” tab in system configuration with add/edit/delete controls and refresh; only the existing admin-config route access controls the page.
- [ ] Load categories in `SelectionForm`, use `el-select filterable` without `allow-create`, and include a historical current value as a temporary option when it is no longer configured.
- [ ] Move gross margin to the stage detail header, remove store sequence/planner/gross-margin fields from the selection form, and display only `record.plannerName` without the “策划” prefix.
- [ ] Add Playwright assertions for the compact header, removed duplicate fields, category filtering, and rejection of a value not returned by the category API.
- [ ] Run `npm run test:payment-tracking` and expect all existing plus new tests to pass.

### Task 5: Full regression and local handoff

**Files:**
- Verify only; do not modify unrelated files.

- [ ] Run `cd standalone-server && npm test -- --runInBand` and confirm all Jest suites pass against temporary SQLite test databases.
- [ ] Run `npm run test:task-pages` and `npm run test:payment-tracking`.
- [ ] Run `git diff --check HEAD` and inspect `git status --short`; confirm no `dist/`, `release/`, package artifacts, or remote push occurred.
- [ ] Confirm local frontend `http://127.0.0.1:5173/` and backend `http://127.0.0.1:18632/` remain available.
- [ ] Commit only the files belonging to this feature locally; do not run `git push`.
