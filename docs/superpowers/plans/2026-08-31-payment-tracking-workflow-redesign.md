# Payment Tracking Workflow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the obsolete preparation/testing/monitoring workflow with the confirmed four-node payment tracking flow, remove the former breakout stage and its old data, migrate existing local/production-compatible data, add administrator-configured promotion methods, and support stage-bound multi-image feedback without changing unrelated task flows.

**Architecture:** Keep the stable `selection`, `testing`, `monitoring`, and `summary` stage codes while removing `preparation` and `breakout` from the active graph. Add an idempotent payment-tracking migration invoked by database startup, keep business branching in backend workflow rules, expose promotion methods through an isolated configuration service, and extend the existing image service with stage and adjustment ownership. Frontend forms consume these contracts and retain the existing timeline component and interaction model.

**Tech Stack:** Vue 3, Element Plus, Vite dev server, Express, sql.js SQLite compatibility layer, MySQL 8-compatible SQL, Jest/Supertest, Playwright.

---

## File Map

- Create `standalone-server/config/payment-tracking-migration.js`: idempotent SQLite/MySQL schema and data migration.
- Modify `standalone-server/config/payment-tracking-schema.js`: new promotion table, stage fields, stable adjustment identity, and image ownership columns for fresh databases.
- Modify `standalone-server/config/database.js`: run the payment migration after base table creation and before serving requests.
- Modify `standalone-server/services/payment-tracking/constants.js`: active four-stage graph and image category metadata.
- Modify `standalone-server/services/payment-tracking/rules.js`: second/third-stage advance and end rules.
- Modify `standalone-server/services/payment-tracking/open.service.js`: copy task publish time into new records.
- Modify `standalone-server/services/payment-tracking/repository.js`: new stage fields, migration-safe adjustment upserts, promotion CRUD, and adjustment-scoped image queries.
- Modify `standalone-server/services/payment-tracking/workflow.service.js`: accepted field maps, manager review location, promotion validation, and link-state validation.
- Create `standalone-server/services/payment-tracking/promotion.service.js`: promotion method normalization, CRUD, and active-value validation.
- Create `standalone-server/routes/payment-tracking/promotion-routes.js`: super-admin configuration endpoints and authenticated active-option listing.
- Modify `standalone-server/routes/payment-tracking/index.js`: mount promotion routes.
- Modify `standalone-server/routes/payment-tracking/image-routes.js`: accept an optional adjustment owner for feedback uploads.
- Modify `standalone-server/services/payment-tracking/image.service.js`: enforce category-specific stage ownership.
- Modify `standalone-server/services/payment-tracking/record.service.js`: present new fields, adjustment IDs/keys, and image ownership.
- Modify `src/api/payment-tracking.js`: promotion CRUD and adjustment-owned image request parameters.
- Modify `src/config/payment-tracking.js`: four displayed stages and removal of hard-coded promotion methods.
- Modify `src/views/admin/Config.vue`: super-admin promotion method configuration tab.
- Modify `src/views/payment-tracking/StageDetail.vue`: remove preparation/breakout routing and models, use new branch fields, and prepare a newly-added adjustment before image upload.
- Modify `src/views/payment-tracking/forms/SelectionForm.vue`: source date read-only behavior and removal of obsolete fields.
- Modify `src/views/payment-tracking/forms/TestingForm.vue`: confirmed second-stage layout.
- Modify `src/views/payment-tracking/forms/MonitoringForm.vue`: confirmed third-stage layout.
- Modify `src/components/payment-tracking/PromotionAdjustments.vue`: simplified stable adjustments with one multi-image gallery per adjustment.
- Modify `src/components/payment-tracking/ImageGallery.vue`: optional adjustment ownership and pre-upload preparation.
- Delete `src/views/payment-tracking/forms/PreparationForm.vue`: no longer reachable or represented.
- Delete `src/views/payment-tracking/forms/BreakoutForm.vue`: former fifth stage is no longer reachable or represented.
- Modify `standalone-server/tests/api/payment-tracking.test.js`: configuration, source time, workflow, permissions, and migration-facing API coverage.
- Modify `standalone-server/tests/api/payment-tracking-images.test.js`: stage image ownership and adjustment isolation coverage.
- Modify `standalone-server/tests/unit/payment-tracking-rules.test.js`: pure branch rule coverage; create if absent.
- Modify `tests/payment-tracking/payment-tracking.spec.js`: four-node timeline and confirmed form behavior.

### Task 1: Idempotent Schema And Old-Record Migration

**Files:**
- Create: `standalone-server/config/payment-tracking-migration.js`
- Modify: `standalone-server/config/payment-tracking-schema.js`
- Modify: `standalone-server/config/database.js`
- Test: `standalone-server/tests/api/payment-tracking.test.js`

- [ ] **Step 1: Add a failing migration regression test**

Seed one record at `preparation`, one record at `breakout`, one record already past them, old testing/monitoring values, old breakout data, and old adjustment metrics. Re-run the exported migration twice and assert the same final state:

```js
it('migrates the retired preparation stage and clears obsolete payment data idempotently', async () => {
  const { execute, getMode } = require('../../config/database');
  const { migratePaymentTracking } = require('../../config/payment-tracking-migration');
  await seedLegacyPaymentWorkflow(execute);

  await migratePaymentTracking({ execute, mode: getMode() });
  await migratePaymentTracking({ execute, mode: getMode() });

  const [records] = await execute("SELECT current_stage, end_stage FROM payment_selection_record WHERE source_task_no = 'LEGACY-PAYMENT'");
  expect(records[0]).toMatchObject({ current_stage: 'testing', end_stage: 'testing' });
  const [stages] = await execute('SELECT stage_code FROM payment_selection_stage WHERE record_id = ? ORDER BY id', [legacyRecordId]);
  expect(stages.map(row => row.stage_code)).toEqual(['selection', 'testing']);
  const [testing] = await execute('SELECT paid_enabled, paid_at, promotion_method, car_clicks FROM payment_selection_testing WHERE record_id = ?', [legacyRecordId]);
  expect(testing[0]).toMatchObject({ paid_enabled: 1, promotion_method: '', car_clicks: null });
  const [breakoutRows] = await execute('SELECT record_id FROM payment_selection_breakout');
  expect(breakoutRows).toHaveLength(0);
  const [breakoutStages] = await execute("SELECT id FROM payment_selection_stage WHERE stage_code = 'breakout'");
  expect(breakoutStages).toHaveLength(0);
});
```

- [ ] **Step 2: Run the focused test and verify the missing migration fails**

Run: `npm test -- --runInBand tests/api/payment-tracking.test.js` from `standalone-server`.

Expected: FAIL because `payment-tracking-migration.js` and the new columns do not exist.

- [ ] **Step 3: Extend fresh-database schemas**

Add equivalent SQLite/MySQL definitions:

```sql
ALTER payment_selection_image: adjustment_id nullable
ALTER payment_selection_testing: paid_enabled, paid_at, promotion_method
ALTER payment_selection_monitoring: link_optimized, link_status
ALTER payment_selection_adjustment: client_key
CREATE payment_promotion_method(id, name UNIQUE, sort_order, active, create_time, update_time)
```

Fresh `payment_selection_adjustment` rows use `UNIQUE(record_id, client_key)` while retaining the existing sort-order index for stable ordering.

- [ ] **Step 4: Implement the migration module**

Export a single injectable function and dialect helpers:

```js
async function migratePaymentTracking({ execute, mode }) {
  await ensureColumns(execute, mode);
  await migratePreparationData(execute);
  await migrateStageRows(execute);
  await migrateBreakoutToSummary(execute);
  await backfillSelectionDates(execute);
  await migrateMonitoringStatus(execute);
  await clearRetiredValues(execute);
}

module.exports = { migratePaymentTracking };
```

The data statements must be idempotent:

```sql
UPDATE payment_selection_testing
SET paid_enabled = COALESCE(paid_enabled, (SELECT paid_enabled FROM payment_selection_preparation p WHERE p.record_id = payment_selection_testing.record_id)),
    paid_at = COALESCE(paid_at, (SELECT paid_at FROM payment_selection_preparation p WHERE p.record_id = payment_selection_testing.record_id));

UPDATE payment_selection_record SET current_stage = 'testing' WHERE current_stage = 'preparation';
UPDATE payment_selection_record SET end_stage = 'testing' WHERE end_stage = 'preparation';
DELETE FROM payment_selection_stage WHERE stage_code = 'preparation';
UPDATE payment_selection_record SET current_stage = 'summary' WHERE current_stage = 'breakout';
UPDATE payment_selection_record SET end_stage = 'summary' WHERE end_stage = 'breakout';
DELETE FROM payment_selection_stage WHERE stage_code = 'breakout';
DELETE FROM payment_selection_breakout;
```

Insert missing `testing` and `summary` stage rows before updates; merge duplicate stage status using ended over active over completed, and preserve earliest entered/latest completed timestamps. When migrating `breakout`, carry only the workflow status into `summary`; discard all breakout form values and stage rows. Backfill `client_key` as `legacy-<id>`, map `abandoned=1` to `link_status='protect_roi'` and `abandoned=0` to `link_status='keep_breaking'` only when the old field was explicitly stored. Clear all retired columns listed in the approved design, including old promotion values and adjustment metrics.

- [ ] **Step 5: Invoke migration during startup**

After `CREATE TABLE IF NOT EXISTS` statements and before seeds/permissions, call:

```js
const { migratePaymentTracking } = require('./payment-tracking-migration');
await migratePaymentTracking({ execute: dbEngine.execute.bind(dbEngine), mode });
```

Do not swallow migration errors; log the failing migration and rethrow so the server does not start on a partial workflow.

- [ ] **Step 6: Run migration tests twice**

Run: `npm test -- --runInBand tests/api/payment-tracking.test.js` from `standalone-server`.

Expected: PASS, including the idempotency assertion.

- [ ] **Step 7: Commit the migration slice locally**

```bash
git add standalone-server/config/payment-tracking-migration.js standalone-server/config/payment-tracking-schema.js standalone-server/config/database.js standalone-server/tests/api/payment-tracking.test.js
git commit -m "feat: migrate payment tracking workflow schema"
```

### Task 2: Four-Stage Workflow Rules And Source Publish Time

**Files:**
- Modify: `standalone-server/services/payment-tracking/constants.js`
- Modify: `standalone-server/services/payment-tracking/rules.js`
- Modify: `standalone-server/services/payment-tracking/workflow.service.js`
- Modify: `standalone-server/services/payment-tracking/open.service.js`
- Modify: `standalone-server/services/payment-tracking/repository.js`
- Test: `standalone-server/tests/unit/payment-tracking-rules.test.js`
- Test: `standalone-server/tests/api/payment-tracking.test.js`
- Test: `standalone-server/tests/api/payment-tracking-images.test.js`

- [ ] **Step 1: Write failing pure workflow tests**

```js
expect(NEXT_STAGE).toEqual({
  selection: 'testing', testing: 'monitoring', monitoring: 'summary', summary: null
});
expect(validateAdvance('testing', { paid_enabled: 1, paid_at: '2026-08-31 10:00:00', potential_status: '符合潜力款标准' }).ok).toBe(true);
expect(validateAdvance('monitoring', { link_status: 'protect_roi' })).toMatchObject({ ok: false });
expect(validateAdvance('monitoring', { link_status: 'keep_breaking' }).ok).toBe(true);
expect(deriveEndSnapshot('monitoring', { link_status: 'protect_roi' })).toEqual({
  endType: 'protect_roi', endReason: '链接状态：保投产'
});
```

- [ ] **Step 2: Add a failing source-time API assertion**

Create a task with a known `create_time`, open payment tracking, and assert `selectionDate` equals that exact database value. Also assert a manual record accepts its supplied date.

- [ ] **Step 3: Run focused rules and open-from-task tests**

Run: `npm test -- --runInBand tests/unit/payment-tracking-rules.test.js tests/api/payment-tracking-images.test.js` from `standalone-server`.

Expected: FAIL on old stage graph, old monitoring branch, and missing task publish time.

- [ ] **Step 4: Implement active workflow constants and rules**

Use stable internal values:

```js
const STAGES = ['selection', 'testing', 'monitoring', 'summary'];
const NEXT_STAGE = { selection: 'testing', testing: 'monitoring', monitoring: 'summary', summary: null };
const LINK_STATUS = ['protect_roi', 'keep_breaking'];
```

`testing` requires `paid_enabled === 1`, nonblank `paid_at`, and `potential_status === '符合潜力款标准'`. `monitoring` requires `link_status === 'keep_breaking'` to advance. Ending `monitoring` requires a selected link status and only accepts `protect_roi`; its snapshot reason is `链接状态：保投产`.

Remove the `breakout` field mapping, repository stage-data reader/writer, permission mapping, and validation branch. A monitoring record marked `keep_breaking` advances directly to `summary`.

- [ ] **Step 5: Move manager fields and remove retired field mappings**

`testing` accepts `paidEnabled`, `paidAt`, `promotionMethod`, `potentialStatus`, `unqualifiedAction`, `managerReportDate`, and `weiStockReported`. `monitoring` accepts `linkOptimized`, `linkStatus`, and simplified adjustments. Move the manager permission check from `preparation` to `testing` and validate only changes to `paid_enabled`/`paid_at`.

- [ ] **Step 6: Copy task publish time**

Select `t.create_time AS selection_date` in `findSourceTask()` and pass it to `insertRecord`:

```js
if (!task.selection_date) throw attachTask(new AppError(400, '来源任务缺少发布时间'), task);
await repository.insertRecord(conn, {
  ...recordIdentity,
  selectionDate: task.selection_date
});
```

- [ ] **Step 7: Run focused backend tests**

Run: `npm test -- --runInBand tests/unit/payment-tracking-rules.test.js tests/api/payment-tracking.test.js tests/api/payment-tracking-images.test.js` from `standalone-server`.

Expected: PASS.

- [ ] **Step 8: Commit the workflow slice locally**

```bash
git add standalone-server/services/payment-tracking/constants.js standalone-server/services/payment-tracking/rules.js standalone-server/services/payment-tracking/workflow.service.js standalone-server/services/payment-tracking/open.service.js standalone-server/services/payment-tracking/repository.js standalone-server/tests/unit/payment-tracking-rules.test.js standalone-server/tests/api/payment-tracking.test.js standalone-server/tests/api/payment-tracking-images.test.js
git commit -m "feat: update payment tracking stage rules"
```

### Task 3: Super-Admin Promotion Method Configuration

**Files:**
- Create: `standalone-server/services/payment-tracking/promotion.service.js`
- Create: `standalone-server/routes/payment-tracking/promotion-routes.js`
- Modify: `standalone-server/routes/payment-tracking/index.js`
- Modify: `standalone-server/services/payment-tracking/repository.js`
- Modify: `standalone-server/services/payment-tracking/record.service.js`
- Modify: `src/api/payment-tracking.js`
- Modify: `src/views/admin/Config.vue`
- Test: `standalone-server/tests/api/payment-tracking.test.js`

- [ ] **Step 1: Write failing promotion API tests**

```js
const created = await request(app).post('/api/payment-tracking/promotion-methods')
  .set('Authorization', `Bearer ${adminToken}`)
  .send({ name: '直通车', sortOrder: 10, active: true });
expect(created.body).toMatchObject({ code: 0, data: { name: '直通车', active: 1 } });

const forbidden = await request(app).post('/api/payment-tracking/promotion-methods')
  .set('Authorization', `Bearer ${storeAToken}`)
  .send({ name: '全站推广' });
expect(forbidden.body.code).toBe(403);
```

Also assert duplicate trimmed names fail, normal payment users only list active values, admins can request inactive values, and saving a testing-stage value not in active configuration returns a field error.

- [ ] **Step 2: Run the focused API test**

Run: `npm test -- --runInBand tests/api/payment-tracking.test.js` from `standalone-server`.

Expected: FAIL with route not found.

- [ ] **Step 3: Implement repository and isolated service**

Mirror listing-category CRUD but use promotion-specific messages and table methods. Validation contract:

```js
async function assertConfiguredPromotionMethod(value, options = {}) {
  const name = normalizeName(value);
  if (!name) return '';
  if (name === normalizeName(options.existingValue)) return name;
  const row = await repository.findPromotionMethodByName(name);
  if (!row || Number(row.active) !== 1) throw fieldError('promotionMethod', '推广方式无效，请选择已配置的方式');
  return name;
}
```

- [ ] **Step 4: Add routes and frontend API functions**

Expose `GET/POST/PUT/DELETE /api/payment-tracking/promotion-methods`. Only `admin`/`admin.config` can mutate or list inactive rows. Add matching API functions in `src/api/payment-tracking.js`.

- [ ] **Step 5: Add the system configuration tab**

Add a tab beside “上架类目” with the same dense table/dialog interaction: name, sort order, enabled toggle, edit, delete, refresh. Load only when the tab opens and use promotion-specific state/function names.

- [ ] **Step 6: Run API tests**

Run: `npm test -- --runInBand tests/api/payment-tracking.test.js` from `standalone-server`.

Expected: PASS.

- [ ] **Step 7: Commit the promotion configuration slice locally**

```bash
git add standalone-server/services/payment-tracking/promotion.service.js standalone-server/routes/payment-tracking/promotion-routes.js standalone-server/routes/payment-tracking/index.js standalone-server/services/payment-tracking/repository.js standalone-server/services/payment-tracking/record.service.js src/api/payment-tracking.js src/views/admin/Config.vue standalone-server/tests/api/payment-tracking.test.js
git commit -m "feat: configure payment promotion methods"
```

### Task 4: Stable Promotion Adjustments And Stage-Bound Images

**Files:**
- Modify: `standalone-server/services/payment-tracking/repository.js`
- Modify: `standalone-server/services/payment-tracking/workflow.service.js`
- Modify: `standalone-server/services/payment-tracking/image.service.js`
- Modify: `standalone-server/routes/payment-tracking/image-routes.js`
- Modify: `standalone-server/services/payment-tracking/record.service.js`
- Test: `standalone-server/tests/api/payment-tracking-images.test.js`

- [ ] **Step 1: Write failing image isolation tests**

Create a testing-stage record and upload two `potential_judgment` images. Advance to monitoring, save two adjustments with stable client keys, upload feedback to each adjustment, and assert each image has the correct `adjustmentId`. Assert uploads fail for future/completed non-reopened stages and succeed after a permitted reopen.

```js
await request(app).post(`/api/payment-tracking/records/${recordId}/images/adjustment_feedback`)
  .set('Authorization', `Bearer ${storeAToken}`)
  .field('version', String(version))
  .field('adjustmentId', String(firstAdjustment.id))
  .attach('files', PNG, { filename: 'first-feedback.png', contentType: 'image/png' });
```

- [ ] **Step 2: Run the image test and verify failure**

Run: `npm test -- --runInBand tests/api/payment-tracking-images.test.js` from `standalone-server`.

Expected: FAIL because the categories and adjustment ownership are unsupported.

- [ ] **Step 3: Replace destructive adjustment rewrites with stable upserts**

Normalize and return `id` plus `client_key`. For each submitted adjustment, update a matching record-owned ID/client key or insert a new row; do not delete and recreate existing rows. Keep returned order in `sort_order`.

```js
for (const [index, item] of adjustments.entries()) {
  const existing = item.id
    ? await findAdjustmentById(recordId, item.id, conn)
    : await findAdjustmentByClientKey(recordId, item.client_key, conn);
  if (existing) await updateAdjustment(conn, existing.id, index, item);
  else await insertAdjustment(conn, recordId, index, item);
}
```

- [ ] **Step 4: Make image editing stage-aware**

Map categories to stages:

```js
const IMAGE_STAGE = {
  product_main: 'selection', detail_screenshot: 'selection', competitor: 'selection',
  potential_judgment: 'testing', adjustment_feedback: 'monitoring'
};
```

For `adjustment_feedback`, require a valid adjustment belonging to the same record. List, reorder, and delete within `(record_id, category, adjustment_id)` so one adjustment cannot submit another adjustment's complete ordering.

- [ ] **Step 5: Preserve original names and soft deletion**

Continue using `original_name` for download/drag behavior and only set `deleted_at` on delete. Include `adjustmentId` in presented image JSON.

- [ ] **Step 6: Run image and workflow tests**

Run: `npm test -- --runInBand tests/api/payment-tracking-images.test.js tests/api/payment-tracking.test.js` from `standalone-server`.

Expected: PASS.

- [ ] **Step 7: Commit the backend image slice locally**

```bash
git add standalone-server/services/payment-tracking/repository.js standalone-server/services/payment-tracking/workflow.service.js standalone-server/services/payment-tracking/image.service.js standalone-server/routes/payment-tracking/image-routes.js standalone-server/services/payment-tracking/record.service.js standalone-server/tests/api/payment-tracking-images.test.js standalone-server/tests/api/payment-tracking.test.js
git commit -m "feat: add stage payment feedback images"
```

### Task 5: Frontend Four-Node Timeline And Selection Form

**Files:**
- Modify: `src/config/payment-tracking.js`
- Modify: `src/views/payment-tracking/StageDetail.vue`
- Modify: `src/views/payment-tracking/forms/SelectionForm.vue`
- Delete: `src/views/payment-tracking/forms/PreparationForm.vue`
- Delete: `src/views/payment-tracking/forms/BreakoutForm.vue`
- Test: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: Update mocked records and add failing timeline/selection assertions**

Expect exactly:

```js
await expect(page.locator('.stage-step')).toHaveCount(4);
await expect(page.locator('.stage-step')).toContainText([
  '信息及选品', '第二阶段', '第三阶段', '总结阶段'
]);
await expect(page.getByText('第1-6天准备工作')).toHaveCount(0);
await expect(page.getByText('第12-30天打爆')).toHaveCount(0);
await expect(page.getByLabel('SKU 数是否不超过 200')).toHaveCount(0);
await expect(page.getByText('通过并设计主图')).toHaveCount(0);
```

For a source-linked record, assert the selection-time picker is disabled and displays the task timestamp; for a manual record, assert it remains editable.

- [ ] **Step 2: Run focused Playwright tests**

Run: `npx playwright test --config=playwright.payment-tracking.config.js -g "时间线|选品时间|未来节点"`.

Expected: FAIL against six stages and obsolete controls.

- [ ] **Step 3: Update stage display configuration without restyling the timeline**

```js
export const PAYMENT_STAGES = [
  { code: 'selection', label: '信息及选品' },
  { code: 'testing', label: '第二阶段' },
  { code: 'monitoring', label: '第三阶段' },
  { code: 'summary', label: '总结阶段' }
];
```

Do not change `StageTimeline.vue` visual structure, state classes, connectors, or click handling.

- [ ] **Step 4: Remove preparation and obsolete selection fields**

Remove the preparation and breakout import/model/component mappings and delete `PreparationForm.vue` and `BreakoutForm.vue`. Remove `designMainImage`/`skuLe200` controls and model fields. Pass `record` into `SelectionForm`; disable the selection date when `record.sourceTaskId` is present and retain the date picker for manual records.

- [ ] **Step 5: Run focused Playwright tests**

Run: `npx playwright test --config=playwright.payment-tracking.config.js -g "时间线|选品时间|未来节点"`.

Expected: PASS.

- [ ] **Step 6: Commit the timeline/selection slice locally**

```bash
git add src/config/payment-tracking.js src/views/payment-tracking/StageDetail.vue src/views/payment-tracking/forms/SelectionForm.vue src/views/payment-tracking/forms/PreparationForm.vue src/views/payment-tracking/forms/BreakoutForm.vue tests/payment-tracking/payment-tracking.spec.js
git commit -m "feat: simplify payment selection workflow"
```

### Task 6: Second-Stage Form

**Files:**
- Modify: `src/api/payment-tracking.js`
- Modify: `src/views/payment-tracking/StageDetail.vue`
- Modify: `src/views/payment-tracking/forms/TestingForm.vue`
- Test: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: Add failing second-stage UI assertions**

Assert the page shows manager payment confirmation, searchable configured promotion method, potential judgment fields, and a `potential_judgment` upload dropzone. Assert all removed car/site metrics are absent. Assert users without manager review see disabled payment controls while configured promotion selection remains editable.

- [ ] **Step 2: Run the focused UI test**

Run: `npx playwright test --config=playwright.payment-tracking.config.js -g "第二阶段"`.

Expected: FAIL against the old testing form.

- [ ] **Step 3: Implement the confirmed second-stage form**

Load active promotion methods on mount, use a filterable non-creatable `el-select`, and render sections in this order:

```text
店长付费确认: paidEnabled, paidAt
推广信息: promotionMethod
潜力款判断: potentialStatus, conditional unqualifiedAction, managerReportDate, weiStockReported
潜力款判断图片: ImageGallery(category="potential_judgment")
```

The form's advance validation requires payment confirmation/time and qualified potential status. Image upload remains optional.

- [ ] **Step 4: Run second-stage UI and backend tests**

Run: `npx playwright test --config=playwright.payment-tracking.config.js -g "第二阶段"`.

Run: `npm test -- --runInBand tests/api/payment-tracking.test.js` from `standalone-server`.

Expected: PASS.

- [ ] **Step 5: Commit the second-stage slice locally**

```bash
git add src/api/payment-tracking.js src/views/payment-tracking/StageDetail.vue src/views/payment-tracking/forms/TestingForm.vue tests/payment-tracking/payment-tracking.spec.js
git commit -m "feat: rebuild payment second stage"
```

### Task 7: Third-Stage Form And Per-Adjustment Feedback

**Files:**
- Modify: `src/views/payment-tracking/StageDetail.vue`
- Modify: `src/views/payment-tracking/forms/MonitoringForm.vue`
- Modify: `src/components/payment-tracking/PromotionAdjustments.vue`
- Modify: `src/components/payment-tracking/ImageGallery.vue`
- Modify: `src/api/payment-tracking.js`
- Test: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: Add failing third-stage assertions**

Assert only `是否做链接优化`, `链接状态`, and `推广调整` remain. Assert `保投产` hides/disables advance, `持续打爆` enables it, and no choice blocks both end and advance. Add two adjustments and assert each has its own `数据反馈` gallery and images never appear in the other gallery.

- [ ] **Step 2: Run the focused UI test**

Run: `npx playwright test --config=playwright.payment-tracking.config.js -g "第三阶段|数据反馈"`.

Expected: FAIL against old monitoring fields and shared image API.

- [ ] **Step 3: Implement the simplified monitoring form**

```js
const LINK_STATUS_OPTIONS = [
  { label: '保投产', value: 'protect_roi' },
  { label: '持续打爆', value: 'keep_breaking' }
];
```

`linkOptimized` is optional. `validateForAdvance()` only accepts `keep_breaking`; `validateForEnd()` only accepts `protect_roi`. Remove abandon reason/time and all old operations controls.

- [ ] **Step 4: Implement stable adjustment form data**

New adjustments receive a browser-generated client key and contain only:

```js
{
  id: null,
  clientKey: crypto.randomUUID(),
  reason: '',
  adjustedAt: null,
  detailText: '',
  feedbackText: ''
}
```

Render labels `操作概述` and `备注`. Once an adjustment has an ID, render `ImageGallery` with `category="adjustment_feedback"` and `owner-id="item.id"`.

- [ ] **Step 5: Auto-save a new adjustment before its first image upload**

Pass an async preparation function from `StageDetail` through `MonitoringForm` to `PromotionAdjustments`. It silently calls `saveCurrentStage()`, locates the returned adjustment by `clientKey`, and returns its `id`, current record version, and images to `ImageGallery`; the selected files then upload normally without requiring a manual preliminary save.

- [ ] **Step 6: Run third-stage UI and image tests**

Run: `npx playwright test --config=playwright.payment-tracking.config.js -g "第三阶段|数据反馈"`.

Run: `npm test -- --runInBand tests/api/payment-tracking-images.test.js tests/api/payment-tracking.test.js` from `standalone-server`.

Expected: PASS.

- [ ] **Step 7: Commit the third-stage slice locally**

```bash
git add src/views/payment-tracking/StageDetail.vue src/views/payment-tracking/forms/MonitoringForm.vue src/components/payment-tracking/PromotionAdjustments.vue src/components/payment-tracking/ImageGallery.vue src/api/payment-tracking.js tests/payment-tracking/payment-tracking.spec.js standalone-server/tests/api/payment-tracking-images.test.js standalone-server/tests/api/payment-tracking.test.js
git commit -m "feat: rebuild payment third stage"
```

### Task 8: Full Local Regression And Visual Verification

**Files:**
- Modify only if a test exposes a defect in files already listed above.
- Test: `standalone-server/tests/api/payment-tracking.test.js`
- Test: `standalone-server/tests/api/payment-tracking-images.test.js`
- Test: `standalone-server/tests/unit/payment-tracking-rules.test.js`
- Test: `tests/payment-tracking/payment-tracking.spec.js`
- Test: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: Run all payment backend tests**

Run: `npm test -- --runInBand tests/unit/payment-tracking-rules.test.js tests/api/payment-tracking.test.js tests/api/payment-tracking-images.test.js` from `standalone-server`.

Expected: PASS with no open handles or database migration warnings.

- [ ] **Step 2: Run payment Playwright regression**

Run: `npm run test:payment-tracking`.

Expected: PASS. Preserve screenshots/traces only for failures; do not package the application.

- [ ] **Step 3: Run task-page regression for opening payment tracking**

Run: `npm run test:task-pages`.

Expected: PASS for existing task details, review actions, source image naming, upload overlays, and role-specific fields.

- [ ] **Step 4: Start local SQLite backend and frontend**

Use the existing local commands/environment that force SQLite and local API. Verify backend reports SQLite mode and open the frontend at the local Vite URL. Do not use production environment variables or a production MySQL connection.

- [ ] **Step 5: Verify desktop and narrow-window layouts in the browser**

Inspect at least 1440x900 and 820x900:

```text
- outer record timeline keeps the existing connected-node style
- second/third-stage fields do not overlap or overflow
- modal/image previews remain centered and internally scroll
- each adjustment feedback gallery shows only its own images
- configured promotion search filters by contained Chinese text
```

- [ ] **Step 6: Inspect final diff and forbidden commands**

Run: `git diff --check` and `git status --short`.

Confirm no generated build output, installer, production database, or remote-push operation was created/executed.

Do not push any commit to a remote repository.
