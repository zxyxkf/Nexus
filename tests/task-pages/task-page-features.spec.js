import { test, expect } from '@playwright/test'

const TOKEN = 'task-page-feature-token'

const users = {
  admin: {
    id: 1,
    username: 'admin',
    realName: '管理员',
    role: 'admin',
    permissions: ['*']
  },
  designer: {
    id: 2,
    username: 'designer',
    realName: '设计师A',
    role: 'designer'
  },
  basic: {
    id: 3,
    username: 'basic',
    realName: '基础美工A',
    role: 'basic_designer'
  },
  assistant: {
    id: 4,
    username: 'assistant',
    realName: '运营助理A',
    role: 'operator_assistant'
  },
  operator: {
    id: 5,
    username: 'operator',
    realName: '运营A',
    role: 'operator'
  },
  cs: {
    id: 6,
    username: 'cs',
    realName: '客服A',
    role: 'cs_agent',
    permissions: ['cs.tasks.basic', 'cs.review.basic', 'cs.task_no.update', 'notification.center']
  }
}

const files = [
  { id: 101, file_name: 'reference.png', file_type: 'image', file_category: 'reference', file_size: 1200 },
  { id: 102, file_name: 'brief.pdf', file_type: 'file', file_category: 'reference', file_size: 2048 },
  { id: 103, file_name: 'work.png', file_type: 'image', file_category: 'work', file_size: 4096 },
  { id: 104, file_name: 'work.zip', file_type: 'file', file_category: 'work', file_size: 8192 }
]

const taskRows = [
  {
    id: 201,
    task_no: 'T-ACCEPTED',
    title: '主图精修',
    score_item_name: '主图精修',
    score_item_id: 1,
    score: 10,
    quantity: 2,
    actual_quantity: 1,
    status: 'accepted',
    task_group: 'design',
    publisher_id: 5,
    publisher_name: '运营A',
    designer_id: 2,
    designer_name: '设计师A',
    style_number: 'SN-001',
    specified_color: '红色',
    ref_path: '/design/ref',
    work_path: '/design/work',
    wangwang_id: 'ww-001',
    shop_name: '旗舰店',
    task_file_path: '/operator/file',
    description: '任务说明',
    deadline: '2026-06-30',
    create_time: '2026-06-01 10:00:00',
    files
  },
  {
    id: 202,
    task_no: 'T-DOING',
    title: '详情页制作',
    score_item_name: '详情页制作',
    score_item_id: 2,
    score: 20,
    quantity: 1,
    actual_quantity: 1,
    status: 'doing',
    task_group: 'cs',
    publisher_id: 6,
    publisher_name: '客服A',
    designer_id: 3,
    designer_name: '基础美工A',
    style_number: 'SN-002',
    wangwang_id: 'ww-002',
    shop_name: '客服店',
    task_file_path: '/cs/file',
    applied_score: 8,
    score_status: 'pending',
    create_time: '2026-06-02 11:00:00',
    submit_time: '2026-06-02 12:00:00',
    files
  },
  {
    id: 203,
    task_no: 'T-REJECTED',
    title: '驳回重做',
    score_item_name: '驳回重做',
    score_item_id: 3,
    score: 15,
    quantity: 1,
    actual_quantity: 0,
    status: 'rejected',
    task_group: 'operator',
    publisher_id: 5,
    publisher_name: '运营A',
    designer_id: 4,
    designer_name: '运营助理A',
    style_number: 'SN-003',
    shop_name: '运营店',
    task_file_path: '/operator/reject',
    reject_reason: '需要调整颜色',
    create_time: '2026-06-03 09:00:00',
    files
  },
  {
    id: 204,
    task_no: 'T-DRAFT',
    title: '草稿任务',
    score_item_name: '草稿任务',
    score_item_id: 4,
    score: 12,
    quantity: 1,
    actual_quantity: 0,
    status: 'draft',
    task_group: 'design',
    publisher_id: 5,
    publisher_name: '运营A',
    designer_id: null,
    designer_name: '',
    style_number: 'SN-004',
    create_time: '2026-06-04 09:00:00',
    files
  },
  {
    id: 206,
    task_no: 'T-DESIGN-DOING',
    title: '设计待审核',
    score_item_name: '设计待审核',
    score_item_id: 2,
    score: 18,
    quantity: 1,
    actual_quantity: 1,
    status: 'doing',
    task_group: 'design',
    publisher_id: 5,
    publisher_name: '运营A',
    designer_id: 2,
    designer_name: '设计师A',
    style_number: 'SN-006',
    specified_color: '蓝色',
    ref_path: '/design/doing',
    work_path: '/design/doing-work',
    create_time: '2026-06-04 12:00:00',
    files
  },
  {
    id: 205,
    task_no: 'T-WAIT',
    title: '大厅待接单',
    score_item_name: '大厅待接单',
    score_item_id: 5,
    score: 9,
    quantity: 1,
    actual_quantity: 0,
    status: 'wait',
    task_group: 'operator',
    publisher_id: 5,
    publisher_name: '运营A',
    designer_id: null,
    designer_name: '',
    style_number: 'SN-005',
    shop_name: '大厅店',
    task_file_path: '/hall/file',
    create_time: '2026-06-05 09:00:00',
    files
  },
  {
    id: 207,
    task_no: 'T-OP-DOING',
    title: '运营待审核',
    score_item_name: '运营待审核',
    score_item_id: 2,
    score: 16,
    quantity: 2,
    actual_quantity: 1,
    status: 'doing',
    task_group: 'operator',
    publisher_id: 5,
    publisher_name: '运营A',
    designer_id: 4,
    designer_name: '运营助理A',
    shop_name: '运营店',
    task_file_path: '/operator/doing',
    create_time: '2026-06-05 11:00:00',
    files
  },
  {
    id: 208,
    task_no: 'T-OP-DRAFT',
    title: '运营草稿',
    score_item_name: '运营草稿',
    score_item_id: 1,
    score: 6,
    quantity: 1,
    actual_quantity: 0,
    status: 'draft',
    task_group: 'operator',
    publisher_id: 5,
    publisher_name: '运营A',
    designer_id: null,
    designer_name: '',
    shop_name: '运营店',
    task_file_path: '/operator/draft',
    create_time: '2026-06-05 12:00:00',
    files
  },
  {
    id: 209,
    task_no: 'T-OP-ACCEPTED',
    title: '运营已接单',
    score_item_name: '运营已接单',
    score_item_id: 2,
    score: 11,
    quantity: 1,
    actual_quantity: 0,
    status: 'accepted',
    task_group: 'operator',
    publisher_id: 5,
    publisher_name: '运营A',
    designer_id: 4,
    designer_name: '运营助理A',
    shop_name: '运营店',
    task_file_path: '/operator/accepted',
    create_time: '2026-06-05 13:00:00',
    files
  }
]

const scoreRows = [
  {
    ...taskRows[1],
    task_no: 'S-PENDING',
    status: 'pending',
    score_status: 'pending',
    applied_score: 8,
    approved_score: null,
    final_score: null
  },
  {
    ...taskRows[1],
    id: 302,
    task_no: 'S-APPROVED',
    status: 'approved',
    score_status: 'approved',
    applied_score: 8,
    approved_score: 8,
    final_score: 8,
    reject_reason: ''
  },
  {
    ...taskRows[1],
    id: 303,
    task_no: 'S-REJECTED',
    status: 'rejected',
    score_status: 'rejected',
    applied_score: 8,
    approved_score: null,
    final_score: 0,
    reject_reason: '分数不符'
  }
]

const people = {
  publishers: [
    { id: 5, username: 'operator', real_name: '运营A' },
    { id: 6, username: 'cs', real_name: '客服A' }
  ],
  designers: [
    { id: 2, username: 'designer', real_name: '设计师A', is_online: 1 }
  ],
  basicDesigners: [
    { id: 3, username: 'basic', real_name: '基础美工A', is_online: 1 }
  ],
  assistants: [
    { id: 4, username: 'assistant', real_name: '运营助理A', is_online: 1 }
  ],
  scoreItems: [
    { id: 1, name: '主图精修', score: 10 },
    { id: 2, name: '详情页制作', score: 20 }
  ]
}

const pageCases = [
  {
    name: 'designer my tasks',
    path: '/designer/tasks',
    user: users.designer,
    expected: ['我的任务', '搜索款号', '工作项目筛选', '编号', '上传路径', '上传作品', '撤回', '主图精修']
  },
  {
    name: 'basic my tasks',
    path: '/basic/tasks',
    user: users.basic,
    expected: ['我的任务', '搜索旺旺ID/款号', '发布人筛选', '旺旺ID', '作品预览', '转移', 'T-DOING']
  },
  {
    name: 'operator assistant my tasks',
    path: '/operator-assistant/tasks',
    user: users.assistant,
    expected: ['我的任务', '店铺筛选', '任务编号', '文件地址', '完成凭证', '完成次数', '上传', '撤回']
  },
  {
    name: 'operator published operator tasks',
    path: '/operator/op-tasks',
    user: users.operator,
    expected: ['我的运营任务', '筛选助理', '筛选发布人', '运营助理', '完成凭证', '编辑', '催促', '撤回']
  },
  {
    name: 'shared published tasks',
    path: '/operator/tasks',
    user: users.operator,
    expected: ['我的任务', '搜索款号', '筛选美工', '筛选发布人', '指定颜色', '作品预览', '编辑', '催促']
  },
  {
    name: 'shared review',
    path: '/operator/review',
    user: users.operator,
    expected: ['作品审核', '批量审核通过', '任务编号', '作品预览', '查看作品', '通过', '驳回']
  },
  {
    name: 'task hall',
    path: '/operator-assistant/hall',
    user: users.assistant,
    expected: ['任务大厅', '搜索任务标题/编号', '店铺', '文件地址', '参考图', '接单']
  },
  {
    name: 'admin all tasks',
    path: '/admin/tasks/operator',
    user: users.admin,
    expected: ['运营助理全量任务管理', '搜索编号/标题', '导出当前筛选', '下载文件(0)', '批量删除(0)', '任务编号', '详情']
  },
  {
    name: 'basic score review',
    path: '/basic/score-review',
    user: users.basic,
    expected: ['分值审核', '筛选发布人', '筛选基础美工', '申请分值', '通过', '不通过', 'S-PENDING']
  },
  {
    name: 'basic review records',
    path: '/basic/review-records',
    user: users.basic,
    expected: ['审核记录', '审核状态', '审核通过分数', '最终分值', '驳回原因', '分数审核时间', 'S-APPROVED']
  },
  {
    name: 'operator review',
    path: '/operator/op-review',
    user: users.operator,
    expected: ['任务审核', '批量审核通过', '运营助理', '完成凭证', '查看任务', '通过', '驳回']
  }
]

test.beforeEach(async ({ page }) => {
  await mockApis(page)
})

for (const pageCase of pageCases) {
  test(`${pageCase.name} keeps current visible feature contract`, async ({ page }) => {
    await loginAs(page, pageCase.user)
    await page.goto(`/#${pageCase.path}`)
    await expect(page.locator('.page-card')).toBeVisible()

    for (const text of pageCase.expected) {
      await expectFeature(page, text)
    }
  })
}

test('detail overlays preserve task detail and file affordances', async ({ page }) => {
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')
  await page.getByRole('button', { name: '详情' }).first().click()

  const overlay = page.locator('.inline-detail-overlay')
  await expect(overlay).toBeVisible()
  await expect(overlay.getByText('任务信息')).toBeVisible()
  await expect(overlay.getByRole('heading', { name: /参考图/ })).toBeVisible()
  await expect(overlay.getByRole('heading', { name: /作品图片/ })).toBeVisible()
})

test('table and detail file drag writes browser download data', async ({ page }) => {
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')

  const tableDragData = await dispatchDragStart(page.locator('.el-table [draggable="true"]').first())
  expectBrowserDragData(tableDragData)

  await page.getByRole('button', { name: '详情' }).first().click()
  const overlay = page.locator('.inline-detail-overlay')
  await expect(overlay).toBeVisible()

  const detailDragData = await dispatchDragStart(overlay.locator('[draggable="true"]').first())
  expectBrowserDragData(detailDragData)
})

test('visible table image is primed as a draggable file target on mouse down', async ({ page }) => {
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')

  const state = await primeVisibleImageDrag(page.locator('.el-table .el-image img').first())
  expect(state.draggable).toBe(true)
  expect(state.webkitUserDrag).toBe('element')

  const dragData = await dispatchDragStart(page.locator('.el-table .el-image img').first())
  expectBrowserDragData(dragData)
})

test('inline work upload preview supports table and fullscreen drag-out', async ({ page }) => {
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')

  const tablePreview = page.locator('.inline-work-upload__preview').first()
  const tableDragData = await dispatchDragStart(tablePreview)
  expectBrowserDragData(tableDragData)

  await tablePreview.dblclick()
  const viewerImage = page.locator('.inline-work-preview__image').first()
  await expect(viewerImage).toBeVisible()

  const viewerDragData = await dispatchDragStart(viewerImage)
  expectBrowserDragData(viewerDragData)
})

test('cached Electron file drag calls native drag and keeps browser fallback', async ({ page }) => {
  await mockElectronDrag(page, { cached: true })
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')

  const dragData = await dispatchDragStart(page.locator('.el-table [draggable="true"]').first())
  expectBrowserDragData(dragData)

  const calls = await page.evaluate(() => window.__dragCalls)
  expect(calls.some(call => call.type === 'isFileCached')).toBe(true)
  expect(calls.some(call => call.type === 'doFileDrag')).toBe(true)
})

test('uncached Electron file drag preloads cache and keeps browser fallback', async ({ page }) => {
  await mockElectronDrag(page, { cached: false })
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')

  const dragData = await dispatchDragStart(page.locator('.el-table [draggable="true"]').first())
  expectBrowserDragData(dragData)

  const calls = await page.evaluate(() => window.__dragCalls)
  const prepareCall = calls.find(call => call.type === 'prepareFileDrags')
  expect(calls.some(call => call.type === 'doFileDrag')).toBe(false)
  expect(prepareCall).toBeTruthy()
  expect(prepareCall.params.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ fileId: 101, fileName: 'reference.png' })
  ]))
})

test('preview image drag reuses shared drag bridge and preloads Electron cache', async ({ page }) => {
  await mockElectronDrag(page, { cached: false })
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')

  await page.locator('.el-table .el-image img').first().click()
  const previewImage = page.locator('.el-image-viewer__wrapper img').first()
  await expect(previewImage).toBeVisible()

  const dragData = await previewImage.evaluate(img => {
    img.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))

    const dataTransfer = new DataTransfer()
    const event = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      dataTransfer
    })
    img.dispatchEvent(event)

    return {
      draggable: img.draggable,
      downloadUrl: dataTransfer.getData('DownloadURL'),
      uriList: dataTransfer.getData('text/uri-list'),
      plain: dataTransfer.getData('text/plain'),
      html: dataTransfer.getData('text/html'),
      effectAllowed: dataTransfer.effectAllowed
    }
  })

  expect(dragData.draggable).toBe(true)
  expectBrowserDragData(dragData)

  const calls = await page.evaluate(() => window.__dragCalls)
  const prepareCalls = calls.filter(call => call.type === 'prepareFileDrags')
  expect(prepareCalls.length).toBeGreaterThan(0)
  expect(prepareCalls.some(call => call.params.items.some(item => item.fileId === 101))).toBe(true)
})

async function loginAs(page, user) {
  await page.addInitScript(({ token, userInfo }) => {
    localStorage.setItem('d_design_token', token)
    localStorage.setItem('d_design_user', JSON.stringify(userInfo))
    localStorage.setItem('design_server_url', '')
    sessionStorage.setItem('d_design_login_time', 'feature-test')
  }, { token: TOKEN, userInfo: user })
}

async function mockElectronDrag(page, { cached }) {
  await page.addInitScript(({ cachedValue }) => {
    window.__dragCalls = []
    window.electronAPI = {
      isFileCached(fileId) {
        window.__dragCalls.push({ type: 'isFileCached', fileId })
        return cachedValue
      },
      doFileDrag(fileId) {
        window.__dragCalls.push({ type: 'doFileDrag', fileId })
        return true
      },
      prepareFileDrags(params) {
        window.__dragCalls.push({ type: 'prepareFileDrags', params })
        return Promise.resolve({ success: true })
      }
    }
  }, { cachedValue: cached })
}

async function mockApis(page) {
  await page.route('**/socket.io/**', route => route.abort())
  await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,ico}', route => {
    if (route.request().url().includes('/api/task/preview/')) {
      route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#eef2ff"/></svg>'
      })
      return
    }
    route.continue()
  })
  await page.route(/^https?:\/\/[^/]+\/api\//, async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    if (path === '/api/health') return json(route, { code: 0, data: { status: 'ok' } })
    if (path === '/api/announcement/active') return json(route, { code: 0, data: null })
    if (path === '/api/notification/unread-count') return json(route, { code: 0, data: { count: 0 } })
    if (path === '/api/notification/list') return json(route, listPayload([]))
    if (path === '/api/config/list') return json(route, {
      code: 0,
      data: [
        { config_key: 'upload.max_file_count', config_value: '10' },
        { config_key: 'upload.max_file_size_mb', config_value: '50' }
      ]
    })

    if (path === '/api/user/publishers' || path === '/api/user/task-publishers') return json(route, { code: 0, data: people.publishers })
    if (path === '/api/user/designers' || path === '/api/user/task-designers') return json(route, { code: 0, data: people.designers })
    if (path === '/api/user/basic-designers') return json(route, { code: 0, data: people.basicDesigners })
    if (path === '/api/user/operator-assistants') return json(route, { code: 0, data: people.assistants })
    if (path === '/api/score/items') return json(route, { code: 0, data: people.scoreItems })

    if (path === '/api/task/my-accepted') return json(route, listPayload(filterByTaskGroup(url.searchParams.get('taskGroup'))))
    if (path === '/api/task/my-published') return json(route, listPayload(filterByTaskGroup(url.searchParams.get('taskGroup'))))
    if (path === '/api/task/hall') return json(route, listPayload(filterByTaskGroup(url.searchParams.get('taskGroup')).filter(row => row.status === 'wait')))
    if (path === '/api/task/all') return json(route, listPayload(filterByTaskGroup(url.searchParams.get('taskGroup'))))
    if (path === '/api/task/detail') {
      const taskId = Number(url.searchParams.get('taskId'))
      const task = [...taskRows, ...scoreRows].find(row => row.id === taskId) || taskRows[0]
      return json(route, { code: 0, data: { ...task, files, reject_records: [] } })
    }
    if (path.startsWith('/api/task/preview/')) {
      return route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#eef2ff"/></svg>'
      })
    }
    if (path.startsWith('/api/task/download/')) {
      return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: 'file' })
    }

    if (path === '/api/score/review/list') return json(route, listPayload([scoreRows[0]]))
    if (path === '/api/score/review/records') return json(route, listPayload(scoreRows.slice(1)))

    if (request.method() !== 'GET') return json(route, { code: 0, msg: 'ok', data: {} })
    return json(route, listPayload([]))
  })
}

async function dispatchDragStart(locator) {
  await expect(locator).toBeVisible()
  return locator.evaluate(el => {
    const dataTransfer = new DataTransfer()
    const event = new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      dataTransfer
    })
    el.dispatchEvent(event)

    return {
      downloadUrl: dataTransfer.getData('DownloadURL'),
      uriList: dataTransfer.getData('text/uri-list'),
      plain: dataTransfer.getData('text/plain'),
      html: dataTransfer.getData('text/html'),
      effectAllowed: dataTransfer.effectAllowed
    }
  })
}

async function primeVisibleImageDrag(locator) {
  await expect(locator).toBeVisible()
  await locator.scrollIntoViewIfNeeded()
  return locator.evaluate(img => {
    img.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 }))
    return {
      draggable: img.draggable,
      webkitUserDrag: img.style.webkitUserDrag
    }
  })
}

function expectBrowserDragData(data) {
  expect(data.downloadUrl).toContain('application/octet-stream:')
  expect(data.downloadUrl).toContain('/api/task/download/')
  expect(data.downloadUrl).toContain(`token=${encodeURIComponent(TOKEN)}`)
  expect(data.uriList).toContain('/api/task/download/')
  expect(data.uriList).toContain(`token=${encodeURIComponent(TOKEN)}`)
  expect(data.plain).toBe(data.uriList)
  expect(data.html).toContain(data.uriList)
}

function filterByTaskGroup(taskGroup) {
  if (!taskGroup) return taskRows
  return taskRows.filter(row => row.task_group === taskGroup)
}

function listPayload(rows) {
  return {
    code: 0,
    data: {
      list: rows,
      total: rows.length
    }
  }
}

function json(route, body) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body)
  })
}

async function expectFeature(page, text) {
  const locators = [
    page.getByText(text, { exact: false }),
    page.getByPlaceholder(text, { exact: false })
  ]

  for (const locator of locators) {
    const count = await locator.count()
    for (let index = 0; index < count; index += 1) {
      const candidate = locator.nth(index)
      if (await candidate.isVisible().catch(() => false)) {
        await expect(candidate).toBeVisible()
        return
      }
    }
  }

  throw new Error(`Feature marker not visible: ${text}`)
}
