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
        selectionDate: '2026-08-27 09:00:00',
        styleNumber: 'NX-260818',
        cost: 39,
        salePrice: 99,
        productId: '889900',
        selectionMethod: '方式五：跟款',
        detailText: '',
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
    stages: [stage('selection'), stage('testing', 'active')],
    stageData: {
      testing: {
        paidEnabled: true,
        paidAt: '2026-08-23 10:00:00',
        promotionMethod: '直通车',
        potentialStatus: '不符合',
        unqualifiedAction: '直接关闭',
        managerReportDate: null,
        weiStockReported: false
      }
    },
    linkStatus: {
      stageCode: 'testing',
      flashSaleRegistered: true,
      flashSaleGroup: 'new_product_cold_start',
      rapidOrderEntered: true,
      newProductOperationRegistered: false,
      newProductPeak: null,
      productBurst: null,
      productBurstMode: ''
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
    stages: [stage('selection'), stage('testing', 'ended')],
    allowedActions: { restore: true, delete: true }
  }
]

const linkedImageRecord = {
  ...records[0],
  id: 111,
  storeSeq: 28,
  styleNumber: 'NX-260828',
  images: [{
    id: 501,
    category: 'product_main',
    originalName: 'dress-main-1.png',
    mimeType: 'image/png',
    fileSize: 4096,
    sortOrder: 0,
    sourceTaskFileId: 2001
  }]
}

const testingReviewRecord = {
  ...baseRecord,
  id: 104,
  storeSeq: 21,
  styleNumber: 'NX-260821',
  currentStage: 'testing',
  processStatus: 'in_progress',
  stages: [stage('selection'), stage('testing', 'active')],
  stageData: {
    testing: {
      paidEnabled: null,
      paidAt: null,
      promotionMethod: '',
      potentialStatus: '符合潜力款标准',
      unqualifiedAction: '',
      managerReportDate: null,
      weiStockReported: null
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
    stages: [stage('selection'), stage('testing'), stage('monitoring', 'active')],
    stageData: {
      monitoring: {
        linkOptimized: true,
        linkStatus: 'protect_roi',
        adjustments: [
          {
            id: 1,
            clientKey: 'adjustment-one',
            reason: '搜索流量下降',
            adjustedAt: '2026-08-24 09:00:00',
            detailText: '降低低效词出价',
            feedbackText: '点击率回升'
          },
          {
            id: 2,
            clientKey: 'adjustment-two',
            reason: '扩大有效流量',
            adjustedAt: '2026-08-25 09:00:00',
            detailText: '提高优质词出价',
            feedbackText: '付款人数提升'
          }
        ]
      }
    },
    images: [
      { id: 601, category: 'adjustment_feedback', adjustmentId: 1, originalName: 'feedback-one.png', sortOrder: 0 },
      { id: 602, category: 'adjustment_feedback', adjustmentId: 2, originalName: 'feedback-two.png', sortOrder: 0 },
      { id: 603, category: 'link_optimization', adjustmentId: null, originalName: 'link-before.png', sortOrder: 0 }
    ],
    linkStatus: {
      stageCode: 'monitoring',
      flashSaleRegistered: true,
      flashSaleGroup: 'potential_breakout',
      rapidOrderEntered: true,
      newProductOperationRegistered: true,
      newProductPeak: true,
      productBurst: true,
      productBurstMode: 'super_breakout'
    },
    allowedActions: { edit: true, advance: true, end: true }
  },
  {
    ...baseRecord,
    id: 106,
    storeSeq: 23,
    styleNumber: 'NX-260823',
    currentStage: 'monitoring',
    processStatus: 'in_progress',
    stages: [stage('selection'), stage('testing'), stage('monitoring', 'active')],
    stageData: {
      monitoring: {
        linkOptimized: false,
        linkStatus: 'keep_breaking',
        adjustments: []
      }
    },
    linkStatus: {
      stageCode: 'testing',
      flashSaleRegistered: false,
      flashSaleGroup: '',
      rapidOrderEntered: null,
      newProductOperationRegistered: true,
      newProductPeak: false,
      productBurst: false,
      productBurstMode: ''
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
    stages: [stage('selection'), stage('testing'), stage('monitoring'), stage('summary', 'active')],
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

const advanceTestingRecord = {
  ...baseRecord,
  id: 108,
  storeSeq: 25,
  styleNumber: 'NX-260825',
  currentStage: 'testing',
  processStatus: 'in_progress',
  stages: [stage('selection'), stage('testing', 'active')],
  stageData: {
    testing: {
      paidEnabled: true,
      paidAt: '2026-08-27 10:00:00',
      promotionMethod: '直通车',
      potentialStatus: '符合潜力款标准',
      unqualifiedAction: '',
      managerReportDate: null,
      weiStockReported: null
    }
  },
  images: [
    { id: 510, category: 'product_main', originalName: 'selection-main.png', sortOrder: 0 },
    { id: 511, category: 'potential_judgment', originalName: 'testing-proof.png', sortOrder: 0 }
  ],
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
      listingDate: null,
      listingCategory: ''
    }
  }
}

const invalidMonitoringRecord = {
  ...baseRecord,
  id: 110,
  storeSeq: 27,
  styleNumber: 'NX-260826',
  currentStage: 'monitoring',
  processStatus: 'in_progress',
  stages: [stage('selection'), stage('testing'), stage('monitoring', 'active')],
  stageData: { monitoring: { linkOptimized: null, linkStatus: '', adjustments: [] } },
  allowedActions: { edit: true, advance: true, end: true }
}

const reopenedTestingRecord = {
  ...baseRecord,
  id: 112,
  storeSeq: 29,
  styleNumber: 'NX-260829',
  currentStage: 'summary',
  processStatus: 'in_progress',
  stages: [
    stage('selection'),
    { ...stage('testing'), isReopened: true },
    stage('monitoring'),
    stage('summary', 'active')
  ],
  stageData: {
    testing: {
      paidEnabled: true,
      paidAt: '2026-08-23 10:00:00',
      promotionMethod: '直通车',
      potentialStatus: '符合潜力款标准',
      unqualifiedAction: '',
      managerReportDate: null,
      weiStockReported: true
    },
    monitoring: { linkOptimized: true, linkStatus: 'keep_breaking', adjustments: [] },
    summary: { summaryText: '旧总结' }
  },
  images: [
    { id: 610, category: 'potential_judgment', originalName: 'testing-kept.png', sortOrder: 0 },
    { id: 611, category: 'link_optimization', originalName: 'monitoring-invalidated.png', sortOrder: 0 }
  ],
  linkStatus: {
    stageCode: 'monitoring',
    flashSaleRegistered: true,
    flashSaleGroup: 'potential_breakout',
    rapidOrderEntered: true,
    newProductOperationRegistered: true,
    newProductPeak: true,
    productBurst: true,
    productBurstMode: 'super_breakout'
  },
  allowedActions: { edit: true, advance: false, end: true, reopen: true, managerReview: true }
}

const allDetailRecords = [
  ...records,
  linkedImageRecord,
  testingReviewRecord,
  ...laterStageRecords,
  advanceTestingRecord,
  invalidSelectionRecord,
  invalidMonitoringRecord,
  reopenedTestingRecord
]
const nextStageByCode = {
  selection: 'testing',
  testing: 'monitoring',
  monitoring: 'summary'
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
    payment_tracking_opened: '0',
    files: [
      { id: 2005, file_name: 'dress-reference.png', file_type: 'image', file_category: 'reference' },
      { id: 2006, file_name: 'dress-brief.pdf', file_type: 'file', file_category: 'reference', file_size: 1234 },
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
    payment_tracking_opened: '0',
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
    payment_tracking_opened: '1',
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
    if (/^\/api\/task\/preview\/\d+$/.test(url.pathname)) {
      await route.fulfill({
        contentType: 'image/png',
        body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
      })
      return
    }
    if (/^\/api\/payment-tracking\/images\/\d+\/preview$/.test(url.pathname)) {
      await route.fulfill({
        contentType: 'image/png',
        body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
      })
      return
    }
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
    if (url.pathname === '/api/payment-tracking/categories') {
      await route.fulfill({ json: { code: 0, data: [{ id: 1, name: '女装', active: 1 }] } })
      return
    }
    if (url.pathname === '/api/payment-tracking/promotion-methods') {
      await route.fulfill({
        json: { code: 0, data: [
          { id: 1, name: '直通车', active: 1 },
          { id: 2, name: '全站推广', active: 1 },
          { id: 3, name: '关键词推广', active: 1 }
        ] }
      })
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
    const linkStatusMatch = url.pathname.match(/^\/api\/payment-tracking\/records\/(\d+)\/stages\/([^/]+)\/link-status$/)
    if (linkStatusMatch && route.request().method() === 'PUT') {
      const id = Number(linkStatusMatch[1])
      const stageCode = linkStatusMatch[2]
      const current = getMockRecord(id)
      const payload = route.request().postDataJSON()
      const updated = {
        ...current,
        version: Number(current.version || 0) + 1,
        linkStatus: payload.clear ? null : { stageCode, ...payload.data }
      }
      recordOverrides.set(id, updated)
      await route.fulfill({ json: { code: 0, data: updated } })
      return
    }
    const imageUploadMatch = url.pathname.match(/^\/api\/payment-tracking\/records\/(\d+)\/images\/([^/]+)$/)
    if (imageUploadMatch && route.request().method() === 'POST') {
      const id = Number(imageUploadMatch[1])
      const category = imageUploadMatch[2]
      const current = getMockRecord(id)
      const multipart = route.request().postData() || ''
      const adjustmentId = Number(multipart.match(/name="adjustmentId"\r?\n\r?\n(\d+)/)?.[1]) || null
      const originalName = multipart.match(/filename="([^"]+)"/)?.[1] || 'uploaded-feedback.png'
      const updated = {
        ...current,
        version: Number(current.version || 0) + 1,
        images: [
          ...(current.images || []),
          {
            id: 700 + (current.images || []).length,
            category,
            adjustmentId,
            originalName,
            sortOrder: 0
          }
        ]
      }
      recordOverrides.set(id, updated)
      await route.fulfill({ json: { code: 0, data: updated } })
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
            [stageCode]: { ...current.stageData?.[stageCode], promotionMethod: '关键词推广' }
          }
        })
        await route.fulfill({ json: { code: 409, msg: '记录已被其他人更新，请刷新后重试' } })
        return
      }
      if (payload.confirmDownstreamInvalidation === true) {
        const retainedStages = ['selection', stageCode]
        const updated = {
          ...current,
          version: Number(current.version || 0) + 1,
          currentStage: stageCode,
          processStatus: 'ended',
          endStage: stageCode,
          endType: stageCode === 'testing' ? 'payment_not_enabled' : 'protect_roi',
          endReason: stageCode === 'testing' ? '店长未确认开启付费' : '链接状态：保投产',
          stages: current.stages
            .filter(item => retainedStages.includes(item.stageCode))
            .map(item => item.stageCode === stageCode
              ? { ...item, stageStatus: 'ended', isReopened: false }
              : item),
          stageData: {
            ...current.stageData,
            [stageCode]: { ...payload.data },
            monitoring: stageCode === 'monitoring' ? { ...payload.data } : undefined,
            summary: undefined
          },
          images: (current.images || []).filter(image => (
            stageCode === 'monitoring' || image.category === 'potential_judgment'
          )),
          linkStatus: stageCode === 'monitoring' ? current.linkStatus : null
        }
        recordOverrides.set(id, updated)
        await route.fulfill({ json: { code: 0, data: updated } })
        return
      }
      const updated = {
        ...current,
        version: Number(current.version || 0) + 1,
        stageData: {
          ...current.stageData,
          [stageCode]: {
            ...payload.data,
            ...(stageCode === 'monitoring' ? {
              adjustments: (payload.data.adjustments || []).map((item, index) => ({
                ...item,
                id: item.id || 100 + index
              }))
            } : {})
          }
        }
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

async function pasteClipboardImage(page, options = {}) {
  const file = {
    name: options.name ?? '',
    mimeType: options.mimeType || 'image/png',
    content: options.content || 'clipboard-image'
  }
  return page.evaluate(clipboardFile => {
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File(
      [clipboardFile.content],
      clipboardFile.name,
      { type: clipboardFile.mimeType }
    ))
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }, file)
}

async function pasteClipboardText(page, text) {
  return page.evaluate(value => {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData('text/plain', value)
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    })
    window.dispatchEvent(event)
    return event.defaultPrevented
  }, text)
}

test('联动原任务图片拖到桌面时保留原文件名', async ({ page }) => {
  await page.addInitScript(() => {
    window.__paymentImageDragCalls = []
    window.electronAPI = {
      isFileCached(fileId) {
        window.__paymentImageDragCalls.push({ type: 'isFileCached', fileId })
        return false
      },
      doFileDrag(fileId) {
        window.__paymentImageDragCalls.push({ type: 'doFileDrag', fileId })
        return false
      },
      prepareFileDrags(params) {
        window.__paymentImageDragCalls.push({ type: 'prepareFileDrags', params })
        return Promise.resolve({ success: true })
      }
    }
  })

  await page.goto('/#/payment-tracking/records/111/stages/selection')
  const linkedImage = page.locator('.image-item').first()
  await expect(linkedImage).toContainText('dress-main-1.png')

  const dragData = await linkedImage.evaluate(element => {
    const dataTransfer = new DataTransfer()
    element.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }))
    return { downloadUrl: dataTransfer.getData('DownloadURL') }
  })

  expect(dragData.downloadUrl).toContain(':dress-main-1.png:')
  expect(dragData.downloadUrl).toContain('/api/task/download/2001')
  await expect.poll(() => page.evaluate(() => window.__paymentImageDragCalls)).toContainEqual({
    type: 'prepareFileDrags',
    params: {
      items: [{ fileId: 2001, fileName: 'dress-main-1.png' }],
      token: 'payment-test-token'
    }
  })
})

test('来源任务详情保留原浏览器下载方式', async ({ page }) => {
  await page.addInitScript(() => {
    window.__sourceDownloadCalls = []
    window.open = (...args) => {
      window.__sourceDownloadCalls.push({ type: 'browser', args })
      return null
    }
    window.electronAPI = {
      previewImage({ fileId }) {
        return `/api/task/preview/${fileId}`
      },
      downloadFile(params) {
        window.__sourceDownloadCalls.push({ type: 'electron', params })
        return Promise.resolve({ success: true })
      }
    }
  })

  await page.goto('/#/payment-tracking/selections')
  await page.locator('.product-row-card').first().getByRole('button', { name: 'D202608270001' }).click()
  const sourceTaskDetail = page.getByRole('dialog', { name: '夏季连衣裙主图' })
  await sourceTaskDetail.locator('.task-detail-image').first().getByRole('button', { name: '下载', exact: true }).click()

  const calls = await page.evaluate(() => window.__sourceDownloadCalls)
  expect(calls.filter(call => call.type === 'electron')).toHaveLength(0)
  expect(calls.filter(call => call.type === 'browser')).toHaveLength(1)
})

test('四节点时间线只展示已进入的阶段并直接显示结束原因', async ({ page }, testInfo) => {
  await page.goto('/#/payment-tracking/selections')

  const activeCards = page.locator('.product-row-card')
  await expect(activeCards).toHaveCount(2)
  await expect(activeCards.nth(0).locator('.stage-node')).toHaveCount(1)
  await expect(activeCards.nth(0).getByRole('button', { name: 'D202608270001' })).toBeVisible()
  await activeCards.nth(0).getByRole('button', { name: 'D202608270001' }).click()
  const sourceTaskDetail = page.getByRole('dialog', { name: '夏季连衣裙主图' })
  await expect(sourceTaskDetail).toBeVisible()
  await expect(sourceTaskDetail).toHaveClass(/task-detail-overlay/)
  await expect(sourceTaskDetail.locator('.task-detail-body')).toHaveCSS('overflow-y', 'auto')
  await expect(sourceTaskDetail.locator('.task-detail-header')).toBeVisible()
  const sourceLabels = await sourceTaskDetail.locator('.task-detail-descriptions .el-descriptions__label').allTextContents()
  for (const label of ['任务编号', '状态', '分值', '数量', '执行人', '创建时间']) {
    expect(sourceLabels).toContain(label)
  }
  await expect(sourceTaskDetail.locator('.task-detail-title-row .el-tag')).toHaveText('作图中')
  await expect(sourceTaskDetail.getByText('1.2 KB', { exact: true })).toBeVisible()
  await expect(sourceTaskDetail.getByRole('heading', { name: /作品图片/ })).toBeVisible()

  await sourceTaskDetail.locator('.task-detail-image__preview img').first().click()
  const imageViewer = page.locator('.el-image-viewer__wrapper')
  const viewerImage = imageViewer.locator('.el-image-viewer__img')
  await expect(imageViewer).toBeVisible()
  await expect(viewerImage).toHaveAttribute('src', /\/api\/task\/preview\/2005/)
  await imageViewer.locator('.el-image-viewer__next').click()
  await expect(viewerImage).toHaveAttribute('src', /\/api\/task\/preview\/2001/)
  await imageViewer.locator('.el-image-viewer__mask').click({ position: { x: 5, y: 5 }, force: true })
  await expect(imageViewer).toHaveCount(0)
  await expect(activeCards.nth(1).locator('.stage-node')).toHaveCount(2)
  await expect(activeCards.nth(1)).not.toContainText('第1-6天准备工作')
  await expect(activeCards.nth(1)).not.toContainText('第12-30天打爆')

  await page.goto('/#/payment-tracking/records')
  const endedCard = page.locator('.product-row-card')
  await expect(endedCard).toHaveCount(1)
  await expect(endedCard.locator('.stage-node')).toHaveCount(2)
  await expect(endedCard).toContainText('结束于：第二阶段')
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

test('选品时间与未来节点按四阶段流程展示', async ({ page }, testInfo) => {
  await page.goto('/#/payment-tracking/records/101/stages/testing')
  await expect(page).toHaveURL(/#\/payment-tracking\/selections$/)

  await page.goto('/#/payment-tracking/records/101/stages/selection')
  await expect(page.getByRole('heading', { name: '信息及选品' })).toBeVisible()
  await expect(page.locator('.record-meta')).toContainText('毛利 60.61%')
  await expect(page.getByRole('textbox', { name: '毛利' })).toHaveCount(0)
  await expect(page.getByText('通过并设计主图')).toHaveCount(0)
  await expect(page.getByText('SKU 数是否不超过 200')).toHaveCount(0)
  const sourceSelectionDate = page.locator('.el-form-item').filter({ hasText: '选品日期' }).locator('input')
  await expect(sourceSelectionDate).toBeDisabled()
  const stageHeaderActions = page.locator('.stage-header-actions')
  await expect(stageHeaderActions.getByRole('button', { name: '保存本阶段' })).toBeVisible()
  await expect(stageHeaderActions.getByRole('button', { name: '进入下一阶段' })).toBeVisible()
  await expect(stageHeaderActions.getByRole('button', { name: '结束流程' })).toBeVisible()
  await expect(page.locator('.action-bar')).toHaveCount(0)
  await expect(page.locator('.payment-page')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  const pageInsets = await page.evaluate(() => {
    const mainRect = document.querySelector('.layout-main').getBoundingClientRect()
    const pageRect = document.querySelector('.payment-page').getBoundingClientRect()
    return {
      top: pageRect.top - mainRect.top,
      left: pageRect.left - mainRect.left,
      right: mainRect.right - pageRect.right
    }
  })
  expect(pageInsets.top).toBeLessThanOrEqual(1)
  expect(pageInsets.left).toBeLessThanOrEqual(1)
  expect(pageInsets.right).toBeLessThanOrEqual(1)
  await expectNoHorizontalPageOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('payment-selection.png'), fullPage: true })

  await page.goto('/#/payment-tracking/records/109/stages/selection')
  const manualSelectionDate = page.locator('.el-form-item').filter({ hasText: '选品日期' }).locator('input')
  await expect(manualSelectionDate).toBeEnabled()

  await page.goto('/#/payment-tracking/records/102/stages/testing')
  await expect(page.getByRole('heading', { name: '第二阶段' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '店长付费确认' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '推广信息' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '潜力款判断', exact: true })).toBeVisible()
  await expect(page.getByText('图片上传区', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('直通车测点率')).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '全站推广', exact: true })).toHaveCount(0)
  await expect(page.getByText('不符合后续操作')).toBeVisible()
  await expect(page.getByRole('button', { name: '进入下一阶段' })).toHaveCount(0)
  await expectNoHorizontalPageOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('payment-testing.png'), fullPage: true })

  await page.goto('/#/payment-tracking/records/104/stages/testing')
  await expect(page.getByRole('heading', { name: '第二阶段' })).toBeVisible()
  await expect(page.getByText('仅店长审核权限可修改')).toBeVisible()
  const paidReview = page.locator('.el-form-item').filter({ hasText: '确认开启付费' })
  await expect(paidReview.locator('.el-radio').first()).toHaveClass(/is-disabled/)
  await expect(page.getByText('付费时间', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '推广信息' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '潜力款判断', exact: true })).toHaveCount(0)
  await expect(page.getByText('图片上传区', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '进入下一阶段' })).toHaveCount(0)

  await expect(page.locator('.el-message')).toHaveCount(0, { timeout: 6_000 })
  await page.screenshot({ path: testInfo.outputPath('payment-testing-readonly-review.png'), fullPage: true })
})

test('第三阶段按链接状态分支并隔离每次数据反馈', async ({ page }, testInfo) => {
  await page.goto('/#/payment-tracking/records/105/stages/monitoring')
  await expect(page.getByRole('heading', { name: '第三阶段' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '链接优化' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '链接状态' })).toBeVisible()
  await expect(page.getByRole('heading', { name: '推广调整' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新增调整' })).toBeVisible()
  await expect(page.getByText('当前费比（7天）')).toHaveCount(0)
  await expect(page.getByText('当前付款人数（7天）')).toHaveCount(0)
  await expect(page.getByText('总预算', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '进入下一阶段' })).toHaveCount(0)

  const adjustmentItems = page.locator('.promotion-adjustments .el-collapse-item')
  await expect(adjustmentItems).toHaveCount(2)
  await adjustmentItems.nth(0).locator('.el-collapse-item__header').click()
  await adjustmentItems.nth(1).locator('.el-collapse-item__header').click()
  await expect(adjustmentItems.nth(0)).toContainText('feedback-one.png')
  await expect(adjustmentItems.nth(0)).not.toContainText('feedback-two.png')
  await expect(adjustmentItems.nth(1)).toContainText('feedback-two.png')
  await expect(adjustmentItems.nth(1)).not.toContainText('feedback-one.png')

  await page.getByRole('button', { name: '新增调整' }).click()
  await expect(page.getByText('第 3 次调整')).toBeVisible()
  const newAdjustment = adjustmentItems.nth(2)
  const stageSave = page.waitForRequest(request => (
    request.method() === 'PUT'
    && new URL(request.url()).pathname === '/api/payment-tracking/records/105/stages/monitoring'
  ))
  const imageUpload = page.waitForRequest(request => (
    request.method() === 'POST'
    && new URL(request.url()).pathname === '/api/payment-tracking/records/105/images/adjustment_feedback'
  ))
  const feedbackDropzone = newAdjustment.locator('.image-gallery-dropzone')
  await feedbackDropzone.hover()
  await pasteClipboardImage(page, { name: 'feedback-paste.png' })
  await stageSave
  const uploadRequest = await imageUpload
  expect(uploadRequest.postData()).toContain('name="adjustmentId"')
  await expect(newAdjustment).toContainText('feedback-paste.png')
  await expectNoHorizontalPageOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('payment-monitoring.png'), fullPage: true })

  await page.goto('/#/payment-tracking/records/106/stages/monitoring')
  await expect(page.getByRole('button', { name: '进入下一阶段' })).toBeVisible()
  await expect(page.getByRole('button', { name: '结束流程' })).toHaveCount(0)

  await page.goto('/#/payment-tracking/records/107/stages/summary')
  await expect(page.getByRole('heading', { name: '总结阶段' })).toBeVisible()
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

test('第三阶段链接优化为是时展示独立图片上传区', async ({ page }) => {
  await page.goto('/#/payment-tracking/records/105/stages/monitoring')

  const optimization = page.locator('.link-optimization-layout')
  await expect(optimization.getByText('图片上传区', { exact: true })).toBeVisible()
  await expect(optimization).toContainText('link-before.png')
  await expect(optimization).not.toContainText('feedback-one.png')

  const uploadRequest = page.waitForRequest(request => (
    request.method() === 'POST'
    && new URL(request.url()).pathname === '/api/payment-tracking/records/105/images/link_optimization'
  ))
  await optimization.locator('input[type="file"]').setInputFiles({
    name: 'link-after.png',
    mimeType: 'image/png',
    buffer: Buffer.from('image-data')
  })
  const request = await uploadRequest
  expect(request.postData()).not.toContain('name="adjustmentId"')
  await expect(optimization).toContainText('link-after.png')

  await page.goto('/#/payment-tracking/records/106/stages/monitoring')
  await expect(page.locator('.link-optimization-layout .image-gallery')).toHaveCount(0)
  const linkOptimization = page.locator('.el-form-item').filter({ hasText: '是否做链接优化' })
  await linkOptimization.locator('.el-radio').filter({ hasText: '是' }).click()
  await expect(page.locator('.link-optimization-layout .image-gallery')).toBeVisible()
})

test('有效第二阶段可以保存并进入第三阶段', async ({ page }) => {
  await page.goto('/#/payment-tracking/records/108/stages/testing')
  await expect(page.getByRole('heading', { name: '第二阶段' })).toBeVisible()

  const saveRequest = page.waitForRequest(request => (
    request.method() === 'PUT' && new URL(request.url()).pathname === '/api/payment-tracking/records/108/stages/testing'
  ))
  const advanceRequest = page.waitForRequest(request => (
    request.method() === 'POST' && new URL(request.url()).pathname === '/api/payment-tracking/records/108/advance'
  ))
  await page.getByRole('button', { name: '进入下一阶段' }).click()
  await page.getByRole('button', { name: '确认进入' }).click()
  await saveRequest
  await advanceRequest
  await expect(page).toHaveURL(/#\/payment-tracking\/records\/108\/stages\/monitoring$/)
})

test('第二阶段仅在确认付费后展示并保留后续内容', async ({ page }) => {
  await page.goto('/#/payment-tracking/records/108/stages/testing')

  const paidReview = page.locator('.el-form-item').filter({ hasText: '确认开启付费' })
  const paidNo = paidReview.locator('.el-radio').filter({ hasText: '否' })
  const paidYes = paidReview.locator('.el-radio').filter({ hasText: '是' })
  const imageSection = page.locator('.image-section')

  await expect(page.getByText('付费时间', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '推广信息' })).toBeVisible()
  await expect(imageSection).toContainText('testing-proof.png')
  await expect(imageSection).not.toContainText('selection-main.png')

  await paidNo.click()
  await expect(paidNo).toHaveClass(/is-checked/)
  await expect(page.getByText('付费时间', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '推广信息' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: '潜力款判断', exact: true })).toHaveCount(0)
  await expect(imageSection).toHaveCount(0)
  await expect(page.getByRole('button', { name: '进入下一阶段' })).toHaveCount(0)

  await paidYes.click()
  await expect(paidYes).toHaveClass(/is-checked/)
  await expect(page.getByText('付费时间', { exact: true })).toBeVisible()
  await expect(page.locator('.el-form-item').filter({ hasText: '推广方式' })).toContainText('直通车')
  await expect(page.locator('.image-section')).toContainText('testing-proof.png')
})

test('重开历史阶段终止分支需确认后才作废后续流程', async ({ page }) => {
  await page.goto('/#/payment-tracking/records/112/stages/testing')
  await expect(page.getByRole('heading', { name: '第二阶段' })).toBeVisible()

  let saveRequestCount = 0
  page.on('request', request => {
    if (request.method() === 'PUT'
      && new URL(request.url()).pathname === '/api/payment-tracking/records/112/stages/testing') {
      saveRequestCount += 1
    }
  })

  const paidReview = page.locator('.el-form-item').filter({ hasText: '确认开启付费' })
  await paidReview.locator('.el-radio').filter({ hasText: '否' }).click()
  await page.getByRole('button', { name: '保存本阶段' }).click()
  await expect(page.getByText(
    '该修改将作废后续阶段的内容、图片和状态，并将流程结束于当前阶段。是否继续？',
    { exact: true }
  )).toBeVisible()
  await page.getByRole('button', { name: '取消' }).click()
  await page.waitForTimeout(100)
  expect(saveRequestCount).toBe(0)

  const saveRequest = page.waitForRequest(request => (
    request.method() === 'PUT'
    && new URL(request.url()).pathname === '/api/payment-tracking/records/112/stages/testing'
  ))
  await page.getByRole('button', { name: '保存本阶段' }).click()
  await page.getByRole('button', { name: '确认并结束' }).click()
  const request = await saveRequest
  expect(request.postDataJSON()).toMatchObject({
    confirmDownstreamInvalidation: true,
    data: { paidEnabled: false }
  })
  await expect(page).toHaveURL(/#\/payment-tracking\/records$/)
})

test('保存遇到版本冲突时刷新服务器最新记录', async ({ page }) => {
  await installMocks(page, { stageSaveConflictId: 108 })
  await page.goto('/#/payment-tracking/records/108/stages/testing')

  const promotionMethod = page.locator('.el-form-item').filter({ hasText: '推广方式' })
  await expect(promotionMethod).toContainText('直通车')
  await page.getByRole('button', { name: '保存本阶段' }).click()

  await expect(page.getByText('记录已被其他人更新，请刷新后重试', { exact: true })).toBeVisible()
  await expect(promotionMethod).toContainText('关键词推广')
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
    '请选择上架日期',
    '请填写上架类目'
  ]) {
    await expect(page.getByText(message, { exact: true }).first()).toBeVisible()
  }

  await page.goto('/#/payment-tracking/records/101/stages/selection')
  await page.getByRole('button', { name: '进入下一阶段' }).click()
  await expect(page.getByText('至少上传一张产品主图', { exact: true })).toBeVisible()

  await page.goto('/#/payment-tracking/records/104/stages/testing')
  await expect(page.getByRole('button', { name: '进入下一阶段' })).toHaveCount(0)

  await page.goto('/#/payment-tracking/records/110/stages/monitoring')
  await expect(page.getByRole('button', { name: '进入下一阶段' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '结束流程' })).toHaveCount(0)
})

test('链接状态弹窗保存、清空与状态框只影响所属阶段', async ({ page }) => {
  await page.goto('/#/payment-tracking/records/105/stages/monitoring')

  const linkOptimization = page.locator('.el-form-item').filter({ hasText: '是否做链接优化' })
  const optimizedNo = linkOptimization.locator('.el-radio').filter({ hasText: '否' })
  await optimizedNo.click()
  await expect(optimizedNo).toHaveClass(/is-checked/)

  const timeline = page.locator('.stage-timeline')
  const monitoringNode = timeline.locator('.stage-column').filter({ hasText: '第三阶段' })
  await expect(monitoringNode.locator('.link-status-frame')).toHaveCount(4)
  await expect(monitoringNode.locator('.link-status-frame.active')).toHaveCount(4)
  await expect(timeline.locator('.stage-column').filter({ hasText: '第二阶段' }).locator('.link-status-row')).toHaveCount(0)

  const actions = page.locator('.action-buttons')
  const buttonNames = await actions.getByRole('button').allTextContents()
  expect(buttonNames.indexOf('链接状态')).toBeLessThan(buttonNames.indexOf('保存本阶段'))
  await actions.getByRole('button', { name: '链接状态' }).click()

  const dialog = page.getByRole('dialog', { name: '链接状态' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('是否进入极速爆单')).toBeVisible()
  await expect(dialog.getByText('新品运营是否冲顶')).toBeVisible()
  await expect(dialog.getByText('商品速爆类型')).toBeVisible()

  const clearRequest = page.waitForRequest(request => (
    request.method() === 'PUT'
    && new URL(request.url()).pathname === '/api/payment-tracking/records/105/stages/monitoring/link-status'
  ))
  await dialog.getByRole('button', { name: '清空' }).click()
  await expect(dialog.getByText('保存后生效')).toBeVisible()
  await dialog.getByRole('button', { name: '保存' }).click()
  const request = await clearRequest
  expect(request.postDataJSON()).toMatchObject({ clear: true })
  await expect(monitoringNode.locator('.link-status-row')).toHaveCount(0)
  await expect(optimizedNo).toHaveClass(/is-checked/)

  await page.goto('/#/payment-tracking/records/102/stages/testing')
  const promotionMethod = page.locator('.el-form-item').filter({ hasText: '推广方式' })
  await promotionMethod.locator('.el-select__wrapper').click()
  await page.getByRole('option', { name: '全站推广', exact: true }).click()
  await expect(promotionMethod).toContainText('全站推广')

  const testingLinkSave = page.waitForRequest(request => (
    request.method() === 'PUT'
    && new URL(request.url()).pathname === '/api/payment-tracking/records/102/stages/testing/link-status'
  ))
  await page.locator('.action-buttons').getByRole('button', { name: '链接状态' }).click()
  await page.getByRole('dialog', { name: '链接状态' }).getByRole('button', { name: '保存' }).click()
  await testingLinkSave
  await expect(promotionMethod).toContainText('全站推广')

  const testingFrames = page.locator('.stage-column').filter({ hasText: '第二阶段' }).locator('.link-status-frame')
  await expect(testingFrames).toHaveCount(4)
  await expect(page.locator('.stage-column').filter({ hasText: '第二阶段' }).locator('.link-status-frame.active')).toHaveCount(2)

  await page.goto('/#/payment-tracking/records/106/stages/monitoring')
  await expect(page.locator('.action-buttons').getByRole('button', { name: '链接状态' })).toBeDisabled()
  await expect(page.locator('.stage-column').filter({ hasText: '第二阶段' }).locator('.link-status-row')).toBeVisible()
  await expect(page.locator('.stage-column').filter({ hasText: '第三阶段' }).locator('.link-status-row')).toHaveCount(0)
})

test('四阶段页面在桌面与窄窗口保持可用布局', async ({ page }, testInfo) => {
  for (const viewport of [
    { width: 1440, height: 900, name: 'desktop' },
    { width: 820, height: 900, name: 'narrow' }
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/#/payment-tracking/records/105/stages/monitoring')
    await expect(page.getByRole('heading', { name: '第三阶段' })).toBeVisible()
    await expectNoHorizontalPageOverflow(page)

    await page.locator('.action-buttons').getByRole('button', { name: '链接状态' }).click()
    const dialog = page.getByRole('dialog', { name: '链接状态' })
    await expect(dialog).toBeVisible()
    await dialog.evaluate(async element => {
      await Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})))
    })
    await expect(dialog.locator('.dialog-scroll')).toHaveCSS('overflow-y', 'auto')
    const bounds = await dialog.locator('.el-dialog').boundingBox()
    expect(bounds.x).toBeGreaterThanOrEqual(0)
    expect(bounds.y).toBeGreaterThanOrEqual(0)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width)
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height)
    await page.screenshot({ path: testInfo.outputPath(`payment-${viewport.name}.png`), fullPage: true })
    await dialog.getByRole('button', { name: '取消' }).click()
  }
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
test('selection image galleries expose upload dropzones and delete controls', async ({ page }) => {
  await page.goto('/#/payment-tracking/records/111/stages/selection')

  await expect(page.locator('.image-gallery-dropzone')).toHaveCount(3)
  await expect(page.locator('.image-gallery').first().getByRole('button', { name: '删除图片', exact: true })).toBeVisible()
})

test('image dropzone pastes screenshots only while hovered and keeps click upload', async ({ page }) => {
  const uploads = []
  page.on('request', request => {
    if (request.method() === 'POST' && /\/api\/payment-tracking\/records\/111\/images\//.test(request.url())) {
      uploads.push(request)
    }
  })
  await page.goto('/#/payment-tracking/records/111/stages/selection')

  const detailGallery = page.locator('.image-gallery').filter({ hasText: '说明截图' })
  const dropzone = detailGallery.locator('.image-gallery-dropzone')

  const fileChooserPromise = page.waitForEvent('filechooser')
  await dropzone.click()
  await fileChooserPromise

  await page.mouse.move(0, 0)
  expect(await pasteClipboardImage(page)).toBe(false)
  expect(uploads).toHaveLength(0)

  await dropzone.hover()
  expect(await pasteClipboardImage(page)).toBe(true)

  await expect.poll(() => uploads.length).toBe(1)
  expect(new URL(uploads[0].url()).pathname).toBe('/api/payment-tracking/records/111/images/detail_screenshot')
  expect(uploads[0].postData()).toMatch(/filename="clipboard-\d+-1\.png"/)
  await expect(detailGallery).toContainText(/clipboard-\d+-1\.png/)

  expect(await pasteClipboardText(page, 'not an image')).toBe(false)
  expect(uploads).toHaveLength(1)

  await page.mouse.move(0, 0)
  expect(await pasteClipboardImage(page, { name: 'outside.png' })).toBe(false)
  expect(uploads).toHaveLength(1)
})
