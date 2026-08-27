import { test, expect } from '@playwright/test'

const stage = (stageCode, stageStatus = 'completed') => ({
  stageCode,
  stageStatus,
  isReopened: false
})

const baseRecord = {
  store: '旗舰一店',
  plannerId: 8,
  plannerName: '陈策划',
  selectionDate: '2026-08-20',
  cost: 39,
  salePrice: 99,
  grossMargin: 0.6061,
  productId: '889900',
  images: [],
  version: 3,
  allowedActions: { edit: true, advance: true, end: true, restore: false, delete: true }
}

const records = [
  {
    ...baseRecord,
    id: 101,
    sourceTaskId: 201,
    sourceTaskNo: 'D202608270001',
    storeSeq: 18,
    styleNumber: 'NX-260818',
    currentStage: 'selection',
    processStatus: 'in_progress',
    stages: [stage('selection', 'active')],
    stageData: {
      selection: {
        selectionDate: '2026-08-20',
        styleNumber: 'NX-260818',
        cost: 39,
        salePrice: 99,
        productId: '889900',
        selectionMethod: '方式五：跟款',
        detailText: '',
        designMainImage: false,
        skuLe200: true,
        listingDate: '2026-08-21',
        listingCategory: '女装'
      }
    }
  },
  {
    ...baseRecord,
    id: 102,
    storeSeq: 19,
    styleNumber: 'NX-260819',
    currentStage: 'testing',
    processStatus: 'in_progress',
    stages: [stage('selection'), stage('preparation'), stage('testing', 'active')],
    stageData: {
      testing: {
        carPromotionMethod: '标准推广',
        carClicks: 320,
        carCtr: 4.8,
        carQualifies: true,
        sitePromotionMethod: '全站推广',
        overallVisitors: 2600,
        searchVisitors: 780,
        searchVisitorShare: 0.3,
        buyers: 86,
        averageCtr: 5.2,
        potentialStatus: '不符合',
        unqualifiedAction: '直接关闭',
        managerReportDate: null,
        weiStockReported: false
      }
    }
  },
  {
    ...baseRecord,
    id: 103,
    storeSeq: 20,
    styleNumber: 'NX-260820',
    currentStage: 'testing',
    processStatus: 'ended',
    endStage: 'testing',
    endReason: '已结束（未达潜力款）：直接关闭',
    stages: [stage('selection'), stage('preparation'), stage('testing', 'ended')],
    allowedActions: { restore: true, delete: true }
  }
]

const preparationRecord = {
  ...baseRecord,
  id: 104,
  storeSeq: 21,
  styleNumber: 'NX-260821',
  currentStage: 'preparation',
  processStatus: 'in_progress',
  stages: [stage('selection'), stage('preparation', 'active')],
  stageData: {
    preparation: {
      reviewCount: 12,
      newOpsRegistered: true,
      paidEnabled: null,
      paidAt: null
    }
  },
  allowedActions: { edit: true, advance: true, end: true, managerReview: false }
}

const laterStageRecords = [
  {
    ...baseRecord,
    id: 105,
    storeSeq: 22,
    styleNumber: 'NX-260822',
    currentStage: 'monitoring',
    processStatus: 'in_progress',
    stages: [stage('selection'), stage('preparation'), stage('testing'), stage('monitoring', 'active')],
    stageData: {
      monitoring: {
        domesticSalesCount: 20,
        addedReviews: 5,
        campaignName: '超级立减',
        concessionRate: '10%',
        quickPeakDone: false,
        abandoned: true,
        abandonReason: '自然流量不足',
        abandonAt: '2026-08-26 10:00:00',
        adjustments: [{
          id: 1,
          sortOrder: 0,
          reason: '搜索流量下降',
          adjustedAt: '2026-08-24 09:00:00',
          feeRatio7d: 12.5,
          payers7d: 38,
          totalBudget: 2600,
          detailText: '降低低效词出价',
          feedbackText: '点击率回升'
        }]
      }
    },
    allowedActions: { edit: true, advance: true, end: true }
  },
  {
    ...baseRecord,
    id: 106,
    storeSeq: 23,
    styleNumber: 'NX-260823',
    currentStage: 'breakout',
    processStatus: 'in_progress',
    stages: [stage('selection'), stage('preparation'), stage('testing'), stage('monitoring'), stage('breakout', 'active')],
    stageData: {
      breakout: {
        strongLiftQualified: true,
        searchGrowthTrend: '持续上升',
        payerTrend: '保持平稳',
        currentBudget: 3000,
        feeRatio7d: 11.2,
        payers7d: 76
      }
    },
    allowedActions: { edit: true, advance: true, end: true }
  },
  {
    ...baseRecord,
    id: 107,
    storeSeq: 24,
    styleNumber: 'NX-260824',
    currentStage: 'summary',
    processStatus: 'in_progress',
    stages: [stage('selection'), stage('preparation'), stage('testing'), stage('monitoring'), stage('breakout'), stage('summary', 'active')],
    stageData: {
      summary: {
        exploded: true,
        linkMaintenance: '小爆款',
        styleDefinition: '强动销',
        summaryText: '',
        notes: ''
      }
    },
    allowedActions: { edit: true, advance: false, end: true }
  }
]

const advancePreparationRecord = {
  ...baseRecord,
  id: 108,
  storeSeq: 25,
  styleNumber: 'NX-260825',
  currentStage: 'preparation',
  processStatus: 'in_progress',
  stages: [stage('selection'), stage('preparation', 'active')],
  stageData: {
    preparation: {
      reviewCount: 16,
      newOpsRegistered: true,
      paidEnabled: true,
      paidAt: '2026-08-27 10:00:00'
    }
  },
  allowedActions: { edit: true, advance: true, end: true, managerReview: true }
}

const invalidSelectionRecord = {
  ...baseRecord,
  id: 109,
  storeSeq: 26,
  selectionDate: null,
  styleNumber: '',
  cost: null,
  salePrice: null,
  productId: '',
  currentStage: 'selection',
  processStatus: 'in_progress',
  stages: [stage('selection', 'active')],
  stageData: {
    selection: {
      selectionDate: null,
      styleNumber: '',
      cost: null,
      salePrice: null,
      productId: '',
      selectionMethod: '',
      detailText: '',
      designMainImage: false,
      skuLe200: null,
      listingDate: null,
      listingCategory: ''
    }
  }
}

const invalidBreakoutRecord = {
  ...baseRecord,
  id: 110,
  storeSeq: 27,
  styleNumber: 'NX-260826',
  currentStage: 'breakout',
  processStatus: 'in_progress',
  stages: [stage('selection'), stage('preparation'), stage('testing'), stage('monitoring'), stage('breakout', 'active')],
  stageData: { breakout: { strongLiftQualified: null } },
  allowedActions: { edit: true, advance: true, end: true }
}

const allDetailRecords = [
  ...records,
  preparationRecord,
  ...laterStageRecords,
  advancePreparationRecord,
  invalidSelectionRecord,
  invalidBreakoutRecord
]
const nextStageByCode = {
  selection: 'preparation',
  preparation: 'testing',
  testing: 'monitoring',
  monitoring: 'breakout',
  breakout: 'summary'
}

const reviewTasks = [
  {
    id: 201,
    task_no: 'D202608270001',
    title: '夏季连衣裙主图',
    status: 'doing',
    task_group: 'design',
    designer_name: '美工甲',
    create_time: '2026-08-27 09:00:00',
    payment_tracking_opened: 0,
    files: [
      { id: 2001, file_name: 'dress-main-1.png', file_type: 'image', file_category: 'work' },
      { id: 2002, file_name: 'dress-main-2.png', file_type: 'image', file_category: 'work' }
    ]
  },
  {
    id: 202,
    task_no: 'D202608270002',
    title: '无作品图任务',
    status: 'doing',
    task_group: 'design',
    designer_name: '美工乙',
    create_time: '2026-08-27 08:00:00',
    payment_tracking_opened: 0,
    files: [{ id: 2003, file_name: 'source.psd', file_type: 'file', file_category: 'work' }]
  },
  {
    id: 203,
    task_no: 'D202608270003',
    title: '已开启任务',
    status: 'doing',
    task_group: 'design',
    designer_name: '美工丙',
    create_time: '2026-08-27 07:00:00',
    payment_tracking_opened: 1,
    files: [{ id: 2004, file_name: 'opened.png', file_type: 'image', file_category: 'work' }]
  }
]

async function installMocks(page, options = {}) {
  const permissions = options.permissions || ['*']
  const recordOverrides = new Map()
  const getMockRecord = id => recordOverrides.get(Number(id))
    || allDetailRecords.find(record => record.id === Number(id))
  await page.addInitScript(() => {
    localStorage.setItem('d_design_token', 'payment-test-token')
  })
  await page.addInitScript(({ userPermissions }) => {
    localStorage.setItem('d_design_user', JSON.stringify({
      id: 1,
      username: 'admin',
      realName: '超级管理员',
      role: 'admin',
      permissions: userPermissions
    }))
  }, { userPermissions: permissions })

  await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/health') {
      await route.fulfill({ json: { code: 0, data: { status: 'ok' } } })
      return
    }
    if (url.pathname === '/api/announcement/active') {
      await route.fulfill({ json: { code: 0, data: null } })
      return
    }
    if (url.pathname === '/api/notification/unread-count') {
      await route.fulfill({ json: { code: 0, data: { count: 0 } } })
      return
    }
    if (url.pathname === '/api/notification/list') {
      await route.fulfill({ json: { code: 0, data: { list: [], total: 0 } } })
      return
    }
    if (url.pathname === '/api/config/list') {
      await route.fulfill({ json: { code: 0, data: [] } })
      return
    }
    if (url.pathname === '/api/task/stats/my') {
      await route.fulfill({ json: { code: 0, data: {} } })
      return
    }
    if (url.pathname === '/api/task/my-published') {
      await route.fulfill({
        json: { code: 0, data: { list: reviewTasks, total: reviewTasks.length, page: 1, pageSize: 15 } }
      })
      return
    }
    if (url.pathname === '/api/task/detail') {
      const task = reviewTasks.find(item => item.id === Number(url.searchParams.get('taskId')))
      await route.fulfill({
        status: task ? 200 : 404,
        json: task ? { code: 0, data: task } : { code: 404, msg: '任务不存在' }
      })
      return
    }
    if (url.pathname === '/api/payment-tracking/open/batch') {
      await route.fulfill({
        json: {
          code: 0,
          data: {
            successCount: 1,
            skippedCount: 2,
            created: [{ taskId: 201, recordId: 301 }],
            skipped: [
              { taskId: 202, taskNo: 'D202608270002', reason: '没有作品图片' },
              { taskId: 203, taskNo: 'D202608270003', reason: '已开启打款' }
            ]
          }
        }
      })
      return
    }
    if (url.pathname === '/api/payment-tracking/open/task/201') {
      await route.fulfill({ json: { code: 0, msg: '打款已开启', data: { id: 301, sourceTaskId: 201 } } })
      return
    }
    if (url.pathname === '/api/payment-tracking/records') {
      const status = url.searchParams.get('processStatus') || url.searchParams.get('status')
      const list = records
        .map(record => recordOverrides.get(record.id) || record)
        .filter(record => record.processStatus === status)
      await route.fulfill({ json: { code: 0, data: { list, total: list.length, page: 1, pageSize: 20 } } })
      return
    }
    const stageSaveMatch = url.pathname.match(/^\/api\/payment-tracking\/records\/(\d+)\/stages\/([^/]+)$/)
    if (stageSaveMatch && route.request().method() === 'PUT') {
      const id = Number(stageSaveMatch[1])
      const stageCode = stageSaveMatch[2]
      const current = getMockRecord(id)
      const payload = route.request().postDataJSON()
      if (id === Number(options.stageSaveConflictId)) {
        recordOverrides.set(id, {
          ...current,
          version: Number(current.version || 0) + 1,
          stageData: {
            ...current.stageData,
            [stageCode]: { ...current.stageData?.[stageCode], reviewCount: 99 }
          }
        })
        await route.fulfill({ json: { code: 409, msg: '记录已被其他人更新，请刷新后重试' } })
        return
      }
      const updated = {
        ...current,
        version: Number(current.version || 0) + 1,
        stageData: { ...current.stageData, [stageCode]: payload.data }
      }
      recordOverrides.set(id, updated)
      await route.fulfill({ json: { code: 0, data: updated } })
      return
    }
    const advanceMatch = url.pathname.match(/^\/api\/payment-tracking\/records\/(\d+)\/advance$/)
    if (advanceMatch && route.request().method() === 'POST') {
      const id = Number(advanceMatch[1])
      const current = getMockRecord(id)
      const nextStage = nextStageByCode[current.currentStage]
      const updated = {
        ...current,
        currentStage: nextStage,
        version: Number(current.version || 0) + 1,
        stages: [
          ...current.stages.map(item => item.stageCode === current.currentStage
            ? { ...item, stageStatus: 'completed' }
            : item),
          stage(nextStage, 'active')
        ]
      }
      recordOverrides.set(id, updated)
      await route.fulfill({ json: { code: 0, data: updated } })
      return
    }
    const endMatch = url.pathname.match(/^\/api\/payment-tracking\/records\/(\d+)\/end$/)
    if (endMatch && route.request().method() === 'POST') {
      const id = Number(endMatch[1])
      const current = getMockRecord(id)
      const updated = {
        ...current,
        processStatus: 'ended',
        endStage: current.currentStage,
        endReason: current.currentStage === 'summary' ? '生命周期总结完成' : '主动结束流程',
        version: Number(current.version || 0) + 1
      }
      recordOverrides.set(id, updated)
      await route.fulfill({ json: { code: 0, data: updated } })
      return
    }
    const restoreMatch = url.pathname.match(/^\/api\/payment-tracking\/records\/(\d+)\/restore$/)
    if (restoreMatch && route.request().method() === 'POST') {
      const id = Number(restoreMatch[1])
      const current = getMockRecord(id)
      const updated = {
        ...current,
        processStatus: 'in_progress',
        endStage: null,
        endReason: '',
        version: Number(current.version || 0) + 1,
        allowedActions: { edit: true, advance: false, end: true, restore: false, delete: true }
      }
      recordOverrides.set(id, updated)
      await route.fulfill({ json: { code: 0, data: updated } })
      return
    }
    const detailMatch = url.pathname.match(/^\/api\/payment-tracking\/records\/(\d+)$/)
    if (detailMatch && route.request().method() === 'GET') {
      const record = getMockRecord(detailMatch[1])
      await route.fulfill({
        status: record ? 200 : 404,
        json: record ? { code: 0, data: record } : { code: 404, msg: '记录不存在' }
      })
      return
    }
    await route.fulfill({ status: 404, json: { code: 404, msg: '未配置测试接口' } })
  })
}

test.beforeEach(async ({ page }) => {
  await installMocks(page)
})

async function expectNoHorizontalPageOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    pageWidth: document.documentElement.scrollWidth
  }))
  expect(dimensions.pageWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
}

test('列表只展示已进入的阶段节点并直接显示结束原因', async ({ page }, testInfo) => {
  await page.goto('/#/payment-tracking/selections')

  const activeCards = page.locator('.product-row-card')
  await expect(activeCards).toHaveCount(2)
  await expect(activeCards.nth(0).locator('.stage-node')).toHaveCount(1)
  await expect(activeCards.nth(0).getByRole('button', { name: 'D202608270001' })).toBeVisible()
  await activeCards.nth(0).getByRole('button', { name: 'D202608270001' }).click()
  await expect(page.getByRole('dialog', { name: '夏季连衣裙主图' })).toBeVisible()
  await page.getByRole('dialog', { name: '夏季连衣裙主图' }).getByRole('button', { name: '关闭', exact: true }).click()
  await expect(activeCards.nth(1).locator('.stage-node')).toHaveCount(3)
  await expect(activeCards.nth(1)).not.toContainText('第12-18天数据监测')

  await page.goto('/#/payment-tracking/records')
  const endedCard = page.locator('.product-row-card')
  await expect(endedCard).toHaveCount(1)
  await expect(endedCard.locator('.stage-node')).toHaveCount(3)
  await expect(endedCard).toContainText('结束于：第7-11天测款')
  await expect(endedCard).toContainText('已结束（未达潜力款）：直接关闭')
  await expect(endedCard).not.toContainText('第12-18天数据监测')
  await expectNoHorizontalPageOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('payment-records.png'), fullPage: true })

  const restoreRequest = page.waitForRequest(request => (
    request.method() === 'POST' && new URL(request.url()).pathname === '/api/payment-tracking/records/103/restore'
  ))
  await endedCard.getByRole('button', { name: '恢复流程' }).click()
  await page.getByRole('button', { name: '确认恢复' }).click()
  await restoreRequest
  await expect(page).toHaveURL(/#\/payment-tracking\/records$/)
  await expect(page.locator('.product-row-card')).toHaveCount(0)
  await expect(page.getByText('暂无已结束的打款记录')).toBeVisible()
})

test('阶段详情拒绝未来节点并按测款分支展示表单', async ({ page }, testInfo) => {
  await page.goto('/#/payment-tracking/records/101/stages/testing')
  await expect(page).toHaveURL(/#\/payment-tracking\/selections$/)

  await page.goto('/#/payment-tracking/records/101/stages/selection')
  await expect(page.getByRole('heading', { name: '信息及选品' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '毛利' })).toHaveValue('60.61%')
  await expect(page.locator('.el-checkbox').filter({ hasText: '通过并设计主图' })).toBeVisible()
  await expectNoHorizontalPageOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('payment-selection.png'), fullPage: true })

  await page.goto('/#/payment-tracking/records/102/stages/testing')
  await expect(page.getByRole('heading', { name: '第7-11天测款' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '直通车测点率' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '全站推广' })).toBeVisible()
  await expect(page.getByText('不符合后续操作')).toBeVisible()
  await expect(page.getByRole('button', { name: '进入下一阶段' })).toHaveCount(0)
  await expectNoHorizontalPageOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('payment-testing.png'), fullPage: true })

  await page.goto('/#/payment-tracking/records/104/stages/preparation')
  await expect(page.getByRole('heading', { name: '第1-6天准备工作' })).toBeVisible()
  await expect(page.getByText('仅店长审核权限可修改')).toBeVisible()
  const paidReview = page.locator('.el-form-item').filter({ hasText: '确认开启付费' })
  await expect(paidReview.locator('.el-radio').first()).toHaveClass(/is-disabled/)

  await expect(page.locator('.el-message')).toHaveCount(0, { timeout: 6_000 })
  await page.screenshot({ path: testInfo.outputPath('payment-preparation.png'), fullPage: true })
})

test('后续阶段按业务分支展示并使用独立总结选项', async ({ page }, testInfo) => {
  await page.goto('/#/payment-tracking/records/105/stages/monitoring')
  await expect(page.getByRole('heading', { name: '第12-18天数据监测' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '推广调整' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新增调整' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '放弃原因' })).toHaveValue('自然流量不足')
  await expect(page.getByRole('button', { name: '进入下一阶段' })).toHaveCount(0)
  await page.getByRole('button', { name: '新增调整' }).click()
  await expect(page.getByText('第 2 次调整')).toBeVisible()
  await page.getByRole('button', { name: '删除本次调整' }).click()
  await expect(page.getByText('第 2 次调整')).toHaveCount(0)
  await expectNoHorizontalPageOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('payment-monitoring.png'), fullPage: true })

  await page.goto('/#/payment-tracking/records/106/stages/breakout')
  await expect(page.getByRole('heading', { name: '第12-30天打爆' })).toBeVisible()
  await expect(page.getByText('搜索涨幅趋势')).toBeVisible()
  await expect(page.getByText('付款人数趋势')).toBeVisible()
  const strongLiftField = page.locator('.el-form-item').filter({ hasText: '是否符合强拉升标准' })
  await strongLiftField.getByText('否', { exact: true }).click()
  await expect(page.getByText('搜索涨幅趋势')).toHaveCount(0)
  await strongLiftField.getByText('是', { exact: true }).click()
  await expect(page.getByText('搜索涨幅趋势')).toBeVisible()

  await page.goto('/#/payment-tracking/records/107/stages/summary')
  await expect(page.getByRole('heading', { name: '总结阶段：生命周期' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: '链接维护' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: '款式定义' })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成流程' })).toBeVisible()
  await expectNoHorizontalPageOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('payment-summary.png'), fullPage: true })

  const saveSummaryRequest = page.waitForRequest(request => (
    request.method() === 'PUT' && new URL(request.url()).pathname === '/api/payment-tracking/records/107/stages/summary'
  ))
  const endSummaryRequest = page.waitForRequest(request => (
    request.method() === 'POST' && new URL(request.url()).pathname === '/api/payment-tracking/records/107/end'
  ))
  await page.getByRole('button', { name: '完成流程' }).click()
  await page.getByRole('button', { name: '确认完成' }).click()
  await saveSummaryRequest
  await endSummaryRequest
  await expect(page).toHaveURL(/#\/payment-tracking\/records$/)
})

test('有效准备工作可以保存并进入测款阶段', async ({ page }) => {
  await page.goto('/#/payment-tracking/records/108/stages/preparation')
  await expect(page.getByRole('heading', { name: '第1-6天准备工作' })).toBeVisible()

  const saveRequest = page.waitForRequest(request => (
    request.method() === 'PUT' && new URL(request.url()).pathname === '/api/payment-tracking/records/108/stages/preparation'
  ))
  const advanceRequest = page.waitForRequest(request => (
    request.method() === 'POST' && new URL(request.url()).pathname === '/api/payment-tracking/records/108/advance'
  ))
  await page.getByRole('button', { name: '进入下一阶段' }).click()
  await page.getByRole('button', { name: '确认进入' }).click()
  await saveRequest
  await advanceRequest
  await expect(page).toHaveURL(/#\/payment-tracking\/records\/108\/stages\/testing$/)
})

test('保存遇到版本冲突时刷新服务器最新记录', async ({ page }) => {
  await installMocks(page, { stageSaveConflictId: 108 })
  await page.goto('/#/payment-tracking/records/108/stages/preparation')

  const reviewCount = page.getByRole('spinbutton', { name: '评价数量' })
  await expect(reviewCount).toHaveValue('16')
  await page.getByRole('button', { name: '保存本阶段' }).click()

  await expect(page.getByText('记录已被其他人更新，请刷新后重试', { exact: true })).toBeVisible()
  await expect(reviewCount).toHaveValue('99')
})

test('各阶段关键必填条件会阻止无效推进或结束', async ({ page }) => {
  await page.goto('/#/payment-tracking/records/109/stages/selection')
  await page.getByRole('button', { name: '进入下一阶段' }).click()
  for (const message of [
    '请选择选品日期',
    '请填写货号',
    '请输入非负数字',
    '售价必须大于 0',
    '请填写产品 ID',
    '请选择选品方式',
    '请选择 SKU 数是否不超过 200',
    '请选择上架日期',
    '请填写上架类目'
  ]) {
    await expect(page.getByText(message, { exact: true }).first()).toBeVisible()
  }

  await page.goto('/#/payment-tracking/records/101/stages/selection')
  await page.getByRole('button', { name: '进入下一阶段' }).click()
  await expect(page.getByText('至少上传一张产品主图', { exact: true })).toBeVisible()

  await page.goto('/#/payment-tracking/records/104/stages/preparation')
  await page.getByRole('button', { name: '进入下一阶段' }).click()
  await expect(page.getByText('店长必须确认开启付费', { exact: true })).toBeVisible()

  await page.goto('/#/payment-tracking/records/105/stages/monitoring')
  await page.getByRole('textbox', { name: '放弃原因' }).fill('')
  await page.getByRole('button', { name: '结束流程' }).click()
  await expect(page.getByText('请填写放弃原因', { exact: true })).toBeVisible()

  await page.goto('/#/payment-tracking/records/110/stages/breakout')
  await page.getByRole('button', { name: '进入下一阶段' }).click()
  await expect(page.getByText('请选择是否符合强拉升标准', { exact: true })).toBeVisible()
})

test('作品审核开启打款按图片和开启状态控制并汇总批量结果', async ({ page }, testInfo) => {
  await page.goto('/#/operator/review')

  await expect(page.getByRole('button', { name: /批量开启打款/ })).toBeVisible()
  const openButtons = page.getByRole('button', { name: '开启打款', exact: true })
  await expect(openButtons).toHaveCount(3)
  await expect(openButtons.nth(0)).toBeEnabled()
  await expect(openButtons.nth(1)).toBeDisabled()
  await expect(openButtons.nth(2)).toBeDisabled()

  const singleOpenRequest = page.waitForRequest(request => (
    request.method() === 'POST' && new URL(request.url()).pathname === '/api/payment-tracking/open/task/201'
  ))
  await openButtons.nth(0).click()
  await singleOpenRequest

  await page.locator('.el-table__header-wrapper .el-checkbox').click()
  await page.getByRole('button', { name: /批量开启打款/ }).click()
  await expect(page.getByText('成功1条，跳过2条')).toBeVisible()
  await expect(page.getByText('D202608270002：没有作品图片')).toBeVisible()
  await expect(page.getByText('D202608270003：已开启打款')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('review-payment-opening.png'), fullPage: true })
})

test('作品审核无开启打款权限时隐藏入口', async ({ page }) => {
  await installMocks(page, { permissions: ['operator.review.design'] })
  await page.goto('/#/operator/review')

  await expect(page.getByRole('button', { name: /批量开启打款/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '开启打款', exact: true })).toHaveCount(0)
})
