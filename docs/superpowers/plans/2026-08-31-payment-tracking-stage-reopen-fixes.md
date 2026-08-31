# Payment Tracking Stage Reopen Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve and correctly display second- and third-stage payment tracking data across reopen and link-status operations while keeping stage images isolated.

**Architecture:** Normalize nullable database booleans at the backend record-presentation boundary so every frontend consumer receives `true`, `false`, or `null` consistently. Keep current form drafts local when a link-status response refreshes record metadata, and make the second-stage downstream sections conditional on confirmed payment without deleting their stored values.

**Tech Stack:** Node.js, Express, SQLite/MySQL-compatible repository layer, Vue 3, Element Plus, Jest/Supertest, Playwright.

---

### Task 1: Normalize Stage Boolean API Values

**Files:**
- Modify: `standalone-server/tests/api/payment-tracking.test.js:492-562`
- Modify: `standalone-server/services/payment-tracking/record.service.js:32-75`

- [ ] **Step 1: Write the failing API assertions**

Extend the workflow API test so it saves and verifies nullable boolean fields as booleans rather than SQLite integers:

```js
data: {
  paidEnabled: true,
  paidAt: '2026-09-01',
  weiStockReported: false
}

expect(reviewed.body.data.stageData.testing).toMatchObject({
  paidEnabled: true,
  weiStockReported: false
});

expect(protectedLink.body.data.stageData.monitoring).toMatchObject({
  linkOptimized: true,
  linkStatus: 'protect_roi'
});

.send({ version: summary.body.data.version, data: { exploded: false } });
expect(summarySaved.body.data.stageData.summary.exploded).toBe(false);
```

- [ ] **Step 2: Run the focused test and verify failure**

Run `cd standalone-server; npx jest tests/api/payment-tracking.test.js --runInBand`.

Expected: FAIL because the stage booleans are returned as `0/1`.

- [ ] **Step 3: Normalize known stage booleans in the presentation layer**

In `record.service.js`, define the API fields that are nullable booleans and normalize them immediately after `snakeToCamel`:

```js
const STAGE_BOOLEAN_FIELDS = {
  testing: ['paidEnabled', 'weiStockReported'],
  monitoring: ['linkOptimized'],
  summary: ['exploded']
};

function presentNullableBoolean(value) {
  if (value === null || value === undefined) return null;
  return value === true || Number(value) === 1;
}

function presentStageData(stageData) {
  const presented = snakeToCamel(stageData);
  for (const [stageCode, fields] of Object.entries(STAGE_BOOLEAN_FIELDS)) {
    if (!presented[stageCode]) continue;
    for (const field of fields) {
      presented[stageCode][field] = presentNullableBoolean(presented[stageCode][field]);
    }
  }
  return presented;
}
```

Use `presentStageData(stageData)` in `presentRecord`. This changes only response types and does not write to the database.

- [ ] **Step 4: Run the focused backend test and verify pass**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit the backend contract fix**

```powershell
git add standalone-server/services/payment-tracking/record.service.js standalone-server/tests/api/payment-tracking.test.js
git commit -m "fix: normalize payment stage booleans"
```

### Task 2: Gate Second-Stage Sections Without Clearing Data

**Files:**
- Modify: `tests/payment-tracking/payment-tracking.spec.js:48-77,736-794,894-921`
- Modify: `src/views/payment-tracking/forms/TestingForm.vue:1-145`
- Modify: `src/views/payment-tracking/StageDetail.vue:202-216`

- [ ] **Step 1: Write failing conditional-display tests**

Add assertions that a record with `paidEnabled: true` shows the paid time and downstream sections, while a record with `paidEnabled: null` hides them and has no advance button. Toggle “确认开启付费” from “是” to “否”, verify downstream sections disappear, toggle back to “是”, and verify the original promotion and image remain.

Add both image categories to the second-stage fixture:

```js
images: [
  { id: 510, category: 'product_main', originalName: 'selection-main.png', sortOrder: 0 },
  { id: 511, category: 'potential_judgment', originalName: 'testing-proof.png', sortOrder: 0 }
]
```

Assert the second-stage gallery contains `testing-proof.png`, does not contain `selection-main.png`, and uses the label “图片上传区”.

- [ ] **Step 2: Run the focused Playwright test and verify failure**

Run `npx playwright test --config=playwright.payment-tracking.config.js --project=desktop -g "选品时间与未来节点|各阶段关键必填条件"`.

Expected: FAIL because downstream sections are always rendered, the old image label remains, and the invalid advance button is available.

- [ ] **Step 3: Implement conditional rendering and validation**

In `TestingForm.vue`, show paid time and each downstream section only when `model.paidEnabled === true`. Rename both the image heading and `ImageGallery` label to “图片上传区”. Keep `model` values unchanged when sections unmount.

Replace the paid-time rule with:

```js
paidAt: [{
  validator: (_rule, value, callback) => {
    if (model.value.paidEnabled !== true || value) return callback()
    callback(new Error('请选择付费时间'))
  },
  trigger: 'change'
}]
```

In `StageDetail.vue`, require confirmed payment in the testing branch gate:

```js
if (stageCode.value === 'testing') {
  return formData.value.paidEnabled === true
    && formData.value.potentialStatus === '符合潜力款标准'
}
```

- [ ] **Step 4: Run the focused Playwright test and verify pass**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit the second-stage UI fix**

```powershell
git add src/views/payment-tracking/forms/TestingForm.vue src/views/payment-tracking/StageDetail.vue tests/payment-tracking/payment-tracking.spec.js
git commit -m "fix: gate payment testing details"
```

### Task 3: Preserve Unsaved Forms When Saving Link Status

**Files:**
- Modify: `tests/payment-tracking/payment-tracking.spec.js:923-963`
- Modify: `src/views/payment-tracking/StageDetail.vue:380-394`

- [ ] **Step 1: Write the failing draft-preservation test**

On the third-stage fixture, switch “是否做链接优化” from “是” to “否” without saving the stage. Clear and save the link-status dialog, then assert the “否” radio remains selected. Repeat on the second-stage fixture after changing “推广方式” to “全站推广”, and assert that selection remains after saving the link status.

- [ ] **Step 2: Run the focused Playwright test and verify failure**

Run `npx playwright test --config=playwright.payment-tracking.config.js --project=desktop -g "链接状态弹窗保存"`.

Expected: FAIL because the response rebuilds `formData` from saved server stage data.

- [ ] **Step 3: Preserve the local form draft**

Update the successful link-status response handling:

```js
if (response.code === 0) {
  applyRecord(response.data, false)
  linkStatusDialogVisible.value = false
  ElMessage.success(payload.clear ? '链接状态已清空' : '链接状态已保存')
}
```

- [ ] **Step 4: Run the focused test and verify pass**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit the draft-preservation fix**

```powershell
git add src/views/payment-tracking/StageDetail.vue tests/payment-tracking/payment-tracking.spec.js
git commit -m "fix: preserve stage draft on link status save"
```

### Task 4: Regression Verification

**Files:**
- Verify only; do not build or package.

- [ ] **Step 1: Run all backend payment-tracking suites**

Run `cd standalone-server; npx jest tests/unit/payment-tracking-rules.test.js tests/api/payment-tracking.test.js tests/api/payment-tracking-images.test.js tests/api/payment-tracking-schema.test.js --runInBand`.

Expected: all suites and tests PASS using temporary SQLite databases.

- [ ] **Step 2: Run the full payment-tracking frontend suite**

Run `npm run test:payment-tracking`. Expected: all desktop and compact-desktop tests PASS.

- [ ] **Step 3: Run the task-page regression suite**

Run `npm run test:task-pages`. Expected: all task-page tests PASS.

- [ ] **Step 4: Verify the real local record and server isolation**

Read local SQLite record `D-3 / #008` and confirm `paid_enabled`, `wei_stock_reported`, and `link_optimized` remain unchanged. Verify backend health at `http://127.0.0.1:18632` and frontend at `http://127.0.0.1:5173`.

- [ ] **Step 5: Review the final diff and local commits**

Run `git diff --check HEAD~3..HEAD`, `git status --short`, and `git log -4 --oneline`.

Expected: no whitespace errors; unrelated dirty changes remain untouched; no remote push and no build artifacts are created.
