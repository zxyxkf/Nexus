# 客服与基础美工任务补充调整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在保持其他角色任务流程不变的前提下，完善客服基础美工的款式图展示、画布移动、批量提交和多轮修改沟通。

**Architecture:** 继续使用现有任务状态机和 `task_reject_record` 文件关联，只增加基础美工回复字段及客服专用的新增修改入口。前端通过 `task_group = cs`、路由角色和独立详情上下文进行隔离，款式图始终只读取 `file_category = style`，作品文件仍通过现有 work 过滤规则读取。

**Tech Stack:** Vue 3、Element Plus、Fabric.js 6、Express、Multer、SQLite/MySQL 双引擎、Jest/Supertest、Playwright。

---

## 文件结构

- `standalone-server/config/database.js`：双引擎建表与缺列迁移。
- `standalone-server/dao/task.dao.js`：修改记录查询、创建与基础美工回复更新。
- `standalone-server/services/task.service.js`：新增修改和重新提交的业务校验、状态流转、文件关联。
- `standalone-server/routes/task/task-action.js`：客服 multipart 新增修改接口及基础美工回复参数。
- `standalone-server/utils/notification.js`：客服基础美工修改通知文案隔离。
- `standalone-server/services/batch-submit.service.js`：批量匹配结果补充发布人。
- `src/api/task.js`：新增修改 API 和上传回复参数。
- `src/components/RejectHistory.vue`：改造为客服基础美工修改历史的折叠双栏展示。
- `src/components/TaskDetail.vue`、`src/components/TaskStatusTimeline.vue`：客服任务状态/历史语义隔离及暂存详情上下文。
- `src/views/shared/Review.vue`：客服“新增修改”入口；其他任务组保留驳回。
- `src/views/cs/HandoffTasks.vue`：暂存列表款式图和暂存详情。
- `src/views/shared/TaskHall.vue`、`src/views/basic/MyTasks.vue`：基础美工款式图列。
- `src/components/task/StyleImageEditor.vue`：Fabric 视口移动工具。
- `src/components/basic/BatchWorkSubmit.vue`：详情入口、发布人和响应式申请分值。
- `standalone-server/tests/api/cs-modification.test.js`、`standalone-server/tests/unit/batch-submit-matcher.test.js`、`tests/task-pages/task-page-features.spec.js`：回归覆盖。

### Task 1: 修改记录数据库兼容层

**Files:**
- Modify: `standalone-server/config/database.js`
- Modify: `standalone-server/dao/task.dao.js`
- Test: `standalone-server/tests/api/cs-modification.test.js`

- [ ] **Step 1: 写失败的 SQLite 结构测试**

测试启动本地临时 SQLite 后执行 `PRAGMA table_info(task_reject_record)`，断言存在 `designer_reply`；创建两条修改记录后断言 `reject_index` 依次为 1、2。

- [ ] **Step 2: 运行测试并确认失败**

Run: `cd standalone-server; npx jest tests/api/cs-modification.test.js --runInBand`

Expected: FAIL，提示 `designer_reply` 不存在。

- [ ] **Step 3: 增加双引擎字段和安全迁移**

SQLite/MySQL 的 `CREATE TABLE IF NOT EXISTS task_reject_record` 均增加可空文本字段 `designer_reply`；现有数据库的 `alterSqls` 分别增加：

```sql
ALTER TABLE task_reject_record ADD COLUMN designer_reply TEXT DEFAULT ''
```

```sql
ALTER TABLE task_reject_record ADD COLUMN designer_reply TEXT
```

沿用现有“重复列错误忽略”机制，不更新任务状态、不清空旧记录。

- [ ] **Step 4: 增加 DAO 回复更新能力**

新增 `updateRejectRecordReply(conn, recordId, taskId, reply)`，使用 `WHERE id = ? AND task_id = ?` 精确更新；导出该函数供 service 使用。

- [ ] **Step 5: 运行结构测试并提交**

Run: `cd standalone-server; npx jest tests/api/cs-modification.test.js --runInBand`

Expected: PASS。

```powershell
git add standalone-server/config/database.js standalone-server/dao/task.dao.js standalone-server/tests/api/cs-modification.test.js
git commit -m "feat: extend customer service modification records"
```

### Task 2: 客服新增修改与基础美工回复接口

**Files:**
- Modify: `standalone-server/routes/task/task-action.js`
- Modify: `standalone-server/services/task.service.js`
- Modify: `standalone-server/utils/notification.js`
- Modify: `src/api/task.js`
- Test: `standalone-server/tests/api/cs-modification.test.js`

- [ ] **Step 1: 写失败的业务流测试**

覆盖以下请求：客服对 `doing + task_group=cs` 任务提交只有文字、只有附件、文字加附件均成功；两者皆空失败；非客服任务失败；非发布人失败；重复发起失败。断言任务变为 `rejected`、修改记录递增、附件关联当前记录。

- [ ] **Step 2: 写基础美工回复测试**

基础美工对 `rejected` 任务上传作品并传 `modificationReply`，断言任务回到 `doing`、回复写入最新记录、作品文件带最新 `reject_record_id`；无作品和重复回复失败。

- [ ] **Step 3: 运行测试并确认失败**

Run: `cd standalone-server; npx jest tests/api/cs-modification.test.js --runInBand`

Expected: FAIL，新增路由返回 404 或回复字段未保存。

- [ ] **Step 4: 实现客服专用 multipart 路由**

新增 `POST /api/task/request-modification`，复用任务上传的文件名修复、数量和大小限制。请求字段为：

```text
taskId: number
note: string
files: File[]
```

异常时清理尚未持久化的临时文件。

- [ ] **Step 5: 实现原子修改服务**

新增 `requestCsModification(taskId, note, files, user)`：在任务锁和事务内校验 `doing`、`task_group=cs`、发布人/权限，以及说明或附件至少一项；创建修改记录、保存附件为 `file_category=reject` 并绑定记录，最后更新为 `rejected`。通知事件沿用现有类型，但客服任务文案显示“需要修改”。

- [ ] **Step 6: 扩展基础美工上传**

`upload-files` 读取 `modificationReply` 并传入 service options。仅当 `basic_designer + task_group=cs + status=rejected` 时，把回复及作品绑定到最新修改记录；普通首次提交、其他角色上传和参考图上传不读取该字段。

- [ ] **Step 7: 增加前端 API**

在 `src/api/task.js` 增加 `requestCsModificationApi({ taskId, note, files })`，并让 `uploadFilesApi` 在显式传入时附加 `modificationReply`。

- [ ] **Step 8: 运行后端测试并提交**

Run: `cd standalone-server; npx jest tests/api/cs-modification.test.js tests/api/task.test.js --runInBand`

Expected: PASS，且原 design 任务驳回测试仍通过。

```powershell
git add standalone-server/routes/task/task-action.js standalone-server/services/task.service.js standalone-server/utils/notification.js src/api/task.js standalone-server/tests/api/cs-modification.test.js
git commit -m "feat: add customer service modification workflow"
```

### Task 3: 修改历史和客服审核界面

**Files:**
- Modify: `src/components/RejectHistory.vue`
- Modify: `src/components/TaskDetail.vue`
- Modify: `src/components/TaskStatusTimeline.vue`
- Modify: `src/views/shared/Review.vue`
- Modify: `src/views/basic/MyTasks.vue`
- Test: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: 写失败的页面回归测试**

测试客服作品审核包含“新增修改”且不含可操作的“驳回”；弹框允许说明或附件至少一项。测试基础美工 `rejected` 任务显示“修改中”和回复框。测试客服、基础美工和管理员客服全量详情显示“修改历史”，而 design/operator 详情仍保留原状态语义。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm run test:task-pages -- --grep "修改历史|新增修改"`

Expected: FAIL，页面仍显示“驳回”。

- [ ] **Step 3: 改造修改历史展示**

`RejectHistory.vue` 保持输入契约 `records` 不变，改为折叠记录：最新一轮默认展开；标题显示“第 N 次修改”、时间和回复状态；左右栏显示客服说明/附件与基础美工回复/重新上传。旧记录缺少回复时显示“暂无回复”。

- [ ] **Step 4: 隔离客服任务详情语义**

`TaskDetail.vue` 只在 `taskGroup === 'cs'` 时显示修改历史，不再额外把 `reject_reason` 显示成红色驳回原因；新增 `handoff` 上下文将发布人 fallback 设为“暂存”。`TaskStatusTimeline.vue` 只在客服任务中把 `rejected` 标记为“修改中”和“等待基础美工修改”。

- [ ] **Step 5: 替换客服审核操作**

`Review.vue` 的 design/operator 分支继续调用 `reviewTaskApi(... reject ...)`；cs 分支按钮改为“新增修改”，弹框提交说明与附件到 `requestCsModificationApi`，成功后关闭详情并刷新列表。

- [ ] **Step 6: 增加基础美工回复**

`basic/MyTasks.vue` 在 `rejected` 任务的上传作品弹框中显示“本次修改回复”文本框，上传时传 `modificationReply`。列表和详情中的客服任务状态显示“修改中”；作品文件仍必填。

- [ ] **Step 7: 运行页面测试并提交**

Run: `npm run test:task-pages -- --grep "修改历史|新增修改"`

Expected: PASS。

```powershell
git add src/components/RejectHistory.vue src/components/TaskDetail.vue src/components/TaskStatusTimeline.vue src/views/shared/Review.vue src/views/basic/MyTasks.vue tests/task-pages/task-page-features.spec.js
git commit -m "feat: present customer service changes as modification history"
```

### Task 4: 暂存与基础美工款式图列表

**Files:**
- Modify: `src/views/cs/HandoffTasks.vue`
- Modify: `src/views/shared/TaskHall.vue`
- Modify: `src/views/basic/MyTasks.vue`
- Test: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: 写失败的角色隔离测试**

为 mocked task files 增加两个 `style` 图片。断言暂存、基础美工大厅、基础美工我的/待做/待审核显示“款式图”、首图及“2张”；断言页面不把 style 图计入作品预览；断言美工设计师大厅仍显示“指定颜色”。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm run test:task-pages -- --grep "款式图列表"`

Expected: FAIL，目标页面仍显示工作项目或指定颜色。

- [ ] **Step 3: 实现款式图单元格**

三个页面局部增加：

```js
function getStyleImages(files) {
  return (files || []).filter(file => file.file_category === 'style' && file.file_type === 'image')
}
```

模板复用现有 42px 首图、数量、`preview-src-list`、`preview-teleported`、`draggable` 和 `setupFileDrag` 行为。TaskHall 通过 `isBasicDesigner` 分支隔离设计师指定颜色。

- [ ] **Step 4: 修复暂存详情上下文**

`HandoffTasks.vue` 把 `detail-context="published"` 改为 `detail-context="handoff"`，并保留继承按钮和详情加载逻辑。

- [ ] **Step 5: 运行测试并提交**

Run: `npm run test:task-pages -- --grep "款式图列表"`

Expected: PASS。

```powershell
git add src/views/cs/HandoffTasks.vue src/views/shared/TaskHall.vue src/views/basic/MyTasks.vue tests/task-pages/task-page-features.spec.js
git commit -m "fix: show style images in customer service task lists"
```

### Task 5: 款式图编辑器画布移动

**Files:**
- Modify: `src/components/task/StyleImageEditor.vue`
- Test: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: 写失败的画布交互测试**

打开编辑器，放大到大于 100%，开启“移动画布”，拖动后断言 Fabric `viewportTransform[4/5]` 改变；关闭工具后对象仍可选；保存导出的 scene 中对象坐标不因视口移动变化。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm run test:task-pages -- --grep "移动画布"`

Expected: FAIL，界面没有移动工具。

- [ ] **Step 3: 实现显式视口移动模式**

增加 `panMode`、`isPanning`、最后指针坐标。移动模式开启时关闭 Fabric selection，并在 `mouse:down/move/up` 中只更新 `canvas.viewportTransform[4]` 和 `[5]`；退出模式恢复 selection。按钮使用 Element Plus 移动图标和 tooltip，激活时显示主色状态。

- [ ] **Step 4: 保持导出与历史隔离**

平移不触发对象历史；`resetViewport` 和 `restoreOriginal` 清除偏移；`saveResult` 继续在单位视口下生成 scene/blob，再恢复查看视口。

- [ ] **Step 5: 运行测试并提交**

Run: `npm run test:task-pages -- --grep "移动画布"`

Expected: PASS。

```powershell
git add src/components/task/StyleImageEditor.vue tests/task-pages/task-page-features.spec.js
git commit -m "feat: add pan mode to style image editor"
```

### Task 6: 批量提交详情、发布人和分值

**Files:**
- Modify: `standalone-server/services/batch-submit.service.js`
- Modify: `src/components/basic/BatchWorkSubmit.vue`
- Modify: `standalone-server/tests/unit/batch-submit-matcher.test.js`
- Test: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: 写失败的 matcher 测试**

候选任务带 `publisher_name: '客服甲'`，断言匹配分组返回 `publisherName: '客服甲'`；数据库查询列必须包含 `publisher_name`。

- [ ] **Step 2: 写失败的页面测试**

匹配任务后将分值改为 2.5，触发一次重新匹配或响应式渲染，断言仍为 2.5；任务编号是可点击按钮，点击后打开 `TaskDetail`；副标题为“发布人：客服甲”，不显示工作项目。

- [ ] **Step 3: 运行测试并确认失败**

Run: `cd standalone-server; npx jest tests/unit/batch-submit-matcher.test.js --runInBand`

Run: `npm run test:task-pages -- --grep "批量提交详情"`

Expected: FAIL，分组无发布人且分值恢复默认。

- [ ] **Step 4: 补充发布人 DTO**

`publicTask()` 返回 `publisherName: task.publisher_name || ''`，候选任务 SELECT 增加 `publisher_name`。

- [ ] **Step 5: 修复响应式分值**

把非响应式 `Map` 改为 `reactive({})` 的任务 ID 字典；首次匹配仅初始化不存在的 key；输入框使用 `v-model="scoreByTaskId[group.taskId]"`，规则改为 `min=1, step=0.5, precision=1`；清空时逐 key 删除。

- [ ] **Step 6: 增加内联任务详情**

任务编号改为 link button，调用 `useTaskDetail` 加载任务，并在组件根部挂载 `TaskDetail task-group="cs" detail-context="cs-assignee"`。详情关闭不关闭批量提交 popover，不修改 `state.files/groups`。

- [ ] **Step 7: 运行测试并提交**

Run: `cd standalone-server; npx jest tests/unit/batch-submit-matcher.test.js --runInBand`

Run: `npm run test:task-pages -- --grep "批量提交详情"`

Expected: PASS。

```powershell
git add standalone-server/services/batch-submit.service.js standalone-server/tests/unit/batch-submit-matcher.test.js src/components/basic/BatchWorkSubmit.vue tests/task-pages/task-page-features.spec.js
git commit -m "fix: complete basic designer batch submission details"
```

### Task 7: 完整回归和本地服务

**Files:**
- Verify only; no build output.

- [ ] **Step 1: 运行后端完整测试**

Run: `cd standalone-server; npm test -- --runInBand`

Expected: 全部 PASS。

- [ ] **Step 2: 运行任务页面完整回归**

Run: `npm run test:task-pages`

Expected: 全部 PASS。

- [ ] **Step 3: 检查 Vue 编译和差异**

使用 Vue SFC 编译检查脚本检查改动组件，运行 `git diff --check`，确认无空白错误。禁止运行 `npm run build`、`electron:build` 或生成 `dist/release`。

- [ ] **Step 4: 重启本地后端**

只终止监听本机 `127.0.0.1:18632` 的旧本地开发进程，使用 `USE_MYSQL=0`、`DB_ENGINE=sqlite`、`DATA_DIR=..\\.local-dev-data` 启动 `standalone-server/server.js`，确认 `/api/health` 可访问。

- [ ] **Step 5: 最终状态检查**

Run: `git status --short`

Expected: 仅保留用户原有未提交修改和本地开发数据；本次代码均有本地提交，无 `dist`、`release` 新改动，无远程推送。
