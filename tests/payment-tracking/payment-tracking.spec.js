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
    stages: [stage('selection', 'active')]
  },
  {
    ...baseRecord,
    id: 102,
    storeSeq: 19,
    styleNumber: 'NX-260819',
    currentStage: 'testing',
    processStatus: 'in_progress',
    stages: [stage('selection'), stage('preparation'), stage('testing', 'active')]
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
    if (url.pathname === '/api/payment-tracking/records') {
      const status = url.searchParams.get('processStatus') || url.searchParams.get('status')
      const list = records.filter(record => record.processStatus === status)
      await route.fulfill({ json: { code: 0, data: { list, total: list.length, page: 1, pageSize: 20 } } })
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
