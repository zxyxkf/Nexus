import { getUser } from '@/utils/auth'

const ROLE_PERMISSION_FALLBACK = {
  admin: ['*'],
  sub_admin: [
    'dashboard.design', 'dashboard.operator', 'dashboard.cs',
    'admin.tasks.design', 'admin.tasks.operator', 'admin.tasks.cs',
    'score.review.basic', 'score.records.basic',
    'task.view.all', 'task.download.file', 'task.export', 'dashboard.export', 'notification.center'
  ],
  operator: [
    'operator.publish.design', 'operator.tasks.design', 'operator.review.design',
    'operator.publish.assistant', 'operator.tasks.assistant', 'operator.review.assistant',
    'stats.personal', 'dashboard.design', 'dashboard.operator',
    'task.create.design', 'task.create.operator', 'task.review.own',
    'task.view.store', 'task.download.file', 'notification.center'
  ],
  cs_agent: [
    'cs.publish.basic', 'cs.tasks.basic', 'cs.review.basic',
    'stats.personal', 'dashboard.cs',
    'task.create.cs', 'cs.task_no.update', 'task.review.own', 'task.view.own', 'task.download.file', 'notification.center'
  ],
  designer: [
    'designer.hall.design', 'designer.tasks.design', 'stats.personal', 'dashboard.design',
    'task.upload.work', 'task.view.own', 'task.download.file', 'notification.center'
  ],
  basic_designer: [
    'basic.hall.cs', 'basic.tasks.cs', 'stats.personal', 'dashboard.cs',
    'task.upload.work', 'task.view.own', 'task.download.file', 'notification.center',
    'score.review.basic', 'score.records.basic'
  ],
  operator_assistant: [
    'assistant.hall.operator', 'assistant.tasks.operator', 'stats.personal', 'dashboard.operator',
    'task.upload.work', 'task.view.own', 'task.download.file', 'notification.center'
  ]
}

const PERMISSION_IMPLICATIONS = {
  'task.create.design': ['operator.publish.design'],
  'task.create.operator': ['operator.publish.assistant'],
  'task.create.cs': ['cs.publish.basic'],
  'operator.publish.design': ['task.create.design', 'task.view.store', 'task.download.file'],
  'operator.tasks.design': ['task.view.store', 'task.download.file'],
  'operator.review.design': ['task.review.own', 'task.view.store', 'task.download.file'],
  'operator.publish.assistant': ['task.create.operator', 'task.view.store', 'task.download.file'],
  'operator.tasks.assistant': ['task.view.store', 'task.download.file'],
  'operator.review.assistant': ['task.review.own', 'task.view.store', 'task.download.file'],
  'cs.publish.basic': ['task.create.cs', 'task.view.own', 'task.download.file'],
  'cs.tasks.basic': ['task.view.own', 'task.download.file'],
  'cs.review.basic': ['task.review.own', 'task.view.own', 'task.download.file'],
  'designer.hall.design': ['task.view.own', 'task.download.file'],
  'designer.tasks.design': ['task.upload.work', 'task.view.own', 'task.download.file'],
  'basic.hall.cs': ['task.view.own', 'task.download.file'],
  'basic.tasks.cs': ['task.upload.work', 'task.view.own', 'task.download.file'],
  'assistant.hall.operator': ['task.view.own', 'task.download.file'],
  'assistant.tasks.operator': ['task.upload.work', 'task.view.own', 'task.download.file'],
  'admin.tasks.design': ['task.download.file', 'task.export'],
  'admin.tasks.operator': ['task.download.file', 'task.export'],
  'admin.tasks.cs': ['task.download.file', 'task.export'],
  'dashboard.design': ['dashboard.export'],
  'dashboard.operator': ['dashboard.export'],
  'dashboard.cs': ['dashboard.export']
}

export function expandPermissions(codes = []) {
  const set = new Set(codes)
  let changed = true
  while (changed) {
    changed = false
    for (const code of [...set]) {
      for (const implied of PERMISSION_IMPLICATIONS[code] || []) {
        if (!set.has(implied)) {
          set.add(implied)
          changed = true
        }
      }
    }
  }
  return [...set]
}

export function userPermissions(user = getUser()) {
  if (!user) return []
  if (Array.isArray(user.permissions)) return expandPermissions(user.permissions)
  return expandPermissions(ROLE_PERMISSION_FALLBACK[user.role] || [])
}

export function hasPermission(permission, user = getUser()) {
  if (!permission) return true
  if (Array.isArray(permission)) return hasAnyPermission(permission, user)
  const permissions = userPermissions(user)
  return permissions.includes('*') || permissions.includes(permission)
}

export function hasAnyPermission(permissions = [], user = getUser()) {
  if (!permissions || permissions.length === 0) return true
  return permissions.some(p => hasPermission(p, user))
}

export function filterMenuByPermission(items, user = getUser()) {
  const result = []
  for (const item of items) {
    if (item.section || item.separator) {
      result.push(item)
      continue
    }
    if (hasPermission(item.permission || item.permissions, user)) result.push(item)
  }
  return result.filter((item, index, arr) => {
    if (!item.section && !item.separator) return true
    const next = arr.slice(index + 1).find(x => !x.section && !x.separator)
    return !!next
  })
}
