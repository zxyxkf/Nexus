/**
 * 侧边栏菜单注册表。
 * 每个页面权限只注册一次，侧边栏按有效权限生成，避免多角色菜单拼接造成重复。
 */

export const MENU_SECTIONS = [
  { key: 'operator_design', label: '运营美工' },
  { key: 'operator_assistant', label: '运营助理' },
  { key: 'cs_basic', label: '客服基础美工' },
  { key: 'designer', label: '美工设计师' },
  { key: 'basic_designer', label: '基础美工' },
  { key: 'payment_tracking', label: '打款跟踪' },
  { key: 'data', label: '数据' },
  { key: 'score', label: '分值管理' },
  { key: 'overview', label: '概览' },
  { key: 'all_tasks', label: '全量任务' },
  { key: 'system', label: '系统管理' },
  { key: 'common', label: '通用' }
]

export const MENU_REGISTRY = [
  { group: 'operator_design', path: '/operator/publish', icon: 'Plus', label: '发布任务', permission: 'operator.publish.design' },
  { group: 'operator_design', path: '/operator/tasks', icon: 'List', label: '我的任务', permission: 'operator.tasks.design' },
  { group: 'operator_design', path: '/operator/review', icon: 'Select', label: '作品审核', permission: 'operator.review.design' },

  { group: 'operator_assistant', path: '/operator/op-publish', icon: 'Plus', label: '发布运营任务', permission: 'operator.publish.assistant' },
  { group: 'operator_assistant', path: '/operator/op-tasks', icon: 'List', label: '我的运营任务', permission: 'operator.tasks.assistant' },
  { group: 'operator_assistant', path: '/operator/op-review', icon: 'Select', label: '任务审核', permission: 'operator.review.assistant' },
  { group: 'operator_assistant', path: '/operator-assistant/hall', icon: 'ShoppingCart', label: '任务大厅', permission: 'assistant.hall.operator' },
  { group: 'operator_assistant', path: '/operator-assistant/tasks', icon: 'List', label: '我的任务', permission: 'assistant.tasks.operator' },
  { group: 'operator_assistant', path: '/operator-assistant/tasks/todo', icon: 'List', label: '待做任务', permission: 'assistant.tasks.operator' },
  { group: 'operator_assistant', path: '/operator-assistant/tasks/pending', icon: 'Select', label: '待审核任务', permission: 'assistant.tasks.operator' },

  { group: 'cs_basic', path: '/cs/publish', icon: 'Plus', label: '发布任务', permission: 'cs.publish.basic' },
  { group: 'cs_basic', path: '/cs/tasks', icon: 'List', label: '我的任务', permission: 'cs.tasks.basic' },
  { group: 'cs_basic', path: '/cs/review', icon: 'Select', label: '作品审核', permission: 'cs.review.basic' },

  { group: 'designer', path: '/designer/hall', icon: 'ShoppingCart', label: '任务大厅', permission: 'designer.hall.design' },
  { group: 'designer', path: '/designer/tasks', icon: 'List', label: '我的任务', permission: 'designer.tasks.design' },
  { group: 'designer', path: '/designer/tasks/todo', icon: 'List', label: '待做任务', permission: 'designer.tasks.design' },
  { group: 'designer', path: '/designer/tasks/pending', icon: 'Select', label: '待审核任务', permission: 'designer.tasks.design' },

  { group: 'basic_designer', path: '/basic/hall', icon: 'ShoppingCart', label: '任务大厅', permission: 'basic.hall.cs' },
  { group: 'basic_designer', path: '/basic/tasks', icon: 'List', label: '我的任务', permission: 'basic.tasks.cs' },
  { group: 'basic_designer', path: '/basic/tasks/todo', icon: 'List', label: '待做任务', permission: 'basic.tasks.cs' },
  { group: 'basic_designer', path: '/basic/tasks/pending', icon: 'Select', label: '待审核任务', permission: 'basic.tasks.cs' },

  { group: 'payment_tracking', path: '/payment-tracking/selections', icon: 'List', label: '选品收集', permission: 'payment.selection.view' },
  { group: 'payment_tracking', path: '/payment-tracking/records', icon: 'Document', label: '打款记录', permission: 'payment.records.view' },

  { group: 'data', path: '/operator/stats', icon: 'DataLine', label: '个人统计', permission: 'stats.personal', roles: ['operator'] },
  { group: 'data', path: '/cs/stats', icon: 'DataLine', label: '个人统计', permission: 'stats.personal', roles: ['cs_agent'] },
  { group: 'data', path: '/designer/stats', icon: 'DataLine', label: '个人统计', permission: 'stats.personal', roles: ['designer'] },
  { group: 'data', path: '/basic/stats', icon: 'DataLine', label: '个人统计', permission: 'stats.personal', roles: ['basic_designer'] },
  { group: 'data', path: '/operator-assistant/stats', icon: 'DataLine', label: '个人统计', permission: 'stats.personal', roles: ['operator_assistant'] },
  { group: 'data', path: '/dashboard', icon: 'DataAnalysis', label: '高级美工仪表盘', permission: 'dashboard.design' },
  { group: 'data', path: '/dashboard/operator-assistant', icon: 'DataAnalysis', label: '运营助理仪表盘', permission: 'dashboard.operator' },
  { group: 'data', path: '/dashboard/basic-designer', icon: 'DataAnalysis', label: '基础美工仪表盘', permission: 'dashboard.cs' },

  { group: 'score', path: '/basic/score-review', icon: 'Select', label: '分值审核', permission: 'score.review.basic' },
  { group: 'score', path: '/basic/review-records', icon: 'Document', label: '审核记录', permission: 'score.records.basic' },

  { group: 'overview', path: '/dashboard', icon: 'DataAnalysis', label: '高级美工仪表盘', permission: 'dashboard.design', roles: ['admin', 'sub_admin'] },
  { group: 'overview', path: '/dashboard/operator-assistant', icon: 'DataAnalysis', label: '运营助理仪表盘', permission: 'dashboard.operator', roles: ['admin', 'sub_admin'] },
  { group: 'overview', path: '/dashboard/basic-designer', icon: 'DataAnalysis', label: '基础美工仪表盘', permission: 'dashboard.cs', roles: ['admin', 'sub_admin'] },

  { group: 'all_tasks', path: '/admin/tasks/design', icon: 'List', label: '运营美工全量任务', permission: 'admin.tasks.design' },
  { group: 'all_tasks', path: '/admin/tasks/operator', icon: 'List', label: '运营助理全量任务', permission: 'admin.tasks.operator' },
  { group: 'all_tasks', path: '/admin/tasks/cs', icon: 'List', label: '客服基础美工全量任务', permission: 'admin.tasks.cs' },

  { group: 'system', path: '/admin/users', icon: 'User', label: '用户管理', permission: 'admin.users' },
  { group: 'system', path: '/admin/logs', icon: 'Document', label: '操作日志', permission: 'admin.logs' },
  { group: 'system', path: '/admin/config', icon: 'Setting', label: '系统配置', permission: 'admin.config' },

  { group: 'common', path: '/notifications', icon: 'Bell', label: '通知中心', permission: 'notification.center' }
]

const BUSINESS_SECTION_BY_ROLE = {
  operator: ['operator_design', 'operator_assistant', 'cs_basic', 'designer', 'basic_designer', 'payment_tracking', 'data', 'score', 'common'],
  cs_agent: ['cs_basic', 'operator_design', 'operator_assistant', 'designer', 'basic_designer', 'payment_tracking', 'data', 'score', 'common'],
  designer: ['designer', 'operator_design', 'operator_assistant', 'cs_basic', 'basic_designer', 'payment_tracking', 'data', 'score', 'common'],
  basic_designer: ['basic_designer', 'cs_basic', 'operator_design', 'operator_assistant', 'designer', 'payment_tracking', 'data', 'score', 'common'],
  operator_assistant: ['operator_assistant', 'operator_design', 'cs_basic', 'designer', 'basic_designer', 'payment_tracking', 'data', 'score', 'common']
}

const ADMIN_SECTION_ORDER = ['overview', 'all_tasks', 'payment_tracking', 'score', 'system', 'common']
const GLOBAL_SECTION_ORDER = MENU_SECTIONS.map(section => section.key)
const ADMIN_ONLY_PERMISSIONS = new Set(['admin.users'])
const STRICT_ROLE_PERMISSIONS = new Set(['stats.personal'])

function canShowForRole(item, role) {
  if (ADMIN_ONLY_PERMISSIONS.has(item.permission) && role !== 'admin') return false
  if (item.roles && !STRICT_ROLE_PERMISSIONS.has(item.permission)) return true
  return !item.roles || item.roles.includes(role)
}

function buildSectionOrder(role) {
  if (role === 'admin') return ADMIN_SECTION_ORDER

  const preferred = role === 'sub_admin'
    ? ADMIN_SECTION_ORDER
    : (BUSINESS_SECTION_BY_ROLE[role] || ['common'])

  return [
    ...preferred,
    ...GLOBAL_SECTION_ORDER.filter(key => !preferred.includes(key))
  ]
}

export function buildSidebarMenu(user, hasPermission) {
  if (!user) return []

  const sectionOrder = buildSectionOrder(user.role)
  const seen = new Set()
  const grouped = new Map(sectionOrder.map(key => [key, []]))

  for (const item of MENU_REGISTRY) {
    if (!grouped.has(item.group)) continue
    if (!canShowForRole(item, user.role)) continue
    if (!hasPermission(item.permission, user)) continue

    const uniqueKey = item.path || item.permission
    if (seen.has(uniqueKey)) continue
    seen.add(uniqueKey)
    grouped.get(item.group).push(item)
  }

  const sectionLabels = new Map(MENU_SECTIONS.map(s => [s.key, s.label]))
  const menu = []

  for (const sectionKey of sectionOrder) {
    const items = grouped.get(sectionKey) || []
    if (items.length === 0) continue
    if (menu.length > 0) menu.push({ separator: true })
    menu.push({ section: sectionLabels.get(sectionKey) || sectionKey })
    menu.push(...items)
  }

  return menu.map((item, index) => ({
    ...item,
    _key: `${item.path || item.permission || item.group || 'separator'}:${index}`
  }))
}
