# Task Detail Display and Payment Opening Design

**Date:** 2026-08-28

## Goal

Improve the role-specific task detail presentation, upload-dialog layering, payment-stage selection form presentation, and the single-task payment-opening state check without changing task APIs, permissions, upload/download behavior, validation, review actions, or task workflow transitions.

## Scope and Non-Goals

This change is frontend-only. It covers the shared `TaskDetail` presentation, the selection-stage form and image gallery, the designer statistics card list, and the payment-opening button state in the operator design review page.

The following remain unchanged: API endpoints and payloads, backend authorization, database schema and data, task status transitions, review/approve/reject handlers, upload validation, image sorting/deletion semantics, drag-to-desktop file naming, and production configuration. No build or package operation is part of this work.

## Current Context

Task details are rendered by `src/components/TaskDetail.vue` and selected by the `detailContext` passed by each page. The visible contexts involved here are `hall`, `published`, `design-assignee`, `admin`, `review`, and `cs-assignee`. The selection-stage route uses `StageDetail.vue`, `SelectionForm.vue`, and `ImageGallery.vue`.

The operator review list reads `payment_tracking_opened` from a MySQL `EXISTS` expression. The local MySQL connection uses `bigNumberStrings: true`, so the value is returned as the strings `'0'` and `'1'`. The current `Boolean(row.payment_tracking_opened)` check treats both non-empty strings as true, disabling buttons for unopened tasks.

## Design

### 1. Context-isolated detail fields

Keep the existing context branch in `TaskDetail.vue` as the ownership boundary. Adjust only the field definitions and rendering metadata for the requested context. Values continue to come directly from the existing task object.

| Context | Fields to show/change |
| --- | --- |
| `admin` + design | Keep existing fields; add `款号` from `task.style_number`, `指定颜色` from `task.specified_color`, and `参考路径` from `task.ref_path`. Keep `上传路径` from `task.work_path`. |
| `published` + design | Keep existing fields; hide `截止时间`; keep `工作项目`, `分值`, `款号`, `指定颜色`; render `参考路径` and `上传路径` as independent full-width detail rows. |
| `review` + design | Keep existing `工作项目`; add `分值`, `款号`, `指定颜色`; hide `截止时间`; render both paths as independent full-width detail rows. Existing review actions remain in the page slot. |
| `hall` + design | Render `工作项目` from the task's actual `title` (with the existing safe fallback only if the source truly has no title); remove the separate `任务标题` row and `截止时间`; render available reference/upload paths as independent rows. |
| `design-assignee` | Keep current role-specific fields; hide `截止时间`; render reference/upload paths as independent rows. Do not add a score field. |
| `cs-assignee` | Keep field set and behavior unchanged. |
| Other contexts | Keep field set and behavior unchanged. |

Independent path rows use the same visual treatment as the task-description row: a stable label column, a flexible value column, full-width placement, wrapping for long paths, and no change to value formatting or fallback semantics. The description row remains a separate row.

### 2. Layering for upload dialogs

The upload dialogs opened from basic-designer and designer task details will be mounted under `body` and assigned a layer above the unified task detail overlay. The dialog remains controlled by the existing `uploadVisible` state and continues to invoke the same `openUpload`, file-change, paste, upload, close, and refresh handlers.

No upload field, file limit, progress behavior, applied-score behavior, or task-status behavior changes. Only the dialog mounting/stacking presentation changes.

### 3. Payment-opening state normalization

Add a small local predicate in `src/views/shared/Review.vue` that treats numeric or string `1` (and the existing boolean true form) as opened, and numeric or string `0` (plus null/undefined/empty) as not opened. Use the predicate consistently for:

- table-row button disabled state;
- detail-action button disabled state;
- the early-return guard in the single-task handler.

The permission gate remains `taskGroup === 'design' && hasPermission('payment.open')`; the backend endpoint and response handling remain unchanged. Batch opening keeps its existing selection and result-summary behavior.

### 4. Designer statistics cards

In `src/views/designer/Stats.vue`, remove exactly these three card definitions:

- `total_score` / `累计分值`;
- `total` / `总接单量`;
- `finished_count` / `已完成`.

Keep all remaining cards and the shared `StatsPanel` unchanged.

### 5. Selection-stage presentation

Keep `StageDetail.vue` as the workflow shell: header, source-task link, stage actions, stage timeline, form component selection, save/advance/end/reopen/restore handlers, and route transitions remain intact.

Update the presentation in `SelectionForm.vue` and `ImageGallery.vue` to match the unified detail visual language:

- use consistent section headings, separators, spacing, and four-column field alignment;
- keep the existing field models, validation rules, readonly rules, and gross-margin calculation;
- make each image category a clearly bounded gallery section;
- replace the compact `上传图片` button with a fixed-size dashed upload dropzone that supports click-to-select and drag-and-drop;
- keep existing image preview, sort, delete, source-task drag filename registration, version-conflict reload, and upload API behavior;
- keep image delete controls available so an incorrect image can be removed and replaced.

The dropzone is a presentation wrapper around the current hidden file input; it does not introduce a second upload path.

## Error and Edge Handling

- A missing task title continues to use the existing fallback instead of throwing; a populated title must never be replaced by `-` in the task-hall work-project field.
- A missing path keeps the existing empty-value convention; when present, the path is rendered in its own row and wraps rather than overflowing.
- The payment button is disabled only when the normalized opened state is true or the existing work-image prerequisite is absent.
- Upload errors, file limits, version conflicts, and permission errors continue through existing handlers and HTTP interceptors.

## Verification

Add or update focused Playwright coverage in the existing task-page and payment-tracking suites:

1. Assert each context's required labels and forbidden labels, including admin-design reference path, operator-review score/style/color, hidden deadlines, and task-hall title mapping.
2. Assert reference/upload paths use independent detail rows in operator and designer contexts.
3. Assert the basic-designer and designer upload dialogs are above the detail overlay when opened.
4. Assert designer statistics no longer render the three removed cards and retain the other cards.
5. Assert an operator review task with `payment_tracking_opened: '0'` has an enabled single-open button, while `'1'` is disabled and no request is sent.
6. Assert the selection image gallery exposes a dropzone and retains delete controls.

Run `npm run test:task-pages`, `npm run test:payment-tracking`, and `git diff --check HEAD`. Do not run `npm run build`, Electron packaging, Docker builds, or any production endpoint.

## File Ownership

- `src/components/TaskDetail.vue`: context-specific fields and independent path-row rendering.
- `src/views/shared/Review.vue`: payment-opened normalization only.
- `src/views/basic/MyTasks.vue` and `src/views/designer/MyTasks.vue`: upload-dialog mount/stack presentation only.
- `src/views/designer/Stats.vue`: remove the three card definitions.
- `src/views/payment-tracking/forms/SelectionForm.vue`: selection form section presentation.
- `src/components/payment-tracking/ImageGallery.vue`: upload dropzone presentation while retaining existing image actions.
- `tests/task-pages/task-page-features.spec.js` and `tests/payment-tracking/payment-tracking.spec.js`: focused regression coverage.
