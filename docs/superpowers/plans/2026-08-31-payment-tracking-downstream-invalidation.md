# Payment Tracking Downstream Invalidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a terminal edit to a reopened historical payment stage atomically invalidate all later workflow data, and add a stage-owned conditional image gallery beside Third Stage link optimization.

**Architecture:** `workflow.service.js` remains the transaction coordinator and decides whether merged stage data creates a terminal branch. `repository.js` owns ordered downstream cleanup, while `image.service.js` extends the existing category-to-stage authorization map. Vue only confirms destructive saves, routes after completion, and conditionally renders the existing image gallery.

**Tech Stack:** Node.js, Express, SQL.js/SQLite and MySQL-compatible SQL, Jest/Supertest, Vue 3, Element Plus, Playwright.

---

## File Map

- Modify `standalone-server/services/payment-tracking/rules.js`: derive the explicit terminal result for a reopened stage.
- Modify `standalone-server/services/payment-tracking/repository.js`: delete downstream stage rows/nodes and soft-delete downstream images in transaction order.
- Modify `standalone-server/services/payment-tracking/workflow.service.js`: require explicit confirmation and coordinate save, invalidation, and ending in one transaction.
- Modify `standalone-server/services/payment-tracking/image.service.js`: authorize the new `link_optimization` image category as Third Stage data.
- Modify `standalone-server/tests/api/payment-tracking.test.js`: cover historical-stage invalidation and preservation.
- Modify `standalone-server/tests/api/payment-tracking-images.test.js`: cover the new category's stage ownership.
- Modify `src/views/payment-tracking/StageDetail.vue`: display the destructive confirmation and route an ended result back to records.
- Modify `src/views/payment-tracking/forms/MonitoringForm.vue`: render the conditional Third Stage image gallery.
- Modify `tests/payment-tracking/payment-tracking.spec.js`: cover confirmation, truncation display behavior, and conditional image UI.

No schema migration is required because `payment_selection_image.category` is already free-form text and the existing image table already has every required ownership and soft-delete column.

### Task 1: Define Terminal Historical Edits

**Files:**
- Modify: `standalone-server/services/payment-tracking/rules.js`
- Test: `standalone-server/tests/api/payment-tracking.test.js`

- [ ] **Step 1: Add a failing rule/API assertion for payment-disabled priority**

Add a test fixture whose record is at Summary, whose Second Stage is completed, and whose later Monitoring/Summary nodes exist. Reopen Second Stage and save `paidEnabled: false` with no confirmation:

```js
const unconfirmed = await request(app)
  .put(`/api/payment-tracking/records/${recordId}/stages/testing`)
  .set('Authorization', `Bearer ${reopenerToken}`)
  .send({
    version: reopened.body.data.version,
    data: { paidEnabled: false, potentialStatus: '符合潜力款标准' }
  });

expect(unconfirmed.body).toMatchObject({
  code: 400,
  data: { requiresDownstreamInvalidation: true }
});
```

Query the record afterward and assert its version, `current_stage`, `process_status`, and stages are unchanged.

- [ ] **Step 2: Run the focused test and verify failure**

Run from `standalone-server`:

```powershell
npm test -- --runInBand tests/api/payment-tracking.test.js -t "invalidates downstream stages"
```

Expected: FAIL because saving a reopened Second Stage currently succeeds without confirmation and leaves Summary current.

- [ ] **Step 3: Add the explicit terminal-result helper**

In `rules.js`, add and export:

```js
function deriveExplicitTerminalSnapshot(stageCode, data = {}) {
  if (stageCode === 'testing' && Number(data.paid_enabled) === 0) {
    return {
      endType: 'payment_not_enabled',
      endReason: '店长未确认开启付费'
    };
  }
  if (stageCode === 'testing' && data.potential_status === '不符合') {
    return deriveEndSnapshot(stageCode, data);
  }
  if (stageCode === 'monitoring' && data.link_status === 'protect_roi') {
    return deriveEndSnapshot(stageCode, data);
  }
  return null;
}
```

The `paid_enabled` branch must precede the potential branch so an explicit payment rejection wins when stale potential data is also present. `null`, empty strings, and continuing values return `null`.

- [ ] **Step 4: Re-run the focused test**

Run the same Jest command. Expected: the test still FAILS at the service behavior, while direct helper assertions pass.

- [ ] **Step 5: Commit the isolated rule and failing coverage locally**

```powershell
git add -- standalone-server/services/payment-tracking/rules.js standalone-server/tests/api/payment-tracking.test.js
git commit -m "test: define terminal payment stage edits"
```

Do not push.

### Task 2: Atomically Invalidate Downstream Data

**Files:**
- Modify: `standalone-server/services/payment-tracking/repository.js`
- Modify: `standalone-server/services/payment-tracking/workflow.service.js`
- Test: `standalone-server/tests/api/payment-tracking.test.js`

- [ ] **Step 1: Extend the failing test fixture with every downstream data type**

For the Second Stage case, insert:

```js
const imageRoot = 'C:/payment-test-images';
await execute(
  "INSERT INTO payment_selection_monitoring (record_id, link_optimized, link_status) VALUES (?, 1, 'keep_breaking')",
  [recordId]
);
const [adjustment] = await execute(
  `INSERT INTO payment_selection_adjustment
     (record_id, client_key, sort_order, reason, detail_text, feedback_text)
   VALUES (?, 'invalidate-me', 0, '旧调整', '旧操作', '旧备注')`,
  [recordId]
);
await execute(
  "INSERT INTO payment_selection_summary (record_id, summary_text) VALUES (?, '旧总结')",
  [recordId]
);
await execute(
  `INSERT INTO payment_selection_image
     (record_id, category, adjustment_id, storage_root, relative_path, original_name, mime_type)
   VALUES (?, 'link_optimization', NULL, ?, 'link.png', 'link.png', 'image/png'),
          (?, 'adjustment_feedback', ?, ?, 'feedback.png', 'feedback.png', 'image/png')`,
  [recordId, imageRoot, recordId, adjustment.insertId, imageRoot]
);
```

Also insert a Monitoring-owned link status. After the confirmed save, assert:

```js
expect(result.body.data).toMatchObject({
  currentStage: 'testing',
  processStatus: 'ended',
  endStage: 'testing',
  endType: 'payment_not_enabled',
  endReason: '店长未确认开启付费'
});
expect(result.body.data.stages.map(item => item.stageCode))
  .toEqual(['selection', 'testing']);
expect(result.body.data.stageData.monitoring).toBeUndefined();
expect(result.body.data.stageData.summary).toBeUndefined();
expect(result.body.data.images.some(image => image.category === 'potential_judgment')).toBe(true);
expect(result.body.data.images.some(image => image.category === 'link_optimization')).toBe(false);
expect(result.body.data.linkStatus).toBeNull();
```

Query `payment_selection_image` including deleted rows and assert the later image rows have non-null `deleted_at` rather than being physically deleted.

- [ ] **Step 2: Add repository cleanup with stage-order ownership**

In `repository.js`, import `STAGES` from `constants.js` and add:

```js
const DOWNSTREAM_TABLES = {
  testing: 'payment_selection_testing',
  monitoring: 'payment_selection_monitoring',
  summary: 'payment_selection_summary'
};

const STAGE_IMAGE_CATEGORIES = {
  monitoring: ['link_optimization', 'adjustment_feedback'],
  summary: []
};
```

Implement and export `invalidateStagesAfter(conn, recordId, stageCode)`:

```js
async function invalidateStagesAfter(conn, recordId, stageCode) {
  const index = STAGES.indexOf(stageCode);
  if (index < 0) throw new Error(`Unsupported stage: ${stageCode}`);
  const downstream = STAGES.slice(index + 1);
  if (!downstream.length) return;

  const categories = downstream.flatMap(code => STAGE_IMAGE_CATEGORIES[code] || []);
  if (categories.length) {
    const marks = categories.map(() => '?').join(',');
    await conn.execute(
      `UPDATE payment_selection_image SET deleted_at = CURRENT_TIMESTAMP
       WHERE record_id = ? AND category IN (${marks}) AND deleted_at IS NULL`,
      [recordId, ...categories]
    );
  }

  if (downstream.includes('monitoring')) {
    await conn.execute('DELETE FROM payment_selection_adjustment WHERE record_id = ?', [recordId]);
  }
  for (const code of [...downstream].reverse()) {
    const table = DOWNSTREAM_TABLES[code];
    if (table) await conn.execute(`DELETE FROM ${table} WHERE record_id = ?`, [recordId]);
  }

  const marks = downstream.map(() => '?').join(',');
  await conn.execute(
    `DELETE FROM payment_selection_link_status
     WHERE record_id = ? AND stage_code IN (${marks})`,
    [recordId, ...downstream]
  );
  await conn.execute(
    `DELETE FROM payment_selection_stage
     WHERE record_id = ? AND stage_code IN (${marks})`,
    [recordId, ...downstream]
  );
}
```

Keep current-stage data and current-stage images out of these mappings.

- [ ] **Step 3: Coordinate confirmed invalidation in `saveStage`**

Import `deriveExplicitTerminalSnapshot`. After loading `existing`, merge normalized changes without losing unsupplied fields:

```js
const merged = { ...existing, ...changes };
const terminalSnapshot = Number(stage.is_reopened)
  ? deriveExplicitTerminalSnapshot(stageCode, merged)
  : null;
const requiresInvalidation = Boolean(
  terminalSnapshot && record.current_stage !== stageCode
);

if (requiresInvalidation && payload?.confirmDownstreamInvalidation !== true) {
  const error = new AppError(400, '该修改会作废后续阶段，请确认后重试');
  error.data = { requiresDownstreamInvalidation: true, stageCode };
  throw error;
}
```

After `saveStageData`, branch before the existing version update:

```js
if (requiresInvalidation) {
  await repository.invalidateStagesAfter(conn, record.id, stageCode);
  await repository.markStageEnded(conn, record.id, stageCode);
  const updated = await repository.updateRecordWithVersion(conn, record.id, version, {
    current_stage: stageCode,
    process_status: 'ended',
    end_stage: stageCode,
    end_type: terminalSnapshot.endType,
    end_reason: terminalSnapshot.endReason,
    ended_at: localDateTime()
  });
  if (!updated) throw conflictError();
  return;
}
```

Leave normal save/relock behavior unchanged. This keeps exactly one version increment.

- [ ] **Step 4: Add the remaining branch and preservation tests**

In `payment-tracking.test.js`, add cases that assert:

```js
// testing + 不符合 -> ended at testing with existing unqualified-action reason
expect(record.endReason).toBe('未达潜力款 · 后续操作：直接关闭');

// monitoring + protect_roi -> summary removed, monitoring data/images retained
expect(record.stages.map(item => item.stageCode))
  .toEqual(['selection', 'testing', 'monitoring']);
expect(record.endReason).toBe('链接状态：保投产');

// continuing historical edit -> no invalidation
expect(record.currentStage).toBe('summary');
expect(record.processStatus).toBe('in_progress');
expect(record.stages.map(item => item.stageCode))
  .toEqual(['selection', 'testing', 'monitoring', 'summary']);
```

Include a version-conflict request and assert it does not delete any downstream row.

Also force a failure after the stage data save and verify SQLite snapshot rollback:

```js
const repository = require('../../services/payment-tracking/repository');
const invalidateSpy = jest.spyOn(repository, 'invalidateStagesAfter')
  .mockRejectedValueOnce(new Error('forced downstream cleanup failure'));

const failed = await request(app)
  .put(`/api/payment-tracking/records/${recordId}/stages/testing`)
  .set('Authorization', `Bearer ${reopenerToken}`)
  .send({
    version: reopened.body.data.version,
    confirmDownstreamInvalidation: true,
    data: { paidEnabled: false }
  });
invalidateSpy.mockRestore();
expect(failed.body.code).not.toBe(0);
```

Reload through the API and assert the old Second Stage value, Summary current stage, all later nodes, later images, and link status remain unchanged.

- [ ] **Step 5: Run the backend workflow suite**

```powershell
npm test -- --runInBand tests/api/payment-tracking.test.js
```

Expected: all tests in the file PASS.

- [ ] **Step 6: Commit the transaction implementation locally**

```powershell
git add -- standalone-server/services/payment-tracking/rules.js standalone-server/services/payment-tracking/repository.js standalone-server/services/payment-tracking/workflow.service.js standalone-server/tests/api/payment-tracking.test.js
git commit -m "feat: invalidate downstream payment stages"
```

Do not push.

### Task 3: Add the Third Stage Link-Optimization Image Category

**Files:**
- Modify: `standalone-server/services/payment-tracking/image.service.js`
- Test: `standalone-server/tests/api/payment-tracking-images.test.js`

- [ ] **Step 1: Write the failing image ownership test**

Create or reuse a record whose current stage is Monitoring, then upload:

```js
const uploaded = await request(app)
  .post(`/api/payment-tracking/records/${stageRecordId}/images/link_optimization`)
  .set('Authorization', `Bearer ${storeAToken}`)
  .field('version', String(stageRecordVersion))
  .attach('files', PNG, { filename: 'link-proof.png', contentType: 'image/png' });

expect(uploaded.body.code).toBe(0);
expect(uploaded.body.data.images).toEqual(expect.arrayContaining([
  expect.objectContaining({
    category: 'link_optimization',
    originalName: 'link-proof.png',
    adjustmentId: null
  })
]));
```

Advance the record to Summary and assert upload is forbidden until Monitoring is reopened. Reopen Monitoring, upload again, delete one image, and verify the normal version and store checks still apply.

- [ ] **Step 2: Run the image suite and verify failure**

```powershell
npm test -- --runInBand tests/api/payment-tracking-images.test.js -t "link optimization"
```

Expected: FAIL with invalid image category.

- [ ] **Step 3: Map the category to Monitoring**

Add one entry to `IMAGE_STAGE` in `image.service.js`:

```js
link_optimization: 'monitoring',
```

Do not add adjustment ownership because this gallery belongs directly to the stage, not to a promotion adjustment.

- [ ] **Step 4: Run the full image API suite**

```powershell
npm test -- --runInBand tests/api/payment-tracking-images.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Commit the image category locally**

```powershell
git add -- standalone-server/services/payment-tracking/image.service.js standalone-server/tests/api/payment-tracking-images.test.js
git commit -m "feat: add link optimization images"
```

Do not push.

### Task 4: Confirm Destructive Historical Saves in the Stage Page

**Files:**
- Modify: `src/views/payment-tracking/StageDetail.vue`
- Modify: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: Add a reopened historical fixture and failing browser test**

Add a mock record at Summary with Second Stage reopened:

```js
const reopenedTestingRecord = {
  ...baseRecord,
  id: 110,
  currentStage: 'summary',
  processStatus: 'in_progress',
  stages: [
    stage('selection'),
    { ...stage('testing'), isReopened: true },
    stage('monitoring'),
    stage('summary', 'active')
  ],
  stageData: {
    testing: {
      paidEnabled: true,
      paidAt: '2026-08-23 10:00:00',
      potentialStatus: '符合潜力款标准'
    },
    monitoring: { linkOptimized: true, linkStatus: 'keep_breaking', adjustments: [] },
    summary: { summaryText: '旧总结' }
  },
  allowedActions: { edit: true, reopen: true, end: true }
};
```

Test that selecting payment “否” and clicking save opens the warning. Cancel and assert no PUT request. Confirm and assert the request body contains `confirmDownstreamInvalidation: true`, then assert navigation to `/payment-tracking/records`.

- [ ] **Step 2: Run the focused Playwright test and verify failure**

```powershell
npx playwright test --config=playwright.payment-tracking.config.js --project=desktop -g "重开历史阶段终止分支"
```

Expected: FAIL because the current page saves without the invalidation warning or confirmation flag.

- [ ] **Step 3: Add a precise terminal-edit computed value**

In `StageDetail.vue`:

```js
const isTerminalHistoricalEdit = computed(() => {
  if (!currentStageEntry.value?.isReopened || isCurrentStage.value) return false
  if (stageCode.value === 'testing') {
    return formData.value.paidEnabled === false
      || formData.value.potentialStatus === '不符合'
  }
  return stageCode.value === 'monitoring'
    && formData.value.linkStatus === 'protect_roi'
})
```

- [ ] **Step 4: Confirm and submit from `saveCurrentStage`**

Before setting `saving`, prompt only when `isTerminalHistoricalEdit` is true and the caller has not already confirmed:

```js
let confirmDownstreamInvalidation = false
if (isTerminalHistoricalEdit.value) {
  await ElMessageBox.confirm(
    '该修改将作废后续阶段的内容、图片和状态，并将流程结束于当前阶段。是否继续？',
    '作废后续阶段',
    { confirmButtonText: '确认并结束', type: 'warning' }
  )
  confirmDownstreamInvalidation = true
}
```

Include the flag beside `version` and `data`. When the returned record has `processStatus === 'ended'`, show `流程已结束于${stageTitle.value}` and `await router.replace('/payment-tracking/records')`.

Keep cancel/close local: do not show an error and do not submit. If `saveCurrentStage` is called as preparation for an adjustment upload and the save ends the process, return `null` so the subsequent image upload does not run against an ended record.

- [ ] **Step 5: Update the route mock to return the truncated record**

When the mock receives `confirmDownstreamInvalidation: true`, return:

```js
const updated = {
  ...current,
  version: current.version + 1,
  currentStage: stageCode,
  processStatus: 'ended',
  endStage: stageCode,
  endType: 'payment_not_enabled',
  endReason: '店长未确认开启付费',
  stages: current.stages.filter(item =>
    ['selection', stageCode].includes(item.stageCode)
  ).map(item => item.stageCode === stageCode
    ? { ...item, stageStatus: 'ended', isReopened: false }
    : item)
};
```

- [ ] **Step 6: Run the focused Playwright test**

Run the command from Step 2. Expected: PASS in desktop.

- [ ] **Step 7: Commit the confirmation flow locally**

```powershell
git add -- src/views/payment-tracking/StageDetail.vue tests/payment-tracking/payment-tracking.spec.js
git commit -m "feat: confirm downstream payment invalidation"
```

Do not push.

### Task 5: Render Conditional Third Stage Images Beside Link Optimization

**Files:**
- Modify: `src/views/payment-tracking/forms/MonitoringForm.vue`
- Modify: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: Extend Third Stage fixtures and write the failing UI test**

Give record 105 an existing stage image:

```js
{ id: 603, category: 'link_optimization', adjustmentId: null,
  originalName: 'link-before.png', sortOrder: 0 }
```

Assert on record 105 (`linkOptimized: true`) that:

```js
const optimization = page.locator('.link-optimization-layout')
await expect(optimization.getByText('图片上传区', { exact: true })).toBeVisible()
await expect(optimization).toContainText('link-before.png')
```

Upload `link-after.png` and assert the POST path ends with `/images/link_optimization` and contains no `adjustmentId`. On record 106 (`linkOptimized: false`), assert the upload region does not exist; select “是” and assert it appears.

- [ ] **Step 2: Run the focused UI test and verify failure**

```powershell
npx playwright test --config=playwright.payment-tracking.config.js --project=desktop -g "第三阶段按链接状态分支"
```

Expected: FAIL because MonitoringForm does not render a link-optimization image gallery.

- [ ] **Step 3: Render the existing `ImageGallery` conditionally**

In `MonitoringForm.vue`, import `ImageGallery` and extend the existing section:

```vue
<section class="form-section">
  <h2>链接优化</h2>
  <div class="link-optimization-layout">
    <el-form-item label="是否做链接优化">
      <el-radio-group v-model="model.linkOptimized" :disabled="readonly">
        <el-radio :value="true">是</el-radio>
        <el-radio :value="false">否</el-radio>
      </el-radio-group>
    </el-form-item>
    <ImageGallery
      v-if="model.linkOptimized === true"
      :record-id="record.id"
      :version="record.version"
      :images="record.images"
      category="link_optimization"
      label="图片上传区"
      :readonly="readonly"
      @record-updated="emit('record-updated', $event)"
      @reload-requested="emit('reload-requested')"
    />
  </div>
</section>
```

Do not clear images when `linkOptimized` changes to false.

- [ ] **Step 4: Add stable responsive layout CSS**

```css
.link-optimization-layout {
  display: grid;
  grid-template-columns: minmax(180px, 0.42fr) minmax(320px, 1fr);
  align-items: start;
  gap: 28px;
  min-width: 0;
}

@media (max-width: 1100px) {
  .link-optimization-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
```

Keep the section's existing 6px card radius and neutral palette.

- [ ] **Step 5: Run desktop and compact tests**

```powershell
npx playwright test --config=playwright.payment-tracking.config.js -g "第三阶段按链接状态分支|重开历史阶段终止分支"
```

Expected: both `desktop` and `compact-desktop` PASS with no horizontal overflow.

- [ ] **Step 6: Commit the conditional gallery locally**

```powershell
git add -- src/views/payment-tracking/forms/MonitoringForm.vue tests/payment-tracking/payment-tracking.spec.js
git commit -m "feat: show third-stage optimization images"
```

Do not push.

### Task 6: Full Regression Verification and Local Runtime Restart

**Files:**
- Verify all files modified in Tasks 1-5.

- [ ] **Step 1: Run all payment backend suites**

From `standalone-server`:

```powershell
npm test -- --runInBand tests/api/payment-tracking.test.js tests/api/payment-tracking-images.test.js tests/api/payment-tracking-schema.test.js tests/api/payment-tracking-access.test.js
```

Expected: all selected suites PASS.

- [ ] **Step 2: Run all payment Playwright tests**

From the repository root:

```powershell
npx playwright test --config=playwright.payment-tracking.config.js
```

Expected: desktop and compact-desktop projects PASS.

- [ ] **Step 3: Run task-page regression tests**

```powershell
npx playwright test --config=playwright.task-pages.config.js
```

Expected: all task-page tests PASS, demonstrating the existing task workflow was not changed.

- [ ] **Step 4: Check the diff without building**

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors. Do not run `npm run build`, `vite build`, Electron build, or any packaging command.

- [ ] **Step 5: Commit any final focused test corrections locally**

Stage only files belonging to this feature and commit:

```powershell
git add -- standalone-server/services/payment-tracking/rules.js standalone-server/services/payment-tracking/repository.js standalone-server/services/payment-tracking/workflow.service.js standalone-server/services/payment-tracking/image.service.js standalone-server/tests/api/payment-tracking.test.js standalone-server/tests/api/payment-tracking-images.test.js src/views/payment-tracking/StageDetail.vue src/views/payment-tracking/forms/MonitoringForm.vue tests/payment-tracking/payment-tracking.spec.js
git commit -m "test: verify payment downstream invalidation"
```

Skip the commit if there are no remaining feature changes. Do not stage unrelated dirty-worktree files and do not push.

- [ ] **Step 6: Restart only the local backend and verify both local URLs**

Stop the existing local backend process bound to port `18632`, verify the executable path/command belongs to this workspace, then restart it with the existing local SQLite environment. Do not touch any production process. Keep the existing Vite frontend if healthy; otherwise restart it on `127.0.0.1:5173`.

Verify:

```powershell
Invoke-RestMethod http://127.0.0.1:18632/api/health
Invoke-WebRequest http://127.0.0.1:5173 -UseBasicParsing
```

Expected: backend health returns `code: 0` and frontend returns HTTP 200.
