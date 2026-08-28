# Task Detail Display and Payment Opening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved role-specific detail layout, upload-layer, selection-form presentation, statistics-card, and payment-button state fixes without changing task workflow behavior.

**Architecture:** Keep `TaskDetail.vue` as the single context-aware field source and add a separate path-row presentation layer beside the existing description row. Keep page handlers and APIs unchanged; make dialog stacking a template/style-only change, normalize the MySQL string flag locally in `Review.vue`, and style the existing payment selection form/image gallery in place.

**Tech Stack:** Vue 3 `<script setup>`, Element Plus, Vite, Playwright, existing local MySQL-backed standalone server.

---

### Task 1: Add regression coverage for context fields and payment flag

**Files:**
- Modify: `tests/task-pages/task-page-features.spec.js`
- Modify: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: Extend task-detail assertions**

Add assertions for admin design reference path/style/color, operator review score/style/color and hidden deadline, designer hall title mapping/hidden deadline/title-row, and independent path-row selectors for published/review/design-assignee contexts. Keep existing role-isolation assertions unchanged.

- [ ] **Step 2: Add upload-layer assertions**

Open the basic-designer and designer detail upload actions and assert the visible upload dialog has a higher effective `z-index` than `.task-detail-layer` while both are open.

- [ ] **Step 3: Add payment flag fixtures/assertions**

Extend the payment review mock rows with string values `'0'` and `'1'`; assert the first single-open button is enabled, the opened row is disabled, and no click handler request is sent for the opened row.

- [ ] **Step 4: Run the focused tests before implementation**

Run:

```powershell
npm run test:task-pages -- tests/task-pages/task-page-features.spec.js
npm run test:payment-tracking -- tests/payment-tracking/payment-tracking.spec.js
```

Expected: the new assertions fail against the current presentation/state bug while existing assertions identify the baseline behavior.

### Task 2: Implement context-isolated detail fields and path rows

**Files:**
- Modify: `src/components/TaskDetail.vue`

- [ ] **Step 1: Add path-row metadata**

Add a computed `detailPathRows` that returns only the requested context's existing `ref_path` and `work_path` values, preserving each current fallback and omitting paths that the context has never shown.

- [ ] **Step 2: Update the field branches**

In the existing `detailFields` branches:

- add style number, specified color, and reference path to `admin + design`;
- remove deadline from `published + design` and `review + design`;
- add score, style number, and specified color to `review + design`;
- use `task.title` for `hall + design` work project, remove its separate task-title and deadline rows;
- remove deadline from `design-assignee`;
- do not alter `cs-assignee` or other contexts.

- [ ] **Step 3: Render independent path rows**

Render `detailPathRows` after the descriptions block and before the description row using the same row structure/class family as the existing description row. Give each row a stable label, wrapping value, and full-width layout.

- [ ] **Step 4: Run task-page tests**

Run `npm run test:task-pages -- tests/task-pages/task-page-features.spec.js` and confirm the new field/row assertions pass without changing action behavior.

### Task 3: Fix upload dialog stacking and designer statistics cards

**Files:**
- Modify: `src/views/basic/MyTasks.vue`
- Modify: `src/views/designer/MyTasks.vue`
- Modify: `src/views/designer/Stats.vue`

- [ ] **Step 1: Mount both upload dialogs above detail**

Add the Element Plus dialog body-mount option and an explicit layer value above the task-detail overlay to the existing basic-designer and designer upload dialogs. Do not change their `v-model`, event handlers, form contents, or close/upload behavior.

- [ ] **Step 2: Remove exactly three designer stats cards**

Delete the `total_score`, `total`, and `finished_count` entries from the designer `cards` computed list; leave all other entries and `StatsPanel` intact.

- [ ] **Step 3: Run focused task-page tests**

Run `npm run test:task-pages -- tests/task-pages/task-page-features.spec.js` and verify stacking and card assertions.

### Task 4: Normalize single-task payment opening state

**Files:**
- Modify: `src/views/shared/Review.vue`

- [ ] **Step 1: Add a local opened-state predicate**

Implement a helper equivalent to:

```js
function isPaymentOpened(value) {
  return value === true || value === 1 || value === '1'
}
```

- [ ] **Step 2: Replace all three Boolean checks**

Use the helper in the table button `disabled` binding, detail action `disabled` binding, and `handleOpenPayment` early-return guard. Keep the existing permission gate, image prerequisite, API call, success/error messages, and reload behavior unchanged.

- [ ] **Step 3: Run payment tests**

Run `npm run test:payment-tracking -- tests/payment-tracking/payment-tracking.spec.js` and confirm both string states behave correctly.

### Task 5: Restyle selection-stage form and image upload zones

**Files:**
- Modify: `src/views/payment-tracking/forms/SelectionForm.vue`
- Modify: `src/components/payment-tracking/ImageGallery.vue`

- [ ] **Step 1: Align selection form sections with detail styling**

Adjust only template classes and scoped CSS so section headings, separators, field spacing, four-column grid, labels, long text, and image-section layout match the unified detail visual language. Preserve all models, rules, `readonly` conditions, computed gross margin, and exposed validation method.

- [ ] **Step 2: Replace the gallery button with a dropzone**

Wrap the existing hidden file input in a fixed-height dashed dropzone that triggers the same `fileInput.click()` on click and handles native drag/drop by forwarding dropped files to the existing upload function. Keep the current `busy` guard, version handling, API call, preview, source-task filename registration, sorting, and delete controls.

- [ ] **Step 3: Run payment-tracking tests**

Run `npm run test:payment-tracking -- tests/payment-tracking/payment-tracking.spec.js` and verify the selection form and image-gallery assertions.

### Task 6: Full verification and local handoff

**Files:**
- No additional source files.

- [ ] **Step 1: Run complete regression suites**

```powershell
npm run test:task-pages
npm run test:payment-tracking
```

Expected: all existing and new tests pass.

- [ ] **Step 2: Check the diff**

Run `git diff --check HEAD` and inspect `git status --short`. Confirm no backend, database, production config, package, build output, or remote changes were introduced.

- [ ] **Step 3: Do not package or push**

Do not run `npm run build`, Electron packaging, Docker builds, `git push`, or any production endpoint request.
