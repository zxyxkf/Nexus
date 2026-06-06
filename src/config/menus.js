/**
 * 侧边栏菜单配置 — 数据驱动，消除 Layout.vue 中的重复模板
 */

export const ADMIN_MENU = [
  { section: '概览' },
  { path: '/dashboard', icon: 'DataAnalysis', label: '数据仪表盘' }
]

export const SUPER_ADMIN_MENU = [
  { separator: true },
  { section: '系统管理' },
  { path: '/admin/users', icon: 'User', label: '用户管理' }
]

export const ADMIN_EXTRA_MENU = [
  { separator: true },
  { section: '全量任务' },
  { path: '/admin/tasks/design', icon: 'List', label: '运营美工全量任务' },
  { path: '/admin/tasks/operator', icon: 'List', label: '运营助理全量任务' },
  { path: '/admin/tasks/cs', icon: 'List', label: '客服基础美工全量任务' }
]

export const SUPER_ADMIN_EXTRA_MENU = [
  { path: '/admin/logs', icon: 'Document', label: '操作日志' },
  { path: '/admin/config', icon: 'Setting', label: '系统配置' }
]

export function publisherMenu(prefix, sectionLabel) {
  return [
    { section: sectionLabel },
    { path: `/${prefix}/publish`, icon: 'Plus', label: '发布任务' },
    { path: `/${prefix}/tasks`, icon: 'List', label: '我的任务' },
    { path: `/${prefix}/review`, icon: 'Select', label: '作品审核' }
  ]
}

export function operatorExtraMenu() {
  return [
    { separator: true },
    { section: '运营任务管理' },
    { path: '/operator/op-publish', icon: 'Plus', label: '发布运营任务' },
    { path: '/operator/op-tasks', icon: 'List', label: '我的运营任务' },
    { path: '/operator/op-review', icon: 'Select', label: '任务审核' }
  ]
}

export function operatorDataMenu(prefix) {
  return [
    { separator: true },
    { section: '数据' },
    { path: `/${prefix}/stats`, icon: 'DataLine', label: '个人统计' },
    { path: `/${prefix}/board`, icon: 'DataAnalysis', label: '数据看板' }
  ]
}

export function csAgentDataMenu(prefix) {
  return [
    { separator: true },
    { section: '数据' },
    { path: `/${prefix}/stats`, icon: 'DataLine', label: '个人统计' },
    { path: `/${prefix}/board`, icon: 'DataAnalysis', label: '数据看板' }
  ]
}

export function designerMenu(prefix, sectionLabel) {
  return [
    { section: sectionLabel },
    { path: `/${prefix}/hall`, icon: 'ShoppingCart', label: '任务大厅' },
    { path: `/${prefix}/tasks`, icon: 'List', label: '我的任务' },
    { separator: true },
    { section: '数据' },
    { path: `/${prefix}/stats`, icon: 'DataLine', label: '个人统计' },
    { path: `/${prefix}/board`, icon: 'DataAnalysis', label: '数据看板' }
  ]
}

// 基础美工分值审核菜单（组长用"分值管理"，子管理员用"基础美工分值审核"）
export function basicDesignerLeadMenu(sectionLabel = '分值管理') {
  return [
    { separator: true },
    { section: sectionLabel },
    { path: '/basic/score-review', icon: 'Select', label: '分值审核' },
    { path: '/basic/review-records', icon: 'Document', label: '审核记录' }
  ]
}
