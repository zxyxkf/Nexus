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

test('advanced designer dashboard shows simplified cards without efficiency rank', async ({ page }) => {
  await page.route('**/api/task/stats/dashboard', route => json(route, {
    code: 0,
    data: {
      designStats: {
        total: 6,
        wait_count: 0,
        accepted_count: 1,
        doing_count: 5,
        finished_count: 0,
        rejected_count: 2
      },
      operatorStats: {},
      csStats: {},
      designerCurrentMonthRank: [],
      designerLastMonthRank: [],
      designerRank: [{ name: '美工', finished_count: 1, rejected_count: 1 }]
    }
  }))
  await page.route('**/api/task/stats/admin/detail', route => json(route, { code: 0, data: {} }))
  await loginAs(page, users.admin)
  await page.goto('/#/dashboard')
  await expect(page.locator('.page-card').first()).toBeVisible()

  await expect(page.getByText('待审核', { exact: true })).toBeVisible()
  await expect(page.getByText('作图中', { exact: true })).toHaveCount(0)
  await expect(page.getByText('已驳回', { exact: true })).toHaveCount(0)
  await expect(page.getByText('美工完成效率排行', { exact: true })).toHaveCount(0)
})

test('design all tasks expose draggable reference and work previews', async ({ page }) => {
  await loginAs(page, users.admin)
  await page.goto('/#/admin/tasks/design')
  await expect(page.locator('.page-card')).toBeVisible()

  await expect(page.getByPlaceholder('搜索编号/标题/款号')).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '参考图' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '作品预览' })).toBeVisible()

  const row = page.locator('.el-table__body tr').filter({ hasText: 'T-ACCEPTED' })
  const previews = row.locator('[draggable="true"]')
  await expect(previews).toHaveCount(2)
  expectBrowserDragData(await dispatchDragStart(previews.first()))

  await row.locator('.el-image img').first().click()
  await expect(page.locator('.el-image-viewer__wrapper')).toBeVisible()
})

test('detail overlays preserve task detail and file affordances', async ({ page }) => {
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')
  const acceptedRow = page.locator('.el-table__body tr').filter({ hasText: 'T-ACCEPTED' })
  await acceptedRow.getByRole('button', { name: '详情' }).click()

  const overlay = page.locator('.task-detail-overlay')
  await expect(overlay).toBeVisible()
  await expect(overlay.locator('.task-detail-header')).toBeVisible()
  await expect(overlay.locator('.task-detail-body')).toHaveCSS('overflow-y', 'auto')
  await expect(overlay.getByRole('button', { name: '上传作品', exact: true })).toBeVisible()
  await expect(overlay.getByText('任务信息')).toBeVisible()
  await expect(overlay.getByRole('heading', { name: /参考图/ })).toBeVisible()
  await expect(overlay.getByRole('heading', { name: /作品图片/ })).toBeVisible()
})

const taskDetailCases = [
  { name: 'designer', path: '/designer/tasks', user: users.designer, taskNo: 'T-ACCEPTED', action: '上传作品' },
  { name: 'basic designer', path: '/basic/tasks', user: users.basic, taskNo: 'T-DOING' },
  { name: 'operator assistant', path: '/operator-assistant/tasks', user: users.assistant, taskNo: 'T-REJECTED', action: '重新上传' },
  { name: 'operator published', path: '/operator/op-tasks', user: users.operator, taskNo: 'T-OP-DRAFT', action: '编辑' },
  { name: 'shared published', path: '/operator/tasks', user: users.operator, taskNo: 'T-ACCEPTED', action: '撤回' },
  { name: 'task hall', path: '/operator-assistant/hall', user: users.assistant, taskNo: 'T-WAIT', action: '接单' },
  { name: 'admin all tasks', path: '/admin/tasks/operator', user: users.admin, taskNo: 'T-REJECTED' }
]

for (const detailCase of taskDetailCases) {
  test(`${detailCase.name} detail uses the shared overlay and preserves its action`, async ({ page }) => {
    await loginAs(page, detailCase.user)
    await page.goto(`/#${detailCase.path}`)
    const taskRow = page.locator('.el-table__body tr').filter({ hasText: detailCase.taskNo })
    await taskRow.getByRole('button', { name: '详情', exact: true }).click()

    const overlay = page.locator('.task-detail-overlay')
    await expect(overlay).toBeVisible()
    await expect(overlay.locator('.task-detail-body')).toHaveCSS('overflow-y', 'auto')
    if (detailCase.action) {
      await expect(overlay.getByRole('button', { name: detailCase.action, exact: true })).toBeVisible()
    }
    if (detailCase.name === 'basic designer') {
      await expect(overlay.getByRole('button', { name: '开启打款', exact: true })).toHaveCount(0)
    }
    await overlay.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(overlay).toHaveCount(0)
  })
}

test('review detail actions stay isolated by page and role', async ({ page }) => {
  await loginAs(page, { ...users.operator, permissions: ['*'] })
  await page.goto('/#/operator/review')
  const designRow = page.locator('.el-table__body tr').filter({ hasText: 'T-DESIGN-DOING' })
  await designRow.getByRole('button', { name: '查看作品', exact: true }).click()
  let overlay = page.locator('.task-detail-overlay')
  await expect(overlay.getByRole('button', { name: '通过', exact: true })).toBeVisible()
  await expect(overlay.getByRole('button', { name: '驳回', exact: true })).toBeVisible()
  await expect(overlay.getByRole('button', { name: '开启打款', exact: true })).toBeVisible()
  await overlay.getByRole('button', { name: '关闭', exact: true }).click()

  await loginAs(page, users.cs)
  await page.goto('/#/cs/review')
  await page.getByRole('button', { name: '查看作品', exact: true }).first().click()
  overlay = page.locator('.task-detail-overlay')
  await expect(overlay).toBeVisible()
  await expect(overlay.getByRole('button', { name: '开启打款', exact: true })).toHaveCount(0)
  await overlay.getByRole('button', { name: '关闭', exact: true }).click()

  const isolatedCases = [
    { path: '/operator/op-review', user: users.operator, entry: '查看任务', taskNo: 'T-OP-DOING', action: '通过' },
    { path: '/basic/score-review', user: users.basic, entry: '详情', action: '不通过' },
    { path: '/basic/review-records', user: users.basic, entry: '查看作品' }
  ]
  for (const reviewCase of isolatedCases) {
    await loginAs(page, reviewCase.user)
    await page.goto(`/#${reviewCase.path}`)
    const reviewScope = reviewCase.taskNo
      ? page.locator('.el-table__body tr').filter({ hasText: reviewCase.taskNo })
      : page
    await reviewScope.getByRole('button', { name: reviewCase.entry, exact: true }).first().click()
    overlay = page.locator('.task-detail-overlay')
    await expect(overlay).toBeVisible()
    if (reviewCase.action) {
      await expect(overlay.getByRole('button', { name: reviewCase.action, exact: true })).toBeVisible()
    }
    await expect(overlay.getByRole('button', { name: '开启打款', exact: true })).toHaveCount(0)
    await overlay.getByRole('button', { name: '关闭', exact: true }).click()
  }
})

test('table and detail file drag writes browser download data', async ({ page }) => {
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')

  const tableDragData = await dispatchDragStart(page.locator('.el-table [draggable="true"]').first())
  expectBrowserDragData(tableDragData)

  await page.getByRole('button', { name: '详情' }).first().click()
  const overlay = page.locator('.task-detail-overlay')
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

test('table column visibility and resized widths survive reload', async ({ page }) => {
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')

  await expect(page.locator('.el-table')).toBeVisible()
  await expect(page.locator('.el-loading-mask')).toHaveCount(0)
  const titleHeader = page.locator('.el-table__header-wrapper th').filter({ hasText: '工作项目' }).first()
  await expect(titleHeader).toBeVisible()

  const beforeWidth = await titleHeader.evaluate(el => Math.round(el.getBoundingClientRect().width))
  const box = await titleHeader.boundingBox()
  expect(box).toBeTruthy()

  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width + 80, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()

  await expect.poll(async () => {
    return page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('nexus_table_columns_v2') && key.endsWith('_widths')).length)
  }).toBeGreaterThan(0)

  const storedBeforeReload = await getColumnStorageState(page)
  expect(storedBeforeReload.widths.length).toBeGreaterThan(0)

  await page.getByRole('button', { name: '列设置' }).first().click()
  const publisherOption = page.locator('.nexus-column-panel.is-open .nexus-column-option').filter({ hasText: '发布人' }).first()
  await expect(publisherOption).toBeVisible()
  await publisherOption.locator('input[type="checkbox"]').uncheck()
  await expectColumnHidden(page, '发布人')

  await page.reload()
  await expect(page.locator('.el-table')).toBeVisible()
  await expect(page.locator('.el-loading-mask')).toHaveCount(0)
  await expectColumnHidden(page, '发布人')

  const titleHeaderAfterReload = page.locator('.el-table__header-wrapper th').filter({ hasText: '工作项目' }).first()
  await expect(titleHeaderAfterReload).toBeVisible()
  const afterWidth = await titleHeaderAfterReload.evaluate(el => Math.round(el.getBoundingClientRect().width))

  expect(afterWidth).toBeGreaterThan(beforeWidth + 30)
})

test('designer task table preferences survive leaving task pages and returning', async ({ page }) => {
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')

  const state = await setDesignerTaskPreferences(page)

  await page.goto('/#/dashboard')
  await expect(page).toHaveURL(/#\/dashboard/)
  await expect(page.locator('.card-title').filter({ hasText: '运营 & 美工设计师' }).first()).toBeVisible()
  await page.goto('/#/designer/tasks')
  await assertDesignerTaskPreferencesAfterReturn(page, state)
})

test('task table preferences survive leaving to stats, hall, notifications and dashboards', async ({ browser }) => {
  const cases = [
    {
      user: users.designer,
      taskPath: '/#/designer/tasks',
      leavePaths: ['/#/designer/stats', '/#/designer/hall', '/#/notifications', '/#/dashboard'],
      statsMarker: '个人统计',
      resizeColumn: '工作项目',
      statusOption: '作图中',
      expectedFirstTask: 'T-ACCEPTED'
    },
    {
      user: users.basic,
      taskPath: '/#/basic/tasks',
      leavePaths: ['/#/basic/stats', '/#/basic/hall', '/#/notifications', '/#/dashboard/basic-designer'],
      statsMarker: '个人统计',
      resizeColumn: '旺旺ID',
      statusOption: '作图中',
      expectedFirstTask: 'T-DOING'
    },
    {
      user: users.assistant,
      taskPath: '/#/operator-assistant/tasks',
      leavePaths: ['/#/operator-assistant/stats', '/#/operator-assistant/hall', '/#/notifications', '/#/dashboard/operator-assistant'],
      statsMarker: '个人统计',
      resizeColumn: '店铺',
      statusOption: '进行中',
      expectedFirstTask: 'T-REJECTED'
    }
  ]

  for (const item of cases) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 900 } })
    const page = await context.newPage()
    await mockApis(page)
    await loginAs(page, item.user)
    try {
      await page.goto(item.taskPath)
      await expect(page, `failed to open ${item.taskPath} for ${item.user.role}; current url=${page.url()}`).toHaveURL(new RegExp(item.taskPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace('/#/', '#/')))
      const state = await setCommonTaskPreferences(page, item)

      for (const leavePath of item.leavePaths) {
        await page.goto(leavePath)
        if (leavePath.includes('/stats')) {
          await expect(page.getByText(item.statsMarker, { exact: false }).first()).toBeVisible()
          await expect(page.locator('.el-table').first()).toBeVisible()
          await expect(page.locator('.nexus-column-button')).toHaveCount(0)
        } else if (leavePath.includes('/hall')) {
          await expect(page.locator('.card-title').filter({ hasText: '任务大厅' }).first()).toBeVisible()
          await expect(page.locator('.nexus-column-button')).toHaveCount(1)
        } else if (leavePath.includes('/notifications')) {
          await expect(page.locator('.card-title').filter({ hasText: '通知中心' }).first()).toBeVisible()
          await expect(page.locator('.nexus-column-button')).toHaveCount(0)
        } else {
          await expect(page).toHaveURL(/#\/dashboard/)
          await expect(page.locator('.nexus-column-button')).toHaveCount(0)
        }
        await page.goto(item.taskPath)
        await assertCommonTaskPreferencesAfterReturn(page, state)
      }
    } finally {
      await context.close()
    }
  }
})

test('table default clears hidden columns, resized widths and persisted sort', async ({ page }) => {
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')
  const state = await setDesignerTaskPreferences(page)

  const keysBeforeReset = await getCurrentTablePreferenceKeys(page)
  expect(keysBeforeReset.widthKey).toBeTruthy()
  expect(keysBeforeReset.sortKey).toBeTruthy()

  await page.getByRole('button', { name: '列设置' }).first().click()
  await page.locator('.nexus-column-panel.is-open .nexus-column-actions button').filter({ hasText: '默认' }).click()

  await expectColumnVisible(page, '发布人')
  await expect(page.locator('.header-right .el-select').first()).toContainText('作图中')
  await expect.poll(async () => getHeaderWidth(page, '工作项目')).toBeLessThan(state.widthBefore + 30)
  await expect.poll(async () => getStoredPreferencePresence(page, keysBeforeReset)).toEqual({
    visible: false,
    widths: false,
    sort: false
  })

  await page.goto('/#/designer/stats')
  await expect(page.locator('.el-table').first()).toBeVisible()
  await page.goto('/#/designer/tasks')
  await waitForTaskTable(page)
  await expectColumnVisible(page, '发布人')
  await expect.poll(async () => getHeaderWidth(page, '工作项目')).toBeLessThan(state.widthBefore + 30)
})

test('table default restores narrowed min-width columns', async ({ page }) => {
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')
  await waitForTaskTable(page)

  const label = '参考路径'
  const widthBefore = await getHeaderWidth(page, label)
  await resizeHeader(page, label, -70)
  const narrowedWidth = await getHeaderWidth(page, label)
  expect(narrowedWidth).toBeLessThan(widthBefore - 20)

  await page.getByRole('button', { name: '列设置' }).first().click()
  await page.locator('.nexus-column-panel.is-open .nexus-column-actions button').filter({ hasText: '默认' }).click()

  await expect.poll(async () => getHeaderWidth(page, label)).toBeGreaterThan(widthBefore - 20)
})

test('custom sortable task table keeps create time order and default clears it', async ({ page }) => {
  await loginAs(page, users.basic)
  await page.goto('/#/basic/tasks')
  const state = await setCommonTaskPreferences(page, {
    resizeColumn: '旺旺ID',
    statusOption: '作图中',
    expectedFirstTask: 'T-DOING'
  })

  await page.goto('/#/basic/stats')
  await expect(page.locator('.el-table').first()).toBeVisible()
  await expect(page.locator('.nexus-column-button')).toHaveCount(0)
  await page.goto('/#/basic/tasks')
  await assertCommonTaskPreferencesAfterReturn(page, state)
  await expect.poll(async () => getCustomSortStorageCount(page)).toBeGreaterThan(0)

  const keysBeforeReset = await getCurrentTablePreferenceKeys(page)
  await page.getByRole('button', { name: '列设置' }).first().click()
  await page.locator('.nexus-column-panel.is-open .nexus-column-actions button').filter({ hasText: '默认' }).click()

  await expectColumnVisible(page, '发布人')
  await expect.poll(async () => getHeaderWidth(page, '旺旺ID')).toBeLessThan(state.widthBefore + 30)
  await expect.poll(async () => getStoredPreferencePresence(page, keysBeforeReset)).toEqual({
    visible: false,
    widths: false,
    sort: false
  })
  await expect.poll(async () => getCustomSortStorageCount(page)).toBe(0)
})

test('create time ascending and descending survive leaving and returning', async ({ page }) => {
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')
  await waitForTaskTable(page)

  await sortByCreateTime(page, 'T-ACCEPTED')
  await expect(page.locator('.el-table__body-wrapper tbody tr').first()).toContainText('T-ACCEPTED')
  await page.goto('/#/designer/stats')
  await expect(page.locator('.el-table').first()).toBeVisible()
  await page.goto('/#/designer/tasks')
  await waitForTaskTable(page)
  await expect(page.locator('.el-table__body-wrapper tbody tr').first()).toContainText('T-ACCEPTED')

  await sortByCreateTime(page, 'T-DESIGN-DOING')
  await expect(page.locator('.el-table__body-wrapper tbody tr').first()).toContainText('T-DESIGN-DOING')
  await page.goto('/#/notifications')
  await expect(page.locator('.card-title').filter({ hasText: '通知中心' }).first()).toBeVisible()
  await page.goto('/#/designer/tasks')
  await waitForTaskTable(page)
  await expect(page.locator('.el-table__body-wrapper tbody tr').first()).toContainText('T-DESIGN-DOING')
})

async function loginAs(page, user) {
  await page.addInitScript(({ token, userInfo }) => {
    localStorage.setItem('d_design_token', token)
    localStorage.setItem('d_design_user', JSON.stringify(userInfo))
    localStorage.setItem('design_server_url', '')
    sessionStorage.setItem('d_design_login_time', 'feature-test')
  }, { token: TOKEN, userInfo: user })
}

async function loginInPage(page, user) {
  await setAuthInPage(page, user)
}

async function setAuthInPage(page, user) {
  await page.context().clearCookies()
  await page.goto('/#/login')
  await page.evaluate(({ token, userInfo }) => {
    localStorage.clear()
    sessionStorage.clear()
    localStorage.setItem('d_design_token', token)
    localStorage.setItem('d_design_user', JSON.stringify(userInfo))
    localStorage.setItem('design_server_url', '')
    sessionStorage.setItem('d_design_login_time', 'feature-test')
    window.dispatchEvent(new CustomEvent('nexus-auth-change'))
  }, { token: TOKEN, userInfo: user })
  await page.reload()
}

async function waitForTaskTable(page) {
  await expect(page.locator('.el-table')).toBeVisible()
  await expect(page.locator('.el-loading-mask')).toHaveCount(0)
}

async function setDesignerTaskPreferences(page) {
  return setCommonTaskPreferences(page, {
    resizeColumn: '工作项目',
    statusOption: '作图中',
    expectedFirstTask: 'T-ACCEPTED'
  })
}

async function setCommonTaskPreferences(page, options = {}) {
  const resizeColumn = options.resizeColumn || '工作项目'
  const statusOption = options.statusOption || '作图中'
  const expectedFirstTask = options.expectedFirstTask || 'T-ACCEPTED'
  await waitForTaskTable(page)

  const statusSelect = page.locator('.header-right .el-select').filter({ hasText: '状态筛选' }).first()
  await expect(statusSelect).toBeVisible()
  await statusSelect.click()
  await page.getByRole('option', { name: statusOption }).click()
  await expect(page.locator('.header-right .el-select').filter({ hasText: statusOption }).first()).toBeVisible()
  await waitForTaskTable(page)

  const widthBefore = await getHeaderWidth(page, resizeColumn)
  await resizeHeader(page, resizeColumn, 80)

  await page.getByRole('button', { name: '列设置' }).first().click()
  const publisherOption = page.locator('.nexus-column-panel.is-open .nexus-column-option').filter({ hasText: '发布人' }).first()
  await expect(publisherOption).toBeVisible()
  await publisherOption.locator('input[type="checkbox"]').uncheck()
  await expectColumnHidden(page, '发布人')

  const createTimeHeader = page.locator('.el-table__header-wrapper th').filter({ hasText: '发布时间' }).first()
  await createTimeHeader.click()
  await expect(page.locator('.el-table__body-wrapper tbody tr').first()).toContainText(expectedFirstTask)
  await expect.poll(async () => getCustomSortStorageCount(page)).toBeGreaterThan(0)

  return { widthBefore, resizeColumn, statusOption, expectedFirstTask }
}

async function assertDesignerTaskPreferencesAfterReturn(page, state) {
  await assertCommonTaskPreferencesAfterReturn(page, state)
}

async function assertCommonTaskPreferencesAfterReturn(page, state) {
  await expect(page.locator('.card-title').filter({ hasText: '我的任务' }).first()).toBeVisible()
  await waitForTaskTable(page)
  await expect(page.locator('.header-right .el-select').filter({ hasText: state.statusOption }).first()).toContainText(state.statusOption)
  await expectColumnHidden(page, '发布人')
  await expect.poll(async () => getHeaderWidth(page, state.resizeColumn)).toBeGreaterThan(state.widthBefore + 30)
  await expect(page.locator('.el-table__body-wrapper tbody tr').first()).toContainText(state.expectedFirstTask)
}

async function resizeHeader(page, label, delta) {
  const header = page.locator('.el-table__header-wrapper th').filter({ hasText: label }).first()
  await expect(header).toBeVisible()
  const box = await header.boundingBox()
  expect(box).toBeTruthy()
  await page.mouse.move(box.x + box.width - 4, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width + delta, box.y + box.height / 2, { steps: 8 })
  await page.mouse.up()
  if (delta >= 0) {
    await expect.poll(async () => getHeaderWidth(page, label)).toBeGreaterThan(Math.round(box.width) + Math.min(30, delta / 2))
  } else {
    await expect.poll(async () => getHeaderWidth(page, label)).toBeLessThan(Math.round(box.width) - Math.min(20, Math.abs(delta) / 2))
  }
}

async function sortByCreateTime(page, expectedFirstTaskNo) {
  const header = page.locator('.el-table__header-wrapper th').filter({ hasText: '发布时间' }).first()
  await expect(header).toBeVisible()
  for (let index = 0; index < 4; index += 1) {
    if (await page.locator('.el-table__body-wrapper tbody tr').first().textContent().then(text => text.includes(expectedFirstTaskNo)).catch(() => false)) {
      return
    }
    await header.click()
    await page.waitForTimeout(50)
  }
  throw new Error(`发布时间排序未切到首行为 ${expectedFirstTaskNo}`)
}

async function getHeaderWidth(page, label) {
  return page.locator('.el-table__header-wrapper th').filter({ hasText: label }).first()
    .evaluate(el => Math.round(el.getBoundingClientRect().width))
}

async function getCurrentTablePreferenceKeys(page) {
  return page.evaluate(() => {
    const table = document.querySelector('.el-table[data-nexus-column-settings="1"]')
    return {
      visibleKey: table?.dataset?.nexusColumnStorageKey || '',
      widthKey: table?.dataset?.nexusColumnWidthKey || '',
      sortKey: table?.dataset?.nexusColumnSortKey || ''
    }
  })
}

async function getStoredPreferencePresence(page, keys) {
  return page.evaluate(({ visibleKey, widthKey, sortKey }) => ({
    visible: visibleKey ? localStorage.getItem(visibleKey) !== null : false,
    widths: widthKey ? localStorage.getItem(widthKey) !== null : false,
    sort: sortKey ? localStorage.getItem(sortKey) !== null : false
  }), keys)
}

async function getCustomSortStorageCount(page) {
  return page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('nexus_table_custom_sort')).length)
}

async function getColumnStorageState(page) {
  return page.evaluate(() => {
    const entries = Object.entries(localStorage)
      .filter(([key]) => key.startsWith('nexus_table_columns_v2'))
      .map(([key, value]) => ({ key, value: JSON.parse(value) }))
    return {
      visible: entries.filter(entry => !entry.key.endsWith('_widths')),
      widths: entries.filter(entry => entry.key.endsWith('_widths'))
    }
  })
}

async function expectColumnHidden(page, label) {
  const header = page.locator('.el-table__header-wrapper th').filter({ hasText: label }).first()
  await expect(header).toBeAttached()
  await expect.poll(async () => header.evaluate(el => {
    const style = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    return style.display === 'none' || rect.width <= 1
  })).toBe(true)
}

async function expectColumnVisible(page, label) {
  const header = page.locator('.el-table__header-wrapper th').filter({ hasText: label }).first()
  await expect(header).toBeAttached()
  await expect.poll(async () => header.evaluate(el => {
    const style = getComputedStyle(el)
    const rect = el.getBoundingClientRect()
    return style.display !== 'none' && rect.width > 20
  })).toBe(true)
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
    if (path === '/api/notification/list') return json(route, listPayload([
      { id: 1, title: '任务提醒', content: '测试通知', priority: 2, type: 'task_update', is_read: 0, create_time: '2026-06-01 09:00:00' }
    ]))
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
    if (path === '/api/task/stats/my') return json(route, { code: 0, data: statsPayload() })

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

function statsPayload() {
  const monthly = [
    { month: '2026-01', score: 10, finished: 1, total: 2, rate: 50 },
    { month: '2026-02', score: 20, finished: 2, total: 3, rate: 67 }
  ]
  const groupedMonthly = [{
    name: '测试人员',
    months: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      published: index + 1,
      finished: index,
      unsubmitted: 1
    }))
  }]
  return {
    total_score: 30,
    pending_review_score: 5,
    total: 3,
    finished_count: 2,
    unfinished_count: 1,
    wait_count: 1,
    rejected_count: 1,
    current_month_score: 20,
    today_score: 3,
    yesterday_score: 2,
    completion_rate: 67,
    monthly_stats: monthly,
    design_stats: { total: 3, finished_count: 2, wait_count: 1, rejected_count: 1 },
    operator_stats: { total: 3, finished_count: 2, wait_count: 1, rejected_count: 1 },
    design_monthly: groupedMonthly,
    operator_monthly: groupedMonthly,
    self_monthly: [
      { month: '2026-01', total: 2, finished: 1, unfinished: 1, wait: 0 },
      { month: '2026-02', total: 3, finished: 2, unfinished: 1, wait: 1 }
    ],
    cs_monthly: groupedMonthly
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
