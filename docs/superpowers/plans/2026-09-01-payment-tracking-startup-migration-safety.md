# Payment Tracking Startup Migration Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make payment-tracking startup migration safe for production MySQL and repeat server restarts.

**Architecture:** Keep schema checks repeatable, use engine-specific SQL only where MySQL requires a self-join, and guard destructive legacy data conversion with a `sys_config` marker. Preserve current workflow fields and only infer legacy link status from explicit historical evidence.

**Tech Stack:** Node.js, MySQL 8, sql.js/SQLite, Jest

---

### Task 1: Add migration regressions

**Files:**
- Modify: `standalone-server/tests/api/payment-tracking.test.js:1197`

- [x] Add an active promotion value to the legacy testing fixture and assert that it survives two migration calls.
- [x] Add a partially saved monitoring fixture with blank `link_status` and assert that it remains blank after two migration calls.
- [x] Capture MySQL-mode SQL through a fake executor and assert that stage-to-stage updates use `UPDATE ... JOIN` rather than selecting from the update target.
- [x] Run `npm test -- --runInBand tests/api/payment-tracking.test.js` from `standalone-server` and confirm the new assertions fail before implementation.

### Task 2: Make data migration restart-safe

**Files:**
- Modify: `standalone-server/config/payment-tracking-migration.js:1-262`

- [x] Add `WORKFLOW_DATA_MIGRATION_MARKER = 'migration.payment_tracking_workflow_data.v1'`.
- [x] Replace MySQL self-target subqueries with explicit self-join updates while retaining SQLite statements.
- [x] Remove `promotion_method` from `clearRetiredValues`.
- [x] Restrict old monitoring conversion to `abandoned = 1` or a completed monitoring stage.
- [x] Run legacy data conversion only when the workflow marker is absent, then insert the marker after successful completion.
- [x] Re-run the focused migration tests and confirm they pass.

### Task 3: Verify and record

**Files:**
- Modify: `standalone-server/config/payment-tracking-migration.js`
- Modify: `standalone-server/tests/api/payment-tracking.test.js`

- [x] Run `npm test -- --runInBand` from `standalone-server` and require zero failures.
- [x] Run `git diff --check` for the files changed by this fix.
- [x] Inspect the final diff and confirm no frontend, packaging, production environment, or unrelated task-flow files were changed.
- [x] Commit only this migration fix and its focused documentation/tests to the current local branch; do not push.
