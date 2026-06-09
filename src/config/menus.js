/**
 * 侧边栏菜单配置 — 数据驱动，消除 Layout.vue 中的重复模板
 */

export const ADMIN_MENU = [
  { section: '概览' },
  { path: '/dashboard', icon: 'DataAnalysis', label: '高级美工仪表盘', permission: 'dashboard.design' },
  { path: '/dashboard/operator-assistant', icon: 'DataAnalysis', label: '运营助理仪表盘', permission: 'dashboard.operator' },
  { path: '/dashboard/basic-designer', icon: 'DataAnalysis', label: '基础美工仪表盘', permission: 'dashboard.cs' },
  { path: '/notifications', icon: 'Bell', label: '通知中心', permission: 'notification.center' }
]

export const SUPER_ADMIN_MENU = [
  { separator: true },
  { section: '系统管理' },
  { path: '/admin/users', icon: 'User', label: '用户管理', permission: 'admin.users' }
]

export const ADMIN_EXTRA_MENU = [
  { separator: true },
  { section: '全量任务' },
  { path: '/admin/tasks/design', icon: 'List', label: '运营美工全量任务', permission: 'admin.tasks.design' },
  { path: '/admin/tasks/operator', icon: 'List', label: '运营助理全量任务', permission: 'admin.tasks.operator' },
  { path: '/admin/tasks/cs', icon: 'List', label: '客服基础美工全量任务', permission: 'admin.tasks.cs' }
]

export const SUPER_ADMIN_EXTRA_MENU = [
  { path: '/admin/logs', icon: 'Document', label: '操作日志', permission: 'admin.logs' },
  { path: '/admin/config', icon: 'Setting', label: '系统配置', permission: 'admin.config' }
]

export function publisherMenu(prefix, sectionLabel) {
  return [
    { section: sectionLabel },
    { path: `/${prefix}/publish`, icon: 'Plus', label: '发布任务', permission: prefix === 'cs' ? 'cs.publish.basic' : 'operator.publish.design' },
    { path: `/${prefix}/tasks`, icon: 'List', label: '我的任务', permission: prefix === 'cs' ? 'cs.tasks.basic' : 'operator.tasks.design' },
    { path: `/${prefix}/review`, icon: 'Select', label: '作品审核', permission: prefix === 'cs' ? 'cs.review.basic' : 'operator.review.design' }
  ]
}

export function operatorExtraMenu() {
  return [
    { separator: true },
    { section: '运营任务管理' },
    { path: '/operator/op-publish', icon: 'Plus', label: '发布运营任务', permission: 'operator.publish.assistant' },
    { path: '/operator/op-tasks', icon: 'List', label: '我的运营任务', permission: 'operator.tasks.assistant' },
    { path: '/operator/op-review', icon: 'Select', label: '任务审核', permission: 'operator.review.assistant' }
  ]
}

export function operatorDataMenu(prefix) {
  return [
    { separator: true },
    { section: '数据' },
    { path: `/${prefix}/stats`, icon: 'DataLine', label: '个人统计', permission: 'stats.personal' },
    { path: `/${prefix}/board`, icon: 'DataAnalysis', label: '数据看板', permissions: prefix === 'operator' ? ['board.design', 'board.operator'] : ['board.cs'] },
    { path: '/notifications', icon: 'Bell', label: '通知中心', permission: 'notification.center' }
  ]
}

export function csAgentDataMenu(prefix) {
  return [
    { separator: true },
    { section: '数据' },
    { path: `/${prefix}/stats`, icon: 'DataLine', label: '个人统计', permission: 'stats.personal' },
    { path: `/${prefix}/board`, icon: 'DataAnalysis', label: '数据看板', permission: 'board.cs' },
    { path: '/notifications', icon: 'Bell', label: '通知中心', permission: 'notification.center' }
  ]
}

export function designerMenu(prefix, sectionLabel) {
  return [
    { section: sectionLabel },
    { path: `/${prefix}/hall`, icon: 'ShoppingCart', label: '任务大厅', permission: prefix === 'designer' ? 'designer.hall.design' : prefix === 'basic' ? 'basic.hall.cs' : 'assistant.hall.operator' },
    { path: `/${prefix}/tasks`, icon: 'List', label: '我的任务', permission: prefix === 'designer' ? 'designer.tasks.design' : prefix === 'basic' ? 'basic.tasks.cs' : 'assistant.tasks.operator' },
    { path: `/${prefix}/tasks/todo`, icon: 'List', label: '待做任务', permission: prefix === 'designer' ? 'designer.tasks.design' : prefix === 'basic' ? 'basic.tasks.cs' : 'assistant.tasks.operator' },
    { path: `/${prefix}/tasks/pending`, icon: 'Select', label: '待审核任务', permission: prefix === 'designer' ? 'designer.tasks.design' : prefix === 'basic' ? 'basic.tasks.cs' : 'assistant.tasks.operator' },
    { separator: true },
    { section: '数据' },
    { path: `/${prefix}/stats`, icon: 'DataLine', label: '个人统计', permission: 'stats.personal' },
    { path: `/${prefix}/board`, icon: 'DataAnalysis', label: '数据看板', permission: prefix === 'designer' ? 'board.design' : prefix === 'basic' ? 'board.cs' : 'board.operator' },
    { path: '/notifications', icon: 'Bell', label: '通知中心', permission: 'notification.center' }
  ]
}

// 基础美工分值审核菜单（组长用"分值管理"，子管理员用"基础美工分值审核"）
export function basicDesignerLeadMenu(sectionLabel = '分值管理') {
  return [
    { separator: true },
    { section: sectionLabel },
    { path: '/basic/score-review', icon: 'Select', label: '分值审核', permission: 'score.review.basic' },
    { path: '/basic/review-records', icon: 'Document', label: '审核记录', permission: 'score.records.basic' }
  ]
}
