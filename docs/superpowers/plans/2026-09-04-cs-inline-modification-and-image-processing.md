# 客服内联修改与款式图处理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现款式图精细去底与换色，并把客服、基础美工的修改流程收敛到任务详情页内的可折叠双栏记录。

**Architecture:** 图片处理使用无 UI 依赖的纯像素函数，`StyleImageEditor` 只负责 Fabric.js 图层和历史记录。修改流程扩展 `task_reject_record`，由服务端事务和任务锁保证每个任务只有一轮待处理修改；通用 `TaskDetail` 只暴露插槽，客服和基础美工页面分别接入专用修改组件。

**Tech Stack:** Vue 3、Element Plus、Fabric.js 6、Express、SQLite/MySQL、Jest、Playwright

---

### Task 1: 精细背景移除和换色纯函数

**Files:**
- Modify: `src/utils/background-removal.js`
- Modify: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: 写入浏览器侧像素算法回归用例**

覆盖边缘背景估算、字体孔洞清理、软 Alpha、边缘去污染、整体单色、吸管取色和指定颜色平滑替换；测试通过 Vite 动态导入工具模块并对合成 `ImageData` 断言。

- [ ] **Step 2: 运行目标 Playwright 用例并确认旧实现失败**

Run: `npx playwright test --config=playwright.task-pages.config.js -g "image processing"`

Expected: FAIL，缺少精细去底和换色导出函数。

- [ ] **Step 3: 实现稳定的纯像素接口**

导出以下接口，并保证不修改调用方传入的 `ImageData`：

```js
export function estimateEdgeBackground(imageData) {}
export function removeBackground(imageData, { tolerance, edgeCleanup } = {}) {}
export function recolorSolid(imageData, targetColor) {}
export function recolorMatching(imageData, sourceColor, targetColor, tolerance) {}
export function samplePixel(imageData, x, y) {}
```

- [ ] **Step 4: 运行目标用例并确认通过**

Run: `npx playwright test --config=playwright.task-pages.config.js -g "image processing"`

Expected: PASS。

### Task 2: 款式图编辑器精细处理控件

**Files:**
- Modify: `src/components/task/StyleImageEditor.vue`
- Modify: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: 写编辑器交互用例**

断言上传图层选中后显示“边缘净化”“整体换色”“指定颜色”“吸管”“颜色容差”，并验证处理动作进入撤销/恢复历史。

- [ ] **Step 2: 运行编辑器目标用例并确认失败**

Run: `npx playwright test --config=playwright.task-pages.config.js -g "style image editor"`

Expected: FAIL，新增控件尚不存在。

- [ ] **Step 3: 接入像素函数和工具状态**

`StyleImageEditor` 保存当前上传图层原始数据；对当前显示图像执行去底或换色，吸管模式把画布坐标转换为图层像素坐标，所有成功处理调用现有 `captureHistory()`。

- [ ] **Step 4: 运行编辑器目标用例**

Run: `npx playwright test --config=playwright.task-pages.config.js -g "style image editor"`

Expected: PASS，原移动画布用例继续通过。

### Task 3: 修改轮次数据库契约和服务端状态机

**Files:**
- Modify: `standalone-server/config/database.js`
- Modify: `standalone-server/dao/task.dao.js`
- Modify: `standalone-server/services/task.service.js`
- Modify: `standalone-server/routes/task/task-action.js`
- Modify: `standalone-server/tests/api/cs-modification.test.js`
- Modify: `standalone-server/tests/api/basic-score-review.test.js`

- [ ] **Step 1: 扩展 API 测试为完整状态机**

覆盖新增字段、唯一待处理轮次、仅发布客服可发起、仅当前基础美工可完成、文字或文件至少一项、撤回同一轮保留内容、首次撤回保留作品和分数、客服通过前不进入分值审核、最终通过后按最后分数进入分值审核。

- [ ] **Step 2: 运行两个 API 测试文件并确认失败**

Run: `npm test -- --runInBand tests/api/cs-modification.test.js tests/api/basic-score-review.test.js`

Workdir: `standalone-server`

Expected: FAIL，缺少字段和完成修改接口，旧逻辑会提前创建分值审核并在撤回时清空分数。

- [ ] **Step 3: 增加 SQLite/MySQL 安全迁移**

`task_reject_record` 增加：

```sql
designer_id
designer_name
designer_complete_time
applied_score
```

建表语句和幂等 `ALTER TABLE` 同时更新，不清空已有数据。

- [ ] **Step 4: 增加 DAO 原子操作**

提供最新轮次锁定查询、完成轮次、重新打开轮次、校验/替换某轮作品文件等窄接口；任务详情返回轮次字段和归属文件。

- [ ] **Step 5: 实现状态机和文件一致性**

新增 `completeCsModification()`；`requestCsModification()` 校验不存在未完成轮次；`reviewTask(pass)` 和 `batchReview()` 仅在客服最终通过后把大于 1 分设为 `pending`；`undoSubmit()` 根据最新完成轮次回到 `rejected` 或 `accepted`，不清空内容和分数。

- [ ] **Step 6: 增加路由参数契约**

`POST /api/task/complete-modification` 接收：

```text
taskId, rejectRecordId, reply, appliedScore, retainedFileIds, files[]
```

首次作品上传额外接收 `retainedFileIds`，支持撤回后的局部保留、删除和新增。

- [ ] **Step 7: 运行目标 API 测试**

Run: `npm test -- --runInBand tests/api/cs-modification.test.js tests/api/basic-score-review.test.js`

Expected: PASS。

### Task 4: 详情页内修改记录组件

**Files:**
- Create: `src/components/task/CsModificationRecords.vue`
- Modify: `src/components/TaskDetail.vue`
- Modify: `src/components/RejectHistory.vue`
- Modify: `src/api/task.js`
- Modify: `src/views/shared/Review.vue`
- Modify: `src/views/basic/MyTasks.vue`
- Modify: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: 更新客服和基础美工页面用例**

断言客服列表操作列仅有“查看作品、通过”，详情作品区下方可内联新增；基础美工修改中任务点击详情即显示右栏编辑；两侧支持文字、文件、删除、悬停粘贴、申请分数和完成；历史轮次可折叠。

- [ ] **Step 2: 运行修改流程页面用例并确认失败**

Run: `npx playwright test --config=playwright.task-pages.config.js -g "modification"`

Expected: FAIL，当前仍使用两个弹窗。

- [ ] **Step 3: 给通用详情增加受控插槽**

`TaskDetail` 在首次作品后提供 `modifications` 插槽，默认渲染只读记录；客服任务主作品区只显示 `reject_record_id` 为空的首次作品，其他任务保持原筛选逻辑。

- [ ] **Step 4: 实现专用双栏组件**

组件模式为 `readonly/customer/designer`。客服未点击完成的新轮次只保存在组件本地；基础美工重开同一轮时带出旧回复、旧文件和当前分数，只有再次完成才提交替换结果。

- [ ] **Step 5: 页面接入并移除修改弹窗**

客服页只在详情插槽调用 `requestCsModificationApi`；基础美工页修改状态只打开详情并调用 `completeCsModificationApi`，首次上传仍保留原弹窗但在撤回后带出旧文件与分数。

- [ ] **Step 6: 运行修改流程页面用例**

Run: `npx playwright test --config=playwright.task-pages.config.js -g "modification"`

Expected: PASS。

### Task 5: 批量提交类型和最新作品预览

**Files:**
- Modify: `standalone-server/services/batch-submit.service.js`
- Modify: `standalone-server/tests/unit/batch-submit-matcher.test.js`
- Modify: `src/components/basic/BatchWorkSubmit.vue`
- Modify: `src/composables/useFileHelpers.js`
- Modify: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: 写匹配类型和作品优先级测试**

`accepted` 返回“首次提交”；`rejected` 必须存在唯一未完成轮次并返回“第 N 次修改”；每组带出当前申请分数。作品预览按修改轮次从新到旧选择实际图片，纯文字轮次自动回退。

- [ ] **Step 2: 运行目标测试并确认失败**

Run: `npm test -- --runInBand tests/unit/batch-submit-matcher.test.js`

Workdir: `standalone-server`

Expected: FAIL，当前响应没有提交类型、轮次和申请分数。

- [ ] **Step 3: 扩展解析结果和批量提交界面**

服务端响应 `submissionType/rejectRecordId/rejectIndex/appliedScore`；界面显示“首次提交”或“第 N 次修改”，分数从服务端值初始化并保持用户修改。

- [ ] **Step 4: 统一预览文件排序**

`useFileHelpers` 将带 `reject_record_id` 的修改作品按轮次倒序放在首次作品前；同轮保持上传顺序。客服、基础美工相关页面复用该接口，详情主作品不受影响。

- [ ] **Step 5: 运行批量和预览测试**

Run: `npm test -- --runInBand tests/unit/batch-submit-matcher.test.js`

Workdir: `standalone-server`

Run: `npx playwright test --config=playwright.task-pages.config.js -g "batch submission|latest work preview"`

Expected: PASS。

### Task 6: 全量回归、审查与本地服务重启

**Files:**
- Verify only; no build output

- [ ] **Step 1: 运行后端完整测试**

Run: `npm test -- --runInBand`

Workdir: `standalone-server`

Expected: 全部 PASS。

- [ ] **Step 2: 运行任务页面完整测试**

Run: `npm run test:task-pages`

Expected: 全部 PASS。

- [ ] **Step 3: 执行 Vue 源码编译检查和差异检查**

任务页面 Playwright 的 Vite 测试服务器必须完成所有受影响路由的 Vue SFC 转换且浏览器控制台无编译错误；该结果作为本仓库现有的源码编译检查。

Run: `git diff --check`

Expected: exit 0。

- [ ] **Step 4: 按设计文档逐条审查**

确认图片处理、修改串行状态机、分值时机、撤回保留、批量提交、预览优先级和其他角色隔离均有代码与测试证据。

- [ ] **Step 5: 本地提交功能改动**

只暂存本次涉及文件，排除用户原有脏文件和 `.local-*` 数据；不推送远程。

- [ ] **Step 6: 重启本地前后端**

后端显式设置 `USE_MYSQL=0`、`DB_ENGINE=sqlite` 并使用 `.local-dev-data/design.db`，前后端仅监听 `127.0.0.1:18632` 和 `127.0.0.1:18634`。不执行 Vite 构建或 Electron 打包。
