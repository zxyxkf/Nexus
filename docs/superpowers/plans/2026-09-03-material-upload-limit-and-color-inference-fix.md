# Material Upload Limit And Color Inference Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the material-library upload endpoint honor the current administrator upload limit and stop treating generic Chinese image names as colors.

**Architecture:** Keep the configured limit as a per-request guard. Build the Multer middleware when each material upload request arrives, map Multer limits to existing `AppError` business responses, and narrow the standalone color helper without changing material persistence or task workflows.

**Tech Stack:** Node.js, Express, Multer, Jest, Supertest

---

### Task 1: Lock down conservative color inference

**Files:**
- Create: `standalone-server/tests/unit/material-colors.test.js`
- Modify: `standalone-server/utils/material-colors.js`

- [x] **Step 1: Write the failing color tests**

Add table-driven assertions that `军绿色A.jpg`, `樱花粉.png`, `宝石蓝A.png`, and `卡其A.jpg` return their colors while `图片.png`, `照片1.jpg`, `商品图A.png`, and `image.png` return an empty string.

- [x] **Step 2: Run the focused test and confirm it fails**

Run `npm --prefix standalone-server test -- --runInBand tests/unit/material-colors.test.js` and confirm the generic Chinese names are currently returned as colors.

- [x] **Step 3: Implement the minimum inference guard**

Retain the existing leading-Chinese-segment extraction, then return the segment only when it ends in a recognized color marker (`色红橙黄绿青蓝紫黑白灰粉棕褐金银`) or equals a common marker-less color (`卡其`, `咖啡`, `杏`). Keep `normalizeColor` and `collectColors` unchanged.

- [x] **Step 4: Run the focused test and confirm it passes**

Run `npm --prefix standalone-server test -- --runInBand tests/unit/material-colors.test.js`; expect all cases to pass.

### Task 2: Honor live material upload limits

**Files:**
- Create: `standalone-server/tests/api/material-library.test.js`
- Modify: `standalone-server/routes/material-library.js`

- [x] **Step 1: Write the failing API test**

Start the existing isolated SQLite test app, authenticate as admin, create a product and style, update `upload.max_file_count` to `2`, and verify two attached PNG files upload successfully. Then attach three PNG files and assert the response has business code `400`, mentions the limit `2`, and does not return HTTP 500.

- [x] **Step 2: Run the focused API test and confirm it fails**

Run `npm --prefix standalone-server test -- --runInBand tests/api/material-library.test.js`. The current static Multer instance was created with the default count before database configuration loaded, so the three-file request will incorrectly pass.

- [x] **Step 3: Create Multer per request and translate its errors**

Replace the module-level `upload` instance with `receiveImages(req, res, next)`. Capture `getMaxFileCount()` and `getMaxFileSizeMB()` for that request, construct Multer with those values, and map `LIMIT_FILE_COUNT` to `new AppError(400, \`单次最多上传 ${maxFileCount} 个文件\`)`, `LIMIT_FILE_SIZE` to the configured size message, and other Multer failures to a generic upload-parameter message.

- [x] **Step 4: Run the focused API test and confirm it passes**

Run `npm --prefix standalone-server test -- --runInBand tests/api/material-library.test.js`; expect the updated limit to apply immediately and the over-limit request to return a clear business error.

### Task 3: Regression verification

**Files:**
- Verify only; no build artifacts.

- [x] **Step 1: Run all material-focused tests**

Run `npm --prefix standalone-server test -- --runInBand tests/unit/material-colors.test.js tests/api/material-library.test.js` and expect zero failures.

- [x] **Step 2: Run the complete backend suite**

Run `npm --prefix standalone-server test -- --runInBand` and expect zero failures.

- [x] **Step 3: Check syntax and diff integrity**

Run `node --check standalone-server/routes/material-library.js`, `node --check standalone-server/utils/material-colors.js`, and `git diff --check`; expect exit code 0 for each.

- [x] **Step 4: Re-run the local HTTP reproduction**

Against the isolated local backend, upload a request within the configured limit and one above it. Confirm the former succeeds, the latter returns the configured limit message, and no new `MulterError: Too many files` reaches the global 500 handler.

- [x] **Step 5: Commit locally**

Commit only the implementation, tests, and plan on the current local branch. Do not push and do not run a frontend or Electron build.
