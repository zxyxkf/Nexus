# 店长审核卡片布局实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将店长审核列表替换为与选品收集、打款记录一致的商品时间线卡片，同时保持审核行为完全不变。

**Architecture:** 店长审核列表服务用现有批量查询一次性附带只读卡片记录，避免逐卡请求详情。共享 `ProductRowCard` 增加具名操作插槽并保留原操作按钮作为默认内容；店长审核页面通过插槽提供查看、通过、拒绝三个按钮。

**Tech Stack:** Vue 3、Element Plus、Playwright

---

### Task 1: 锁定店长审核卡片数据契约

**Files:**
- Modify: `standalone-server/tests/api/payment-tracking-manager-review.test.js`

- [ ] **Step 1: 为待审核列表增加只读卡片摘要断言**

```js
expect(review.record).toMatchObject({
  id: pending.id,
  currentStage: 'testing',
  processStatus: 'in_progress',
  managerReviewPending: true,
  allowedActions: {
    edit: false,
    advance: false,
    end: false,
    restore: false,
    reopen: false,
    managerReview: false,
    delete: false
  }
})
expect(review.record.stages.map(stage => stage.stageCode)).toEqual(['selection', 'testing'])
expect(review.record.images.some(image => image.category === 'product_main')).toBe(true)
```

- [ ] **Step 2: 运行接口测试并确认缺少 `record` 字段**

Run: `npx jest tests/api/payment-tracking-manager-review.test.js --runInBand`

Working directory: `standalone-server`

Expected: FAIL，`review.record` 为 `undefined`。

### Task 2: 批量生成店长审核卡片摘要

**Files:**
- Modify: `standalone-server/services/payment-tracking/repository.js`
- Modify: `standalone-server/services/payment-tracking/manager-review.service.js`

- [ ] **Step 1: 在审核列表查询中补齐卡片所需的记录字段**

```sql
SELECT r.*, p.store_seq, p.planner_id, p.planner_name, p.source_task_id,
       p.source_task_no, p.selection_date, p.style_number, p.cost, p.sale_price,
       p.product_id, p.current_stage, p.process_status, p.end_stage, p.end_type,
       p.end_reason, p.ended_at, p.version AS record_version,
       p.create_time AS record_create_time, p.update_time AS record_update_time
```

- [ ] **Step 2: 批量读取阶段、产品主图和链接状态并调用现有展示器**

```js
const recordIds = rows.map(row => Number(row.record_id))
const [stages, images, linkStatuses] = await Promise.all([
  repository.listEnteredStagesForRecords(recordIds),
  repository.listProductImagesForRecords(recordIds),
  repository.listLinkStatusesForRecords(recordIds)
])

const list = rows.map(row => ({
  ...presentRequest(row),
  record: recordService.presentRecord(
    toRecordRow(row),
    stagesByRecord.get(Number(row.record_id)) || [],
    imagesByRecord.get(Number(row.record_id)) || [],
    user,
    {},
    linkStatusByRecord.get(Number(row.record_id)) || null,
    { managerReviewRequest: row, forceReadOnly: true }
  )
}))
```

- [ ] **Step 3: 运行接口测试**

Run: `npx jest tests/api/payment-tracking-manager-review.test.js --runInBand`

Working directory: `standalone-server`

Expected: PASS。

### Task 3: 锁定店长审核卡片行为

**Files:**
- Modify: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: 在现有店长审核测试中增加卡片断言**

```js
await expect(page.locator('.manager-review-page .product-row-card')).toHaveCount(1)
await expect(page.locator('.manager-review-page .el-table')).toHaveCount(0)
await expect(page.locator('.manager-review-page .stage-timeline')).toBeVisible()
const actions = page.locator('.manager-review-page .card-actions')
await expect(actions.getByRole('button')).toHaveText(['查看记录', '通过', '拒绝'])
await expect(actions.getByRole('button', { name: '查看记录' })).toHaveClass(/el-button--primary/)
await expect(actions.getByRole('button', { name: '通过' })).toHaveClass(/el-button--success/)
await expect(actions.getByRole('button', { name: '拒绝' })).toHaveClass(/el-button--danger/)
```

- [ ] **Step 2: 运行单个测试并确认当前表格实现失败**

Run: `npx playwright test --config=playwright.payment-tracking.config.js -g "店长审核页"`

Expected: FAIL，因为页面不存在 `.product-row-card`，仍存在 `.el-table`。

### Task 4: 提供共享卡片操作插槽

**Files:**
- Modify: `src/components/payment-tracking/ProductRowCard.vue`

- [ ] **Step 1: 将原按钮包在具名插槽默认内容中**

```vue
<div class="card-actions">
  <slot name="actions" :record="record">
    <!-- 保留现有继续填写、查看记录、恢复流程和删除按钮 -->
  </slot>
</div>
```

- [ ] **Step 2: 运行选品收集和打款记录现有测试**

Run: `npx playwright test --config=playwright.payment-tracking.config.js -g "列表|记录"`

Expected: PASS，未使用插槽的两个页面继续显示原有按钮。

### Task 5: 将店长审核改为卡片列表

**Files:**
- Modify: `src/views/payment-tracking/ManagerReviewList.vue`
- Test: `tests/payment-tracking/payment-tracking.spec.js`

- [ ] **Step 1: 用共享卡片替换表格**

```vue
<section v-loading="loading" class="record-list">
  <ProductRowCard v-for="review in reviews" :key="review.id" :record="review.record">
    <template #actions>
      <el-button type="primary" plain :icon="View" @click="viewRecord(review)">查看记录</el-button>
      <el-button type="success" plain :icon="Check" @click="openApprove(review)">通过</el-button>
      <el-button type="danger" plain :icon="Close" @click="rejectReview(review)">拒绝</el-button>
    </template>
  </ProductRowCard>
  <el-empty v-if="!loading && reviews.length === 0" description="暂无待审核记录" />
</section>
```

- [ ] **Step 2: 直接使用接口附带的只读卡片记录**

```vue
<ProductRowCard
  v-for="review in reviews"
  :key="review.id"
  :record="review.record"
>
```

审核按钮继续把原始 `review` 对象传给 `viewRecord`、`openApprove` 和 `rejectReview`，不改变决策请求参数。

- [ ] **Step 3: 对齐选品和打款记录页面样式**

```css
.manager-review-page { min-width: 0; }
.record-list { display: grid; gap: 10px; min-height: 180px; }
.filter-bar :deep(.el-select) { width: 150px; }
```

移除白底全屏覆盖和表格专用样式，保留详情弹窗样式。

- [ ] **Step 4: 运行店长审核单测**

Run: `npx playwright test --config=playwright.payment-tracking.config.js -g "店长审核页"`

Expected: PASS。

- [ ] **Step 5: 运行完整打款跟踪测试**

Run: `npm run test:payment-tracking`

Expected: 所有测试 PASS。

- [ ] **Step 6: 检查 Vue 语法、差异和本地页面**

Run: `git diff --check`

Expected: exit code 0。随后在 `http://127.0.0.1:5173/#/payment-tracking/manager-reviews` 检查桌面和窄屏布局，无横向溢出。

- [ ] **Step 7: 本地提交**

```powershell
git add -- standalone-server/services/payment-tracking/repository.js standalone-server/services/payment-tracking/manager-review.service.js standalone-server/tests/api/payment-tracking-manager-review.test.js src/components/payment-tracking/ProductRowCard.vue src/views/payment-tracking/ManagerReviewList.vue tests/payment-tracking/payment-tracking.spec.js
git commit -m "style: align manager review with payment cards"
```

不得执行打包，不得推送远程仓库。
