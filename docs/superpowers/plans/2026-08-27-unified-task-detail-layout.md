# Unified Task Detail Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一所有任务详情入口的固定定位、标题栏和内部滚动布局，并整理选品阶段页视觉层级，同时完整保留各页面现有业务逻辑和角色权限。

**Architecture:** 新增 `TaskDetailOverlay.vue`，只负责 `Teleport`、主内容区定位、固定标题栏、独立正文滚动、关闭事件和滚动复位；它不请求数据，也不判断角色或业务状态。现有 `TaskDetail.vue` 和 11 个页面仅接入这个外壳，正文和页面自己的操作按钮保持原逻辑；`StageDetail.vue` 只移动现有操作节点并调整 CSS，不改变处理函数、校验、接口或允许操作条件。

**Tech Stack:** Vue 3 `<script setup>`、Element Plus、Playwright、现有 `useTaskDetail` / `useFileHelpers` composables

---

## 不变量

- 不修改后端、API、数据库结构、权限表和路由业务规则。
- 不修改 `useTaskDetail` 的数据请求、预加载和错误处理。
- 不修改任何页面现有按钮的 `v-if`、`:loading`、`:disabled`、事件处理函数和操作成功后的刷新/关闭行为。
- 不修改图片预览、下载、拖拽、附件和驳回记录功能。
- 基础美工和客服页面不得出现“开启打款”；运营美工作品审核仍由现有 `canOpenPayment` 判断。
- 不执行前端构建、Electron 打包、Docker 构建或 `git push`。

### Task 1: 共享固定详情外壳

**Files:**
- Create: `src/components/TaskDetailOverlay.vue`
- Modify: `src/components/TaskDetail.vue`
- Modify: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: 为来源任务详情添加失败的布局回归测试**

在现有“查看原任务”流程中，通过用户可见入口打开详情，并断言公共边界：

```js
const overlay = page.getByRole('dialog', { name: '夏季连衣裙主图' })
await expect(overlay).toBeVisible()
await expect(overlay).toHaveClass(/task-detail-overlay/)
await expect(overlay.locator('.task-detail-body')).toHaveCSS('overflow-y', 'auto')
await expect(overlay.locator('.task-detail-header')).toBeVisible()
await expect(overlay.getByRole('button', { name: '关闭', exact: true })).toBeVisible()
```

再将 `.task-detail-body` 滚到底部、关闭、重新打开，并断言 `scrollTop === 0`。测试只观察 DOM、滚动和用户操作，不检查 Vue 内部状态。

- [ ] **Step 2: 运行来源任务用例确认红灯**

Run: `npx playwright test --config=playwright.payment-tracking.config.js -g "selection workspace"`

Expected: FAIL，因为 `.task-detail-overlay` 和 `.task-detail-body` 尚不存在。

- [ ] **Step 3: 实现无业务逻辑的 `TaskDetailOverlay`**

组件公开接口固定为：

```vue
<TaskDetailOverlay
  :visible="detailVisible"
  :title="currentTask.title || '任务详情'"
  @close="detailVisible = false"
>
  <template #summary>现有标题摘要节点</template>
  <template #actions>现有业务按钮节点</template>
  现有详情正文节点
</TaskDetailOverlay>
```

实现要求：

```js
const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '任务详情' }
})
const emit = defineEmits(['close'])
const bodyRef = ref(null)

watch(() => props.visible, async (visible) => {
  if (!visible) return
  await nextTick()
  if (bodyRef.value) bodyRef.value.scrollTop = 0
})
```

模板使用 `<Teleport to="body">` 和 `role="dialog"`、`:aria-label="title"`；标题区依次承载默认标题、`summary`、`actions` 和带 `aria-label="关闭"` 的图标按钮；正文只有一个 `ref="bodyRef"` 的 `.task-detail-body`。遮罩只覆盖主内容区，禁止点击穿透，但不改变 `document.body` 滚动状态。

固定定位使用现有布局变量：

```css
.task-detail-overlay {
  position: fixed;
  top: 76px;
  right: 24px;
  bottom: 24px;
  left: calc(var(--layout-sidebar-width, 220px) + 24px);
  z-index: 1900;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
  background: #fff;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  box-shadow: 0 12px 32px rgb(0 0 0 / 16%);
}
.task-detail-header { flex: 0 0 auto; }
.task-detail-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; }
```

- [ ] **Step 4: 让 `TaskDetail.vue` 使用共享外壳**

保留现有时间线、描述列表、描述、驳回原因、参考文件、作品文件、图片预览和全部计算属性/方法，只把 `<el-dialog>` 与 footer 替换为：

```vue
<TaskDetailOverlay
  :visible="visible"
  :title="task?.title || '任务详情'"
  @close="$emit('close')"
>
  <template #summary>
    <span v-if="task?.designer_name">{{ task.designer_name }}</span>
    <el-tag v-if="task" :type="statusType(task.status)" size="small">
      {{ statusLabel(task.status) }}
    </el-tag>
    <span v-if="task?.submit_time">{{ formatTime(task.submit_time) }}</span>
  </template>
  <template #actions><slot name="actions" /></template>
  <template v-if="task">原有正文节点原样保留</template>
</TaskDetailOverlay>
```

- [ ] **Step 5: 运行来源任务用例确认绿灯并提交**

Run: `npx playwright test --config=playwright.payment-tracking.config.js -g "selection workspace"`

Expected: PASS，来源任务详情固定在主内容区，正文独立滚动，重新打开回到顶部。

Commit:

```bash
git add src/components/TaskDetailOverlay.vue src/components/TaskDetail.vue tests/payment-tracking/payment-tracking.spec.js
git commit -m "feat: add fixed task detail overlay"
```

### Task 2: 迁移任务、发布和全量任务入口

**Files:**
- Modify: `src/views/shared/TaskHall.vue`
- Modify: `src/views/shared/MyTasksPub.vue`
- Modify: `src/views/designer/MyTasks.vue`
- Modify: `src/views/basic/MyTasks.vue`
- Modify: `src/views/operator/OpMyTasks.vue`
- Modify: `src/views/operator-assistant/MyTasks.vue`
- Modify: `src/views/admin/AllTasks.vue`
- Modify: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: 扩展现有详情入口矩阵测试并确认红灯**

对现有各角色 fixture 从真实“详情/查看任务”入口打开页面，统一断言 `role=dialog`、`.task-detail-overlay`、`.task-detail-body` 和关闭按钮。继续断言页面原有动作：任务大厅“接单”；设计/基础/运营助理“上传或重新上传”；发布任务“撤回、编辑、重新发布、修改数量、催促”中当前 fixture 满足条件的按钮；运营我的任务“撤回、编辑、催促”；后台全量任务只读。

Run: `npx playwright test --config=playwright.task-pages.config.js -g "detail overlays preserve"`

Expected: FAIL，旧页面仍使用 `.inline-detail-overlay`。

- [ ] **Step 2: 逐页只替换外壳节点**

每个文件导入 `TaskDetailOverlay`，把：

```vue
<transition name="overlay-fade">
  <div v-if="detailVisible" class="inline-detail-overlay">
    <div class="inline-detail-header">...</div>
    <div class="inline-detail-body">...</div>
  </div>
</transition>
```

替换为：

```vue
<TaskDetailOverlay
  :visible="detailVisible"
  :title="currentTask?.title || currentTask?.task_no || '任务详情'"
  @close="detailVisible = false"
>
  <template #summary>原 `.detail-header-left` 的子节点原样保留</template>
  <template #actions>原 `.detail-header-right` 中除关闭按钮外的子节点原样保留</template>
  原 `.inline-detail-body` 的子节点原样保留
</TaskDetailOverlay>
```

不得改动 `viewDetail/openTaskDetail`、`useTaskDetail` 解构、`detailVisible` 使用、按钮条件、处理函数或正文表达式。删除的只允许是旧 `<transition>`、旧外壳/header/body 标签、旧关闭按钮以及因此不再使用的 `Close` 图标导入。

- [ ] **Step 3: 逐页检查业务表达式没有变化**

Run:

```powershell
git diff -- src/views/shared/TaskHall.vue src/views/shared/MyTasksPub.vue src/views/designer/MyTasks.vue src/views/basic/MyTasks.vue src/views/operator/OpMyTasks.vue src/views/operator-assistant/MyTasks.vue src/views/admin/AllTasks.vue
```

Expected: 仅外壳标签、slot 包装、共享组件导入和无用 `Close` 导入变化；所有 `v-if`、事件、loading、disabled 和正文绑定保持原值。

- [ ] **Step 4: 运行任务页矩阵并提交**

Run: `npm run test:task-pages`

Expected: 全部通过，原操作和文件能力断言不回归。

Commit:

```bash
git add src/views/shared/TaskHall.vue src/views/shared/MyTasksPub.vue src/views/designer/MyTasks.vue src/views/basic/MyTasks.vue src/views/operator/OpMyTasks.vue src/views/operator-assistant/MyTasks.vue src/views/admin/AllTasks.vue tests/task-pages/task-page-features.spec.js
git commit -m "refactor: unify task detail containers"
```

### Task 3: 迁移审核入口并锁定角色动作边界

**Files:**
- Modify: `src/views/shared/Review.vue`
- Modify: `src/views/operator/OpReview.vue`
- Modify: `src/views/basic/ScoreReview.vue`
- Modify: `src/views/basic/ReviewRecords.vue`
- Modify: `tests/task-pages/task-page-features.spec.js`

- [ ] **Step 1: 添加角色隔离的失败测试**

通过真实入口打开详情并断言：

```js
await expect(detail.getByRole('button', { name: '通过', exact: true })).toBeVisible()
await expect(detail.getByRole('button', { name: '驳回', exact: true })).toBeVisible()
await expect(detail.getByRole('button', { name: '开启打款', exact: true })).toBeVisible()
```

上述“开启打款”仅用于拥有 `payment.open` 且 `taskGroup === 'design'` 的 `shared/Review.vue` fixture。基础美工分值审核、审核记录、运营审核及客服 fixture 统一断言：

```js
await expect(detail.getByRole('button', { name: '开启打款', exact: true })).toHaveCount(0)
```

Run: `npx playwright test --config=playwright.task-pages.config.js -g "detail action isolation"`

Expected: FAIL，因为审核详情尚未使用共享外壳，且运营美工详情头尚未承载现有开启打款动作。

- [ ] **Step 2: 迁移四个审核页的外壳**

按 Task 2 相同的 `TaskDetailOverlay` 接口迁移，但每页 actions 必须原样保留：

| 页面 | actions slot |
|---|---|
| `shared/Review.vue` | 现有通过、驳回；`canOpenPayment` 时调用现有 `handleOpenPayment(currentTask)` 的开启打款 |
| `operator/OpReview.vue` | 现有通过、驳回 |
| `basic/ScoreReview.vue` | 现有通过、不通过 |
| `basic/ReviewRecords.vue` | 空，只显示共享关闭按钮 |

`shared/Review.vue` 的开启打款按钮必须复用已有条件和函数：

```vue
<el-button
  v-if="canOpenPayment"
  type="warning"
  size="small"
  @click="handleOpenPayment(currentTask)"
>开启打款</el-button>
```

不得把 `canOpenPayment` 或任何权限判断移入共享组件。

- [ ] **Step 3: 检查审核业务 diff、运行矩阵并提交**

Run:

```powershell
git diff -- src/views/shared/Review.vue src/views/operator/OpReview.vue src/views/basic/ScoreReview.vue src/views/basic/ReviewRecords.vue
npm run test:task-pages
```

Expected: diff 仅涉及外壳与批准的详情内开启打款入口；任务页套件全部通过。

Commit:

```bash
git add src/views/shared/Review.vue src/views/operator/OpReview.vue src/views/basic/ScoreReview.vue src/views/basic/ReviewRecords.vue tests/task-pages/task-page-features.spec.js
git commit -m "refactor: unify review detail containers"
```

### Task 4: 整理选品阶段详情页布局

**Files:**
- Modify: `src/views/payment-tracking/StageDetail.vue`
- Modify: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: 添加阶段页布局失败测试**

在 1600x900 和 1280x720 下打开 selection/preparation 页面，断言三项流程动作位于首行 action 容器、旧 footer 不存在、页面背景不是网格，并检查无横向溢出：

```js
const headerActions = page.locator('.stage-header-actions')
await expect(headerActions.getByRole('button', { name: '保存本阶段' })).toBeVisible()
await expect(headerActions.getByRole('button', { name: '进入下一阶段' })).toBeVisible()
await expect(headerActions.getByRole('button', { name: '结束流程' })).toBeVisible()
await expect(page.locator('.action-bar')).toHaveCount(0)
expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
```

Run: `npx playwright test --config=playwright.payment-tracking.config.js -g "stage detail layout"`

Expected: FAIL，动作仍位于 `.action-bar` 底部。

- [ ] **Step 2: 原样移动现有动作节点**

在 `stage-header` 第一行右侧新增 `.stage-header-actions`，将当前 `.action-buttons` 内全部按钮原样移动进去，包括保存、进入下一阶段、结束/完成流程、重开阶段、恢复流程；每个按钮原有 `v-if`、loading、disabled、label 和 handler 不变。删除底部 `.action-bar` 外壳，不移动或改写任何函数。

- [ ] **Step 3: 改为白色无网格的分区布局**

删除页面的网格背景声明和 `.action-bar` 样式；主内容使用纯白背景，既有表单组使用留白、`border-bottom: 1px solid #ebeef5` 和紧凑小标题分隔，不创建嵌套卡片。响应式规则在紧凑桌面下让 `.stage-header-actions` 独占下一行，并让表单列数与图片网格减小，保证按钮、标题和字段不重叠。

- [ ] **Step 4: 运行阶段流程测试并提交**

Run: `npm run test:payment-tracking`

Expected: 全部通过，保存、推进、结束、重开、恢复及图片相关既有流程不回归。

Commit:

```bash
git add src/views/payment-tracking/StageDetail.vue tests/payment-tracking/payment-tracking.spec.js
git commit -m "style: simplify payment stage detail layout"
```

### Task 5: 全量验证与本地收尾

**Files:**
- Verify only; do not build or package

- [ ] **Step 1: 运行两组完整端到端测试**

Run:

```powershell
npm run test:task-pages
npm run test:payment-tracking
```

Expected: 两组测试均 0 failures。

- [ ] **Step 2: 检查代码与约束**

Run:

```powershell
git diff --check HEAD~4..HEAD
git status --short
git log -5 --oneline
```

Expected: 无空白错误；受保护的 `src/views/Layout.vue`、`vite.config.js` 和本地运行目录仍未被本功能提交；没有构建、打包或远程推送产物。

- [ ] **Step 3: 浏览器验收**

在 `http://127.0.0.1:5173/` 分别以 1600x900、1280x720 检查：来源任务详情、运营作品审核详情、基础美工详情、客服详情和阶段详情。确认侧栏/顶栏可见、详情标题栏固定、只有正文滚动、操作按钮不重叠、关闭后列表位置不变；保存测试截图到 Playwright 输出目录，不提交截图。

- [ ] **Step 4: 对照设计规格做最终自审**

逐条核对 `docs/superpowers/specs/2026-08-27-unified-task-detail-layout-design.md` 的验收标准；重点检查业务函数、权限条件和 API diff 为零。发现问题先修复并重跑相关测试，再报告完成。
