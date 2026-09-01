# Payment Selection Optional Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow payment-selection cost and sale price to be omitted while retaining validation for provided values and accurate gross-margin behavior.

**Architecture:** Keep the existing nullable database fields and stage payload unchanged. Adjust validation at the Vue form and payment workflow rule boundaries, then make gross-margin calculation return `null` unless both operands are present.

**Tech Stack:** Vue 3, Element Plus, Node.js, Jest, Supertest, Playwright

---

### Task 1: Lock the backend behavior with tests

**Files:**
- Modify: `standalone-server/tests/unit/payment-tracking-rules.test.js`
- Modify: `standalone-server/tests/api/payment-tracking.test.js`

- [ ] Add unit assertions that `calculateGrossMargin(null, 75)` and `calculateGrossMargin(24, null)` return `null`.
- [ ] Add a stage advancement assertion using valid required selection fields, `cost: null`, `sale_price: null`, and one product image.
- [ ] Add an API workflow case that saves and advances a selection with both optional fields omitted.
- [ ] Run `npm --prefix standalone-server test -- --runInBand tests/unit/payment-tracking-rules.test.js tests/api/payment-tracking.test.js` and confirm the new assertions fail before implementation.

### Task 2: Make backend pricing optional

**Files:**
- Modify: `standalone-server/services/payment-tracking/rules.js`

- [ ] Return `null` from `calculateGrossMargin` when either cost or sale price is blank.
- [ ] In `validateSelection`, validate cost and sale price only when the corresponding value is not blank.
- [ ] Re-run the targeted backend tests and confirm they pass.

### Task 3: Make frontend pricing optional

**Files:**
- Modify: `src/views/payment-tracking/forms/SelectionForm.vue`
- Modify: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] Change the cost and sale-price validators to accept `null`, `undefined`, and empty-string values.
- [ ] Keep rejection of negative cost, zero or negative sale price, and non-numeric provided values.
- [ ] Update the first-stage validation browser test to assert that blank cost and sale price produce no error messages.
- [ ] Run `npm run test:payment-tracking` and confirm the relevant browser scenarios pass.

### Task 4: Final verification and local restart

**Files:**
- Verify only; no production or packaging files.

- [ ] Run the complete backend test suite with `npm --prefix standalone-server test -- --runInBand`.
- [ ] Run `git diff --check` on the new commit range.
- [ ] Commit only the pricing-optional files and documents to the current local branch.
- [ ] Restart the local backend with `USE_MYSQL=0`, `DB_ENGINE=sqlite`, and `DATA_DIR=.local-dev-data`.
- [ ] Verify backend health, frontend HTTP response, and frontend proxy health without running any build or package command.

