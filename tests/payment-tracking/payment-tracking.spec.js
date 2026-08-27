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

async function installMocks(page) {
  await page.addInitScript(() => {
    localStorage.setItem('d_design_token', 'payment-test-token')
    localStorage.setItem('d_design_user', JSON.stringify({
      id: 1,
      username: 'admin',
      realName: '超级管理员',
      role: 'admin',
      permissions: ['*']
    }))
  })

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
    if (url.pathname === '/api/payment-tracking/records') {
      const status = url.searchParams.get('processStatus') || url.searchParams.get('status')
      const list = records.filter(record => record.processStatus === status)
      await route.fulfill({ json: { code: 0, data: { list, total: list.length, page: 1, pageSize: 20 } } })
      return
    }
    const detailMatch = url.pathname.match(/^\/api\/payment-tracking\/records\/(\d+)$/)
    if (detailMatch && route.request().method() === 'GET') {
      const record = [...records, preparationRecord, ...laterStageRecords]
        .find(item => item.id === Number(detailMatch[1]))
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

test('列表只展示已进入的阶段节点并直接显示结束原因', async ({ page }, testInfo) => {
  await page.goto('/#/payment-tracking/selections')

  const activeCards = page.locator('.product-row-card')
  await expect(activeCards).toHaveCount(2)
  await expect(activeCards.nth(0).locator('.stage-node')).toHaveCount(1)
  await expect(activeCards.nth(1).locator('.stage-node')).toHaveCount(3)
  await expect(activeCards.nth(1)).not.toContainText('第12-18天数据监测')

  await page.goto('/#/payment-tracking/records')
  const endedCard = page.locator('.product-row-card')
  await expect(endedCard).toHaveCount(1)
  await expect(endedCard.locator('.stage-node')).toHaveCount(3)
  await expect(endedCard).toContainText('结束于：第7-11天测款')
  await expect(endedCard).toContainText('已结束（未达潜力款）：直接关闭')
  await expect(endedCard).not.toContainText('第12-18天数据监测')

  await page.screenshot({ path: testInfo.outputPath('payment-records.png'), fullPage: true })
})

test('阶段详情拒绝未来节点并按测款分支展示表单', async ({ page }, testInfo) => {
  await page.goto('/#/payment-tracking/records/101/stages/testing')
  await expect(page).toHaveURL(/#\/payment-tracking\/selections$/)

  await page.goto('/#/payment-tracking/records/101/stages/selection')
  await expect(page.getByRole('heading', { name: '信息及选品' })).toBeVisible()
  await expect(page.getByRole('textbox', { name: '毛利' })).toHaveValue('60.61%')
  await expect(page.locator('.el-checkbox').filter({ hasText: '通过并设计主图' })).toBeVisible()

  await page.goto('/#/payment-tracking/records/102/stages/testing')
  await expect(page.getByRole('heading', { name: '第7-11天测款' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '直通车测点率' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '全站推广' })).toBeVisible()
  await expect(page.getByText('不符合后续操作')).toBeVisible()
  await expect(page.getByRole('button', { name: '进入下一阶段' })).toHaveCount(0)

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

  await page.goto('/#/payment-tracking/records/106/stages/breakout')
  await expect(page.getByRole('heading', { name: '第12-30天打爆' })).toBeVisible()
  await expect(page.getByText('搜索涨幅趋势')).toBeVisible()
  await expect(page.getByText('付款人数趋势')).toBeVisible()

  await page.goto('/#/payment-tracking/records/107/stages/summary')
  await expect(page.getByRole('heading', { name: '总结阶段：生命周期' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: '链接维护' })).toBeVisible()
  await expect(page.getByRole('combobox', { name: '款式定义' })).toBeVisible()
  await expect(page.getByRole('button', { name: '完成流程' })).toBeVisible()

  await page.screenshot({ path: testInfo.outputPath('payment-summary.png'), fullPage: true })
})
