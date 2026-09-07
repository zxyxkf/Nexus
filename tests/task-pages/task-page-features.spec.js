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
    permissions: [
      'cs.publish.basic', 'cs.tasks.basic', 'cs.review.basic', 'cs.task_no.update',
      'cs.handoff.tasks', 'cs.handoff.claim', 'cs.shift.toggle', 'notification.center'
    ],
    csShiftStatus: 'online'
  }
}

const files = [
  { id: 101, file_name: 'reference.png', file_type: 'image', file_category: 'reference', file_size: 1200, task_no: 'T-DOING' },
  { id: 102, file_name: 'brief.pdf', file_type: 'file', file_category: 'reference', file_size: 2048, task_no: 'T-DOING' },
  { id: 103, file_name: 'work.png', file_type: 'image', file_category: 'work', file_size: 4096, task_no: 'T-DOING' },
  { id: 104, file_name: 'work.zip', file_type: 'file', file_category: 'work', file_size: 8192, task_no: 'T-DOING' },
  { id: 105, file_name: 'rejected-version.zip', file_type: 'file', file_category: 'reject', file_size: 16384, task_no: 'T-DOING' },
  { id: 106, file_name: 'style-a.png', file_type: 'image', file_category: 'style', file_size: 2048, task_no: 'T-DOING' },
  { id: 107, file_name: 'style-b.png', file_type: 'image', file_category: 'style', file_size: 3072, task_no: 'T-DOING' }
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
    allowedActions: { review: true, openPayment: false },
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
    transfer_records: [
      {
        id: 501,
        from_designer_name: '基础美工甲',
        to_designer_name: '基础美工A',
        transfer_reason: '工作调整',
        operator_name: '客服A',
        create_time: '2026-06-02 11:30:00'
      }
    ],
    reject_records: [
      {
        id: 601,
        reject_index: 1,
        reject_reason: '细节需要调整',
        designer_reply: '已经按说明调整',
        designer_complete_time: '2026-06-02 11:55:00',
        designer_name: '基础美工A',
        applied_score: 8,
        reviewer_name: '客服A',
        create_time: '2026-06-02 11:40:00',
        files: [
          { id: 6011, file_name: '修改说明.png', file_type: 'image', file_category: 'reject', file_size: 1024 },
          { id: 6012, file_name: '重新上传.png', file_type: 'image', file_category: 'work', file_size: 2048 }
        ]
      }
    ],
    files: [
      ...files,
      { id: 6012, file_name: '重新上传.png', file_type: 'image', file_category: 'work', file_size: 2048, reject_record_id: 601, reject_index: 1 }
    ]
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
    allowedActions: { review: true, openPayment: true },
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
    allowedActions: { review: true, openPayment: false },
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
  },
  {
    id: 210,
    task_no: 'T-CS-REJECTED',
    title: '客服修改中任务',
    score_item_name: '客服修改中任务',
    score: 1,
    actual_quantity: 1,
    status: 'rejected',
    task_group: 'cs',
    publisher_id: 6,
    publisher_name: '客服A',
    designer_id: 3,
    designer_name: '基础美工A',
    style_number: 'SN-010',
    wangwang_id: 'ww-010',
    applied_score: 2.5,
    reject_reason: '请修改文字位置',
    create_time: '2026-06-06 09:00:00',
    reject_records: [
      {
        id: 602,
        reject_index: 2,
        reject_reason: '请修改文字位置',
        designer_reply: '已调整文字位置',
        designer_complete_time: null,
        designer_name: '基础美工A',
        applied_score: 2.5,
        reviewer_name: '客服A',
        create_time: '2026-06-06 09:10:00',
        files: [
          { id: 6021, file_name: '撤回前修改稿.png', file_type: 'image', file_category: 'work', file_size: 2048, reject_record_id: 602 }
        ]
      }
    ],
    files: [
      ...files,
      { id: 6021, file_name: '撤回前修改稿.png', file_type: 'image', file_category: 'work', file_size: 2048, reject_record_id: 602, reject_index: 2 }
    ]
  },
  {
    id: 211,
    task_no: 'T-CS-WAIT',
    title: '客服大厅任务',
    score_item_name: '客服大厅任务',
    score: 1,
    status: 'wait',
    task_group: 'cs',
    publisher_id: 6,
    publisher_name: '客服A',
    designer_id: null,
    designer_name: '',
    style_number: 'SN-011',
    wangwang_id: 'ww-011',
    create_time: '2026-06-06 10:00:00',
    files
  },
  {
    id: 212,
    task_no: 'T-CS-ACCEPTED',
    title: '客服首次作品已撤回',
    score_item_name: '客服首次作品已撤回',
    score: 1,
    status: 'accepted',
    task_group: 'cs',
    publisher_id: 6,
    publisher_name: '客服A',
    designer_id: 3,
    designer_name: '基础美工A',
    style_number: 'SN-012',
    wangwang_id: 'ww-012',
    applied_score: 2.5,
    create_time: '2026-06-06 11:00:00',
    files: [
      ...files.filter(file => file.file_category !== 'work'),
      { id: 2121, file_name: '撤回后保留的首次作品.png', file_type: 'image', file_category: 'work', file_size: 4096 }
    ]
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
    expected: ['我的任务', '搜索旺旺ID/款号', '发布人筛选', '旺旺ID', '效果图', '转移', 'T-DOING']
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
    expected: ['作品审核', '批量审核通过', '任务编号', '效果图', '查看作品', '通过', '驳回']
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

test('basic todo date filter clears and reloads the unfiltered list', async ({ page }) => {
  const dateCalls = []
  const filteredTask = {
    ...taskRows[1],
    id: 902,
    task_no: 'T-DATE-FILTERED',
    task_group: 'cs',
    status: 'accepted',
    designer_id: users.basic.id
  }
  const unfilteredTasks = [
    filteredTask,
    {
      ...filteredTask,
      id: 903,
      task_no: 'T-DATE-RESTORED'
    }
  ]

  await page.route('**/api/task/my-accepted**', route => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('taskGroup') !== 'cs') return route.fallback()
    const date = url.searchParams.get('dateStart') || ''
    dateCalls.push(date)
    return json(route, listPayload(date ? [filteredTask] : unfilteredTasks))
  })

  await loginAs(page, { ...users.basic, permissions: ['basic.tasks.cs'] })
  await page.goto('/#/basic/tasks/todo')
  await waitForTaskTable(page)

  const statusSelect = page.locator('.header-right .el-select').last()
  await statusSelect.click()
  const statusDropdown = page.locator('.el-select-dropdown:visible')
  await expect(statusDropdown.getByRole('option', { name: '已接单', exact: true })).toBeVisible()
  await expect(statusDropdown.getByRole('option', { name: '待上传原图', exact: true })).toBeVisible()
  await expect(statusDropdown.getByRole('option', { name: '修改中', exact: true })).toBeVisible()
  await expect(statusDropdown.getByRole('option', { name: '审核中', exact: true })).toHaveCount(0)
  await expect(statusDropdown.getByRole('option', { name: '已完成', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')

  const dateInput = page.locator('.header-right .el-date-editor input').first()
  await dateInput.fill('2026-06-02')
  await dateInput.press('Enter')
  await expect(page.locator('.el-table__body-wrapper')).toContainText('T-DATE-FILTERED')
  await expect(page.locator('.el-table__body-wrapper')).not.toContainText('T-DATE-RESTORED')

  const callsBeforeClear = dateCalls.length
  await page.locator('.header-right .el-date-editor .el-input__suffix-inner .el-icon').last().click()
  await page.waitForTimeout(250)
  expect(dateCalls.length).toBeGreaterThan(callsBeforeClear)
  expect(dateCalls.at(-1)).toBe('')
  await expect(page.locator('.el-table__body-wrapper')).toContainText('T-DATE-RESTORED')
})

test('basic task routes keep status filters isolated and discard unsupported values', async ({ page }) => {
  const requestedStatuses = []
  await page.route('**/api/task/my-accepted**', route => {
    const url = new URL(route.request().url())
    if (url.searchParams.get('taskGroup') !== 'cs') return route.fallback()
    requestedStatuses.push(url.searchParams.get('status') || '')
    return json(route, listPayload(taskRows.filter(task => task.task_group === 'cs')))
  })

  await loginAs(page, { ...users.basic, permissions: ['basic.tasks.cs'] })
  await page.goto('/#/basic/tasks')
  await waitForTaskTable(page)

  await page.locator('.header-right .el-select').last().click()
  await page.getByRole('option', { name: '已完成', exact: true }).click()
  await expect.poll(() => requestedStatuses.at(-1)).toBe('finished')

  await page.goto('/#/basic/tasks/todo')
  await waitForTaskTable(page)
  await expect.poll(() => requestedStatuses.at(-1)).toBe('accepted,rejected,pending_original')
  const todoStatus = page.locator('.header-right .el-select').last()
  await todoStatus.click()
  await page.getByRole('option', { name: '修改中', exact: true }).click()
  await expect.poll(() => requestedStatuses.at(-1)).toBe('rejected')

  await page.goto('/#/basic/tasks/pending')
  await waitForTaskTable(page)
  await expect.poll(() => requestedStatuses.at(-1)).toBe('doing')

  await page.goto('/#/basic/tasks/todo')
  await waitForTaskTable(page)
  await expect(page.locator('.header-right .el-select').last()).toContainText('修改中')
  await expect.poll(() => requestedStatuses.at(-1)).toBe('rejected')
})

test('customer service can toggle shift status and open the shared handoff page', async ({ page }) => {
  await loginAs(page, users.cs)
  await page.goto('/#/cs/publish')

  await expect(page.getByRole('button', { name: '批量提交', exact: true })).toHaveCount(0)
  const handoffMenuItem = page.locator('.layout-aside').getByText('暂存任务', { exact: true })
  await expect(handoffMenuItem).toBeVisible()
  const shiftButton = page.getByRole('button', { name: '已上线' })
  await expect(shiftButton).toBeVisible()
  await shiftButton.click()
  await expect(page.getByRole('button', { name: '已下线' })).toBeVisible()

  await handoffMenuItem.click()
  await expect(page.getByRole('heading', { name: '暂存任务' })).toBeVisible()
  await expect(page.getByText('继承', { exact: true })).toBeVisible()
})

test('image processing removes solid backgrounds with soft edges and supports recoloring', async ({ page }) => {
  await page.goto('/#/login')
  const result = await page.evaluate(async () => {
    const processing = await import('/src/utils/background-removal.js')
    const width = 5
    const height = 5
    const pixels = new Uint8ClampedArray(width * height * 4)
    for (let index = 0; index < width * height; index += 1) {
      pixels.set([255, 255, 255, 255], index * 4)
    }
    pixels.set([0, 0, 0, 255], (2 * width + 2) * 4)
    pixels.set([225, 225, 225, 255], (2 * width + 1) * 4)
    const source = new ImageData(pixels, width, height)
    const background = processing.estimateEdgeBackground(source)
    const removed = processing.removeBackground(source, { tolerance: 28, edgeCleanup: 55 })
    const solid = processing.recolorSolid(
      new ImageData(new Uint8ClampedArray([20, 30, 40, 180]), 1, 1),
      '#ff0000'
    )
    const matching = processing.recolorMatching(
      new ImageData(new Uint8ClampedArray([200, 20, 20, 255, 20, 180, 20, 255]), 2, 1),
      [200, 20, 20],
      '#3366ff',
      35
    )
    return {
      background,
      cornerAlpha: removed.data[3],
      enclosedWhiteAlpha: removed.data[(1 * width + 1) * 4 + 3],
      softAlpha: removed.data[(2 * width + 1) * 4 + 3],
      subjectAlpha: removed.data[(2 * width + 2) * 4 + 3],
      originalCornerAlpha: source.data[3],
      solid: Array.from(solid.data),
      matching: Array.from(matching.data),
      sampled: processing.samplePixel(matching, 0, 0)
    }
  })

  expect(result.background).toEqual({ r: 255, g: 255, b: 255 })
  expect(result.cornerAlpha).toBe(0)
  expect(result.enclosedWhiteAlpha).toBe(0)
  expect(result.softAlpha).toBeGreaterThan(0)
  expect(result.softAlpha).toBeLessThan(255)
  expect(result.subjectAlpha).toBe(255)
  expect(result.originalCornerAlpha).toBe(255)
  expect(result.solid).toEqual([255, 0, 0, 180])
  expect(result.matching.slice(0, 4)).toEqual([51, 102, 255, 255])
  expect(result.matching.slice(4)).toEqual([20, 180, 20, 255])
  expect(result.sampled).toEqual({ r: 51, g: 102, b: 255, a: 255 })
})

test('style image editor supports canvas panning without changing saved scene', async ({ page }) => {
  await loginAs(page, users.cs)
  await page.goto('/#/cs/publish')

  const stylePicker = page.getByRole('combobox', { name: '款号', exact: true })
  await stylePicker.fill('D-3')
  await page.getByRole('option', { name: '围裙 / D-3围裙', exact: true }).click()
  await page.locator('.cs-material-image').click()
  await page.locator('.cs-selected-image').dblclick()

  const dialog = page.getByRole('dialog', { name: '编辑款式图' })
  await expect(dialog).toBeVisible()
  const interactiveCanvas = dialog.locator('canvas.upper-canvas')
  const renderedCanvas = dialog.locator('canvas.lower-canvas')
  await expect(interactiveCanvas).toBeVisible()
  const viewportBox = await dialog.locator('.style-editor-viewport').boundingBox()
  const canvasBox = await interactiveCanvas.boundingBox()
  expect(canvasBox.width).toBeGreaterThan(viewportBox.width * 0.5)
  expect(canvasBox.height).toBeGreaterThan(viewportBox.height * 0.5)

  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP4z8DwH4QZGBgYGMAAAAD//wMAFJQEBqSx8ZkAAAAASUVORK5CYII=', 'base64')
  })
  await expect(dialog.getByText('边缘净化', { exact: true })).toBeVisible()
  await expect(dialog.getByText('整体单色', { exact: true })).toBeVisible()
  await expect(dialog.getByText('指定颜色', { exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: '吸管取色', exact: true })).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: '应用换色', exact: true })).toBeVisible()

  await dialog.getByText('选择形状', { exact: true }).click()
  await page.getByRole('option', { name: '矩形', exact: true }).click()
  await dialog.getByRole('button', { name: '添加', exact: true }).click()

  const panButton = dialog.getByRole('button', { name: '移动画布', exact: true })
  await panButton.click()
  await expect(panButton).toHaveAttribute('aria-pressed', 'true')
  const savedSceneBaseline = await renderedCanvas.evaluate(element => element.toDataURL())
  await interactiveCanvas.dispatchEvent('wheel', { deltaY: -700 })
  await expect(dialog.locator('.style-editor-status').getByText(/%/)).not.toHaveText('100%')
  const viewport = dialog.locator('.style-editor-viewport')
  const beforePan = await viewport.evaluate(element => ({
    x: Number(element.dataset.viewportX),
    y: Number(element.dataset.viewportY)
  }))

  const box = await interactiveCanvas.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(interactiveCanvas).toHaveCSS('cursor', 'grabbing')
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 60, { steps: 4 })
  await page.mouse.up()
  await expect.poll(() => viewport.evaluate(element => Number(element.dataset.viewportX))).toBeCloseTo(beforePan.x + 90, 0)
  await expect.poll(() => viewport.evaluate(element => Number(element.dataset.viewportY))).toBeCloseTo(beforePan.y + 60, 0)

  await dialog.getByRole('button', { name: '保存成品', exact: true }).click()
  await expect(dialog).toBeHidden()
  await page.locator('.cs-selected-image').dblclick()
  await expect(dialog).toBeVisible()
  await expect(panButton).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => renderedCanvas.evaluate(element => element.toDataURL())).toBe(savedSceneBaseline)
})

test('batch work submit groups files by task for a basic designer', async ({ page }) => {
  await loginAs(page, users.basic)
  await page.goto('/#/basic/tasks')
  const trigger = page.getByRole('button', { name: '批量提交', exact: true })
  await expect(trigger).toBeVisible()
  await trigger.click()

  await page.locator('.batch-work-submit input[type="file"]').setInputFiles([
    { name: 'C202609030001_主图.png', mimeType: 'image/png', buffer: Buffer.from('image-a') },
    { name: 'C202609030002_详情.png', mimeType: 'image/png', buffer: Buffer.from('image-b') }
  ])

  await expect(page.getByText('C202609030001', { exact: true })).toBeVisible()
  await expect(page.getByText('C202609030002', { exact: true })).toBeVisible()
  const scoreInputs = page.locator('.batch-score-field input')
  await expect(scoreInputs).toHaveCount(2)
  await expect.poll(async () => scoreInputs.evaluateAll(inputs => inputs.map(input => Number(input.value)))).toEqual([1, 2.5])
  await expect(page.getByText('首次提交', { exact: true })).toBeVisible()
  await expect(page.getByText('第 2 次修改', { exact: true })).toBeVisible()
})

test('batch submission keeps edited score and opens matched task details', async ({ page }) => {
  await loginAs(page, users.basic)
  await page.goto('/#/basic/tasks')
  await page.getByRole('button', { name: '批量提交', exact: true }).click()

  const uploadInput = page.locator('.batch-work-submit input[type="file"]')
  await uploadInput.setInputFiles([
    { name: 'C202609030001_主图.png', mimeType: 'image/png', buffer: Buffer.from('image-a') }
  ])

  const panel = page.locator('.batch-work-submit')
  await expect(panel.getByText('发布人：客服甲', { exact: true })).toBeVisible()
  const taskButton = panel.getByRole('button', { name: 'C202609030001', exact: true })
  await taskButton.click()
  const overlay = page.locator('.task-detail-overlay')
  await expect(overlay).toBeVisible()
  await expect(overlay.getByText('客服A', { exact: true })).toBeVisible()
  await overlay.getByRole('button', { name: '关闭', exact: true }).click()
  await expect(panel).toBeVisible()

  const scoreInput = panel.locator('.batch-score-field input')
  await expect(scoreInput).toHaveAttribute('aria-valuemin', '1')
  await scoreInput.fill('2.5')
  await scoreInput.press('Enter')
  await uploadInput.setInputFiles([
    { name: 'C202609030001_详情.png', mimeType: 'image/png', buffer: Buffer.from('image-b') }
  ])
  await expect.poll(() => scoreInput.inputValue()).toBe('2.5')
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

test('project type completion period switch stays inside its dashboard card', async ({ page }) => {
  const monthlyCounts = Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: index + 1 }))
  await page.route('**/api/task/stats/admin/detail', route => json(route, {
    code: 0,
    data: {
      designerStats: [{
        id: 1,
        name: '美工A',
        monthly_stats: [],
        project_stats: [{
          project_name: '主图',
          count: 7,
          current_month_count: 2,
          last_month_count: 1,
          monthly_counts: monthlyCounts
        }]
      }],
      designerDailyStats: [],
      operatorStats: [],
      operatorAssistantStats: [],
      operatorAssistantDailyStats: [],
      operatorPublishStats: [],
      basicDesignerStats: [],
      basicDesignerDailyStats: [],
      csAgentStats: [],
      scoreItems: ['主图']
    }
  }))
  await loginAs(page, users.admin)
  await page.goto('/#/dashboard')

  const projectCard = page.locator('.chart-card').filter({ hasText: '项目类型完成统计' })
  await expect(projectCard).toBeVisible()
  await expect(projectCard.locator('.el-card__header').getByText('全部', { exact: true })).toBeVisible()
  const projectRow = projectCard.locator('.el-table__body tr').filter({ hasText: '美工A' })
  await expect(projectRow.getByText('7', { exact: true })).toBeVisible()

  await projectCard.getByText('当月', { exact: true }).click()
  await expect(projectRow.getByText('2', { exact: true })).toBeVisible()

  await projectCard.getByText('上月', { exact: true }).click()
  await expect(projectRow.getByText('1', { exact: true })).toBeVisible()
})

test('designer monthly project type table shows 12 months and stays role-specific', async ({ page, browser }) => {
  const projectStats = [{
    project_name: '主图',
    count: 12,
    current_month_count: 9,
    last_month_count: 8,
    monthly_counts: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: index + 1 }))
  }]
  await page.route('**/api/task/stats/my', route => json(route, {
    code: 0,
    data: { ...statsPayload(), project_stats: projectStats }
  }))
  await loginAs(page, users.designer)
  await page.goto('/#/designer/stats')

  await expect(page.getByText('月度项目类型完成统计', { exact: false })).toBeVisible()
  const projectTable = page.locator('.el-table').filter({ hasText: '工作项目类型' })
  await expect(projectTable.getByRole('columnheader', { name: '1月', exact: true })).toBeVisible()
  await expect(projectTable.getByRole('columnheader', { name: '12月', exact: true })).toBeVisible()
  const projectRow = projectTable.locator('.el-table__body tr').filter({ hasText: '主图' })
  await expect(projectRow.locator('td').nth(1)).toHaveText('1')
  await expect(projectRow.locator('td').nth(12)).toHaveText('12')

  const basicContext = await browser.newContext({ viewport: { width: 1600, height: 900 } })
  const basicPage = await basicContext.newPage()
  await mockApis(basicPage)
  await loginAs(basicPage, users.basic)
  await basicPage.goto('/#/basic/stats')
  await expect(basicPage.getByText('月度项目类型完成统计', { exact: false })).toHaveCount(0)
  await basicContext.close()
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
  await expect(overlay.locator('.task-detail-information-panel')).toBeVisible()
  await expect(overlay.locator('.task-detail-description-row')).toBeVisible()
  await expect(overlay.getByRole('heading', { name: /参考图/ })).toBeVisible()
  await expect(overlay.getByRole('heading', { name: /作品图片/ })).toBeVisible()
})

const taskDetailCases = [
  {
    name: 'designer', path: '/designer/tasks', user: users.designer, taskNo: 'T-ACCEPTED', action: '上传作品',
    labels: ['工作项目', '款号', '指定颜色', '参考路径', '截止时间', '上传路径'],
    forbiddenLabels: ['分值', '任务数量', '申请分数', '完成次数'],
    showsRejectCategoryFile: true
  },
  {
    name: 'basic designer', path: '/basic/tasks', user: users.basic, taskNo: 'T-DOING',
    labels: ['旺旺ID', '款号', '申请分数', '分数审核状态', '分数审核通过分数'],
    forbiddenLabels: ['工作项目', '分值', '任务数量', '完成次数', '上传路径']
  },
  {
    name: 'operator assistant', path: '/operator-assistant/tasks', user: users.assistant, taskNo: 'T-REJECTED', action: '重新上传',
    labels: ['店铺', '任务数量', '工作项目', '分值', '任务文件地址', '完成次数'],
    forbiddenLabels: ['款号', '指定颜色', '申请分数', '上传路径']
  },
  {
    name: 'operator published', path: '/operator/op-tasks', user: users.operator, taskNo: 'T-OP-DRAFT', action: '编辑',
    labels: ['店铺', '任务数量', '工作项目', '分值', '任务文件地址', '完成次数', '上传路径'],
    forbiddenLabels: ['款号', '指定颜色', '申请分数']
  },
  {
    name: 'shared published', path: '/operator/tasks', user: users.operator, taskNo: 'T-ACCEPTED', action: '撤回',
    labels: ['工作项目', '分值', '款号', '指定颜色', '参考路径', '截止时间', '上传路径'],
    forbiddenLabels: ['任务数量', '完成次数', '申请分数']
  },
  {
    name: 'task hall', path: '/operator-assistant/hall', user: users.assistant, taskNo: 'T-WAIT', action: '接单',
    labels: ['工作项目', '分值', '店铺', '任务数量', '任务文件地址', '任务标题'],
    forbiddenLabels: ['完成次数', '上传路径', '款号', '申请分数'],
    showsRejectCategoryFile: true
  },
  {
    name: 'admin all tasks', path: '/admin/tasks/operator', user: users.admin, taskNo: 'T-REJECTED',
    labels: ['工作项目', '分值', '任务数量', '任务文件地址', '完成次数', '上传路径'],
    forbiddenLabels: ['店铺', '款号', '指定颜色', '申请分数']
  }
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
    await expect(overlay.locator('.task-detail-information-panel')).toBeVisible()
    await expect(overlay.locator('.task-detail-descriptions')).toBeVisible()
    await expect(overlay.locator('.inline-detail-section')).toHaveCount(0)
    const labelTexts = await overlay.locator('.task-detail-descriptions .el-descriptions__label').allTextContents()
    const descriptionLabels = detailCase.labels.filter((_, index) => {
      if (detailCase.name === 'designer') return ![3, 4, 5].includes(index)
      if (detailCase.name === 'shared published') return ![4, 5, 6].includes(index)
      return true
    })
    for (const label of descriptionLabels) expect(labelTexts).toContain(label)
    for (const label of detailCase.forbiddenLabels) expect(labelTexts).not.toContain(label)
    if (detailCase.name === 'designer') {
      expect(labelTexts).not.toContain(detailCase.labels[4])
      await expect(overlay.locator('.task-detail-path-row')).toHaveCount(2)
    }
    if (detailCase.name === 'shared published') {
      expect(labelTexts).not.toContain(detailCase.labels[5])
      await expect(overlay.locator('.task-detail-path-row')).toHaveCount(2)
    }
    await expect(overlay.getByText('rejected-version.zip', { exact: true }))
      .toHaveCount(detailCase.showsRejectCategoryFile ? 1 : 0)
    if (detailCase.action) {
      await expect(overlay.getByRole('button', { name: detailCase.action, exact: true })).toBeVisible()
    }
    if (detailCase.name === 'basic designer') {
      await expect(overlay.getByRole('button', { name: '开启打款', exact: true })).toHaveCount(0)
    }
    if (detailCase.name === 'operator assistant') {
      await expect(overlay.locator('.task-detail-image').getByRole('button', { name: '下载', exact: true })).toHaveCount(0)
      await expect(overlay.locator('.task-detail-attachment').getByRole('button', { name: '下载', exact: true })).toHaveCount(2)
    }
    if (detailCase.name === 'task hall') {
      await expect(overlay.locator('.task-detail-summary')).not.toContainText('款号')
      await expect(overlay.locator('.task-status-panel')).toHaveCount(0)
      await expect(overlay.locator('.transfer-panel')).toHaveCount(0)
      await expect(overlay.locator('.reject-history')).toHaveCount(0)
      await expect(overlay.locator('.task-detail-image')).toHaveCount(1)
      await expect(overlay.locator('.task-detail-attachment')).toHaveCount(4)
    }
    await overlay.getByRole('button', { name: '关闭', exact: true }).click()
    await expect(overlay).toHaveCount(0)
  })
}

test('design review detail matches the unified source-task information layout', async ({ page }, testInfo) => {
  await loginAs(page, { ...users.operator, permissions: ['*'] })
  await page.goto('/#/operator/review')
  const designRow = page.locator('.el-table__body tr').filter({ hasText: 'T-DESIGN-DOING' })
  await designRow.getByRole('button', { name: '查看作品', exact: true }).click()

  const overlay = page.locator('.task-detail-overlay')
  await expect(overlay.locator('.task-detail-title-row')).toBeVisible()
  await expect(overlay.locator('.task-detail-summary')).toContainText('设计师A')
  await expect(overlay.locator('.task-detail-summary')).toContainText('上传提交时间 2026-06-04 12:00:00')
  await expect(overlay.locator('.task-detail-summary')).not.toContainText('T-DESIGN-DOING')
  await expect(overlay.locator('.task-detail-summary')).not.toContainText('SN-006')
  await expect(overlay.locator('.task-detail-information-panel')).toBeVisible()
  await expect(overlay.locator('.task-detail-descriptions')).toBeVisible()
  await expect(overlay.locator('.task-detail-description-row')).toBeVisible()
  await expect(overlay.locator('.task-detail-media-grid')).toHaveCSS('display', 'grid')
  await expect(overlay.locator('.task-detail-media-section')).toHaveCount(2)
  await expect(overlay.locator('.inline-detail-section')).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('unified-design-review-detail.png'), fullPage: true })
})

test('task detail fields stay isolated by task group', async ({ page }, testInfo) => {
  await loginAs(page, { ...users.operator, permissions: ['*'] })
  await page.goto('/#/operator/review')
  const designRow = page.locator('.el-table__body tr').filter({ hasText: 'T-DESIGN-DOING' })
  await designRow.getByRole('button', { name: '查看作品', exact: true }).click()

  const overlay = page.locator('.task-detail-overlay')
  const labelTexts = await overlay.locator('.task-detail-descriptions .el-descriptions__label').allTextContents()
  for (const label of ['工作项目', '分值', '款号', '指定颜色']) expect(labelTexts).toContain(label)
  expect(labelTexts).not.toContain('截止时间')
  await expect(overlay.locator('.task-detail-path-row')).toHaveCount(2)
  await expect(overlay.getByText('/design/doing', { exact: true })).toBeVisible()
  await expect(overlay.getByText('/design/doing-work', { exact: true })).toBeVisible()
  await overlay.getByRole('button', { name: '关闭', exact: true }).click()
})

test('review detail actions stay isolated by page and role', async ({ page }) => {
  await loginAs(page, { ...users.operator, permissions: ['*'] })
  await page.goto('/#/operator/review')
  const designRow = page.locator('.el-table__body tr').filter({ hasText: 'T-DESIGN-DOING' })
  await designRow.getByRole('button', { name: '查看作品', exact: true }).click()
  let overlay = page.locator('.task-detail-overlay')
  await expect(overlay.locator('.task-detail-information-panel')).toBeVisible()
  await expect(overlay.getByText('申请分值', { exact: true })).toHaveCount(0)
  await expect(overlay.getByText('分值审核状态', { exact: true })).toHaveCount(0)
  await expect(overlay.getByRole('button', { name: '通过', exact: true })).toBeVisible()
  await expect(overlay.getByRole('button', { name: '驳回', exact: true })).toBeVisible()
  await expect(overlay.getByRole('button', { name: '开启打款', exact: true })).toBeVisible()
  await overlay.getByRole('button', { name: '关闭', exact: true }).click()

  await loginAs(page, users.cs)
  await page.goto('/#/cs/review')
  await page.getByRole('button', { name: '查看作品', exact: true }).first().click()
  overlay = page.locator('.task-detail-overlay')
  await expect(overlay).toBeVisible()
  await expect(overlay.locator('.task-detail-information-panel')).toBeVisible()
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
    await expect(overlay.locator('.task-detail-information-panel')).toBeVisible()
    await expect(overlay.locator('.inline-detail-section')).toHaveCount(0)
    if (reviewCase.action) {
      await expect(overlay.getByRole('button', { name: reviewCase.action, exact: true })).toBeVisible()
    }
    if (reviewCase.path === '/basic/score-review') {
      await expect(overlay.getByText('申请分值', { exact: true })).toBeVisible()
    }
    await expect(overlay.getByRole('button', { name: '开启打款', exact: true })).toHaveCount(0)
    await overlay.getByRole('button', { name: '关闭', exact: true }).click()
  }
})

test('customer service review uses modification history instead of rejection', async ({ page }) => {
  await loginAs(page, users.cs)
  await page.goto('/#/cs/review')

  const row = page.locator('.el-table__body tr').filter({ hasText: 'T-DOING' })
  await expect(row.getByRole('button', { name: '新增修改', exact: true })).toHaveCount(0)
  await expect(row.getByRole('button', { name: '驳回', exact: true })).toHaveCount(0)

  await row.getByRole('button', { name: '查看作品', exact: true }).click()
  const overlay = page.locator('.task-detail-overlay')
  await expect(overlay.getByText('修改历史', { exact: true })).toBeVisible()
  await expect(overlay.getByText('第 1 次修改', { exact: true })).toBeVisible()
  await overlay.getByText('第 1 次修改', { exact: true }).click()
  await expect(overlay.getByText('客服修改要求', { exact: true }).first()).toBeVisible()
  await expect(overlay.getByText('基础美工处理结果', { exact: true }).first()).toBeVisible()
  await expect(overlay.getByText('已经按说明调整', { exact: true })).toBeVisible()
  await expect(overlay.getByText('驳回历史', { exact: true })).toHaveCount(0)
  await overlay.getByRole('button', { name: '新增修改', exact: true }).click()
  await expect(overlay.getByText('第 2 次修改', { exact: true })).toBeVisible()
  await expect(overlay.getByPlaceholder('填写本次修改要求')).toBeVisible()
  await overlay.getByRole('button', { name: '完成', exact: true }).click()
  await expect(page.getByText('请填写修改说明或上传附件', { exact: true })).toBeVisible()
  await overlay.getByPlaceholder('填写本次修改要求').fill('请调整最新版本的文字位置')
  await overlay.getByRole('button', { name: '完成', exact: true }).click()
  await expect(page.getByText('已新增修改', { exact: true })).toBeVisible()
  await expect(overlay).toBeHidden()
})

test('basic designer handles a modification inline and keeps withdrawn content and score', async ({ page }) => {
  await loginAs(page, users.basic)
  await page.goto('/#/basic/tasks')

  const row = page.locator('.el-table__body tr').filter({ hasText: 'T-CS-REJECTED' })
  await expect(row.getByText('修改中', { exact: true })).toBeVisible()
  await row.getByRole('button', { name: '处理修改', exact: true }).click()
  const overlay = page.locator('.task-detail-overlay')
  await expect(overlay.getByText('第 2 次修改', { exact: true })).toBeVisible()
  await expect(overlay.getByPlaceholder('填写本次处理结果')).toHaveValue('已调整文字位置')
  await expect(overlay.getByText('撤回前修改稿.png', { exact: true })).toBeVisible()
  await expect(overlay.locator('.modification-score-field input')).toHaveValue('2.5')
  await expect(page.getByRole('dialog', { name: '重新上传作品' })).toHaveCount(0)
})

test('withdrawn first submission keeps its existing work and score in the upload dialog', async ({ page }) => {
  await loginAs(page, users.basic)
  await page.goto('/#/basic/tasks')

  const row = page.locator('.el-table__body tr').filter({ hasText: 'T-CS-ACCEPTED' })
  await row.getByRole('button', { name: '上传', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '上传作品' })
  await expect(dialog.getByText('撤回后保留的首次作品.png', { exact: true })).toBeVisible()
  await expect(dialog.locator('.el-input-number input')).toHaveValue('2.5')
})

test('customer service work preview prefers the newest modification image', async ({ page }) => {
  await loginAs(page, users.cs)
  await page.goto('/#/cs/review')

  const row = page.locator('.el-table__body tr').filter({ hasText: 'T-DOING' })
  await expect(row.locator('[draggable="true"] .el-image img').last()).toHaveAttribute('src', /\/api\/task\/preview\/6012(?:\?|$)/)
})

test('customer service and basic designer task lists show style images without changing designer columns', async ({ page, browser }) => {
  await loginAs(page, users.cs)
  await page.goto('/#/cs/handoff-tasks')
  await expect(page.getByRole('columnheader', { name: '款式图', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: '工作项目', exact: true })).toHaveCount(0)
  const handoffRow = page.locator('.el-table__body tr').filter({ hasText: 'T-DOING' })
  await expect(handoffRow.getByText('2张', { exact: true })).toBeVisible()
  expectBrowserDragData(await dispatchDragStart(handoffRow.locator('.style-thumb-cell')))
  await handoffRow.getByRole('button', { name: '查看', exact: true }).click()
  const overlay = page.locator('.task-detail-overlay')
  await expect(overlay.getByText('暂存', { exact: true })).toBeVisible()
  await overlay.getByRole('button', { name: '关闭', exact: true }).click()

  const basicPage = await browser.newPage()
  await mockApis(basicPage)
  await loginAs(basicPage, users.basic)
  for (const path of ['/basic/hall', '/basic/tasks', '/basic/tasks/todo', '/basic/tasks/pending']) {
    await basicPage.goto(`/#${path}`)
    await expect(basicPage.getByRole('columnheader', { name: '款式图', exact: true })).toBeVisible()
    await expect(basicPage.getByRole('columnheader', { name: '指定颜色', exact: true })).toHaveCount(0)
    await expect(basicPage.locator('.style-thumb-cell').first()).toContainText('2张')
  }
  await basicPage.close()

  const designerPage = await browser.newPage()
  await mockApis(designerPage)
  await loginAs(designerPage, users.designer)
  await designerPage.goto('/#/designer/hall')
  await expect(designerPage.getByRole('columnheader', { name: '指定颜色', exact: true })).toBeVisible()
  await expect(designerPage.getByRole('columnheader', { name: '款式图', exact: true })).toHaveCount(0)
  await designerPage.close()
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

test('cached Electron file drag calls native drag without browser fallback', async ({ page }) => {
  await mockElectronDrag(page, { cached: true })
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')

  const dragData = await dispatchDragStart(page.locator('.el-table [draggable="true"]').first())
  expect(dragData.downloadUrl).toBe('')
  expect(dragData.uriList).toBe('')
  expect(dragData.plain).toBe('')
  expect(dragData.html).toBe('')

  const calls = await page.evaluate(() => window.__dragCalls)
  expect(calls.some(call => call.type === 'isFileCached')).toBe(true)
  expect(calls.some(call => call.type === 'doFileDrag')).toBe(true)
  expect(calls.find(call => call.type === 'isFileCached').fileId).toEqual(expect.objectContaining({
    fileId: 101,
    fileName: 'reference.png',
    downloadPath: '/api/task/download/101',
    token: TOKEN
  }))
  expect(calls.find(call => call.type === 'doFileDrag').fileId).toEqual(expect.objectContaining({
    fileId: 101,
    fileName: 'reference.png',
    downloadPath: '/api/task/download/101',
    token: TOKEN
  }))
})

test('uncached Electron file drag preloads cache without browser fallback', async ({ page }) => {
  await mockElectronDrag(page, { cached: false })
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')

  const dragData = await dispatchDragStart(page.locator('.el-table [draggable="true"]').first())
  expect(dragData.downloadUrl).toBe('')
  expect(dragData.uriList).toBe('')
  expect(dragData.plain).toBe('')
  expect(dragData.html).toBe('')

  const calls = await page.evaluate(() => window.__dragCalls)
  const prepareCall = calls.find(call => call.type === 'prepareFileDrags')
  expect(calls.some(call => call.type === 'doFileDrag')).toBe(false)
  expect(prepareCall).toBeTruthy()
  expect(prepareCall.params.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ fileId: 101, fileName: 'reference.png' })
  ]))
  expect(calls
    .filter(call => call.type === 'prepareFileDrags')
    .some(call => call.params.items.some(item => item.fileId === 101 && item.priority === 'high'))
  ).toBe(true)
})

test('pending Electron preload is promoted only once when dragging starts', async ({ page }) => {
  await mockElectronDrag(page, { cached: false, deferPrepare: true })
  await loginAs(page, users.designer)
  await page.goto('/#/designer/tasks')

  await expect.poll(async () => page.evaluate(() => window.__dragCalls
    .filter(call => call.type === 'prepareFileDrags')
    .flatMap(call => call.params.items)
    .filter(item => item.fileId === 101 && item.priority === 'normal').length
  )).toBe(1)

  const dragTarget = page.locator('.el-table [draggable="true"]').first()
  await dispatchDragStart(dragTarget)
  await dispatchDragStart(dragTarget)

  const priorities = await page.evaluate(() => window.__dragCalls
    .filter(call => call.type === 'prepareFileDrags')
    .flatMap(call => call.params.items)
    .filter(item => item.fileId === 101)
    .map(item => item.priority)
  )
  expect(priorities).toEqual(['normal', 'high'])

  await page.evaluate(() => window.__resolveDragPrepares.splice(0).forEach(resolve => resolve()))
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
  expect(dragData.downloadUrl).toBe('')
  expect(dragData.uriList).toBe('')
  expect(dragData.plain).toBe('')
  expect(dragData.html).toBe('')

  const calls = await page.evaluate(() => window.__dragCalls)
  const prepareCalls = calls.filter(call => call.type === 'prepareFileDrags')
  expect(prepareCalls.length).toBeGreaterThan(0)
  expect(prepareCalls.some(call => call.params.items.some(item => item.fileId === 101))).toBe(true)
})

test('客服 Electron drag uses the task number while other roles keep original names', async ({ page }) => {
  await mockElectronDrag(page, { cached: false })
  await loginAs(page, users.cs)
  await page.goto('/#/cs/tasks')

  const dragData = await dispatchDragStart(page.locator('.el-table [draggable="true"]').first())
  expect(dragData.downloadUrl).toBe('')
  expect(dragData.uriList).toBe('')

  const calls = await page.evaluate(() => window.__dragCalls)
  const preparedItems = calls
    .filter(call => call.type === 'prepareFileDrags')
    .flatMap(call => call.params.items)
  expect(preparedItems).toEqual(expect.arrayContaining([
    expect.objectContaining({ fileId: 101, fileName: expect.stringMatching(/^T-DOING(?:_\d+)?\.png$/) }),
    expect.objectContaining({ fileId: 103, fileName: expect.stringMatching(/^T-DOING(?:_\d+)?\.png$/) })
  ]))
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
      statusOption: '待审核',
      expectedFirstTask: 'T-ACCEPTED'
    },
    {
      user: users.basic,
      taskPath: '/#/basic/tasks',
      leavePaths: ['/#/basic/stats', '/#/basic/hall', '/#/notifications', '/#/dashboard/basic-designer'],
      statsMarker: '个人统计',
      resizeColumn: '旺旺ID',
      statusOption: '审核中',
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
  await expect(page.locator('.header-right .el-select').first()).toContainText('待审核')
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
    statusOption: '审核中',
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

async function waitForTaskTable(page) {
  await expect(page.locator('.el-table')).toBeVisible()
  await expect(page.locator('.el-loading-mask')).toHaveCount(0)
}

async function setDesignerTaskPreferences(page) {
  return setCommonTaskPreferences(page, {
    resizeColumn: '工作项目',
    statusOption: '待审核',
    expectedFirstTask: 'T-ACCEPTED'
  })
}

async function setCommonTaskPreferences(page, options = {}) {
  const resizeColumn = options.resizeColumn || '工作项目'
  const statusOption = options.statusOption || '待审核'
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

async function mockElectronDrag(page, { cached, deferPrepare = false }) {
  await page.addInitScript(({ cachedValue, shouldDeferPrepare }) => {
    window.__dragCalls = []
    window.__resolveDragPrepares = []
    window.electronAPI = {
      isFileCached(fileId) {
        window.__dragCalls.push({ type: 'isFileCached', fileId })
        return cachedValue
      },
      doFileDrag(request) {
        window.__dragCalls.push({ type: 'doFileDrag', fileId: request })
        return true
      },
      prepareFileDrags(params) {
        window.__dragCalls.push({ type: 'prepareFileDrags', params })
        if (shouldDeferPrepare) {
          return new Promise(resolve => {
            window.__resolveDragPrepares.push(() => resolve({ success: true }))
          })
        }
        return Promise.resolve({ success: true })
      }
    }
  }, { cachedValue: cached, shouldDeferPrepare: deferPrepare })
}

async function mockApis(page) {
  let csShiftStatus = 'online'
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
    if (path === '/api/material-library/search') return json(route, {
      code: 0,
      data: { styles: [{ id: 701, name: 'D-3围裙', product_name: '围裙' }] }
    })
    if (path === '/api/material-library/styles/701/images') return json(route, {
      code: 0,
      data: {
        style: { id: 701, name: 'D-3围裙', product_name: '围裙' },
        colors: [],
        images: [{
          id: 801,
          display_name: 'D-3正面.png',
          original_name: 'D-3正面.png',
          mime_type: 'image/png',
          previewUrl: '/api/material-library/images/801/preview'
        }]
      }
    })
    if (path === '/api/material-library/images/801/preview') {
      return route.fulfill({
        status: 200,
        contentType: 'image/svg+xml',
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#f4f6f8"/><rect width="200" height="150" fill="#4f46e5"/><rect x="200" y="150" width="200" height="150" fill="#ef4444"/></svg>'
      })
    }

    if (path === '/api/user/publishers' || path === '/api/user/task-publishers') return json(route, { code: 0, data: people.publishers })
    if (path === '/api/user/designers' || path === '/api/user/task-designers') return json(route, { code: 0, data: people.designers })
    if (path === '/api/user/basic-designers') return json(route, { code: 0, data: people.basicDesigners })
    if (path === '/api/user/operator-assistants') return json(route, { code: 0, data: people.assistants })
    if (path === '/api/score/items') return json(route, { code: 0, data: people.scoreItems })
    if (path === '/api/task/stats/my') return json(route, { code: 0, data: statsPayload() })
    if (path === '/api/task/cs-shift/status') {
      if (request.method() === 'POST') {
        csShiftStatus = request.postDataJSON()?.status || csShiftStatus
        return json(route, { code: 0, data: { status: csShiftStatus, movedTaskCount: csShiftStatus === 'offline' ? 1 : 0 } })
      }
      return json(route, { code: 0, data: { status: csShiftStatus } })
    }
    if (path === '/api/task/cs-handoff') {
      return json(route, listPayload([{
        ...taskRows.find(row => row.task_group === 'cs'),
        publisher_id: null,
        publisher_name: '',
        handoff_status: 'pooled',
        handoff_time: '2026-09-03 12:00:00'
      }]))
    }
    if (path === '/api/task/batch-submit/resolve') {
      const descriptors = request.postDataJSON()?.files || []
      const groups = descriptors.map((file, index) => {
        const taskNo = file.name.match(/C\d{12}/)?.[0] || `C20260903${String(index + 1).padStart(4, '0')}`
        const isModification = taskNo.endsWith('0002')
        return {
          taskId: index === 0 ? 202 : isModification ? 210 : 900 + index,
          taskNo,
          title: `批量任务${index + 1}`,
          publisherName: '客服甲',
          wangwangId: `batch-${index + 1}`,
          status: isModification ? 'rejected' : 'accepted',
          submissionType: isModification ? 'modification' : 'initial',
          rejectRecordId: isModification ? 602 : null,
          rejectIndex: isModification ? 2 : null,
          appliedScore: isModification ? 2.5 : 1,
          files: [{ ...file, matchedBy: 'task_no' }]
        }
      })
      return json(route, { code: 0, data: { groups, unresolved: [] } })
    }

    if (path === '/api/task/my-accepted') return json(route, listPayload(filterByTaskGroup(url.searchParams.get('taskGroup'))))
    if (path === '/api/task/my-published') return json(route, listPayload(filterByTaskGroup(url.searchParams.get('taskGroup'))))
    if (path === '/api/task/hall') return json(route, listPayload(filterByTaskGroup(url.searchParams.get('taskGroup')).filter(row => row.status === 'wait')))
    if (path === '/api/task/all') return json(route, listPayload(filterByTaskGroup(url.searchParams.get('taskGroup'))))
    if (path === '/api/task/detail') {
      const taskId = Number(url.searchParams.get('taskId'))
      const task = [...taskRows, ...scoreRows].find(row => row.id === taskId) || taskRows[0]
      return json(route, { code: 0, data: { ...task, files: task.files || files, reject_records: task.reject_records || [] } })
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
