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
    'task.create.cs', 'task.review.own', 'task.view.own', 'task.download.file', 'notification.center'
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

export function userPermissions(user = getUser()) {
  if (!user) return []
  if (Array.isArray(user.permissions) && user.permissions.length > 0) return user.permissions
  return ROLE_PERMISSION_FALLBACK[user.role] || []
}

export function hasPermission(permission, user = getUser()) {
  if (!permission) return true
  if (user?.role === 'admin') return true
  return userPermissions(user).includes(permission)
}

export function hasAnyPermission(permissions = [], user = getUser()) {
  if (!permissions || permissions.length === 0) return true
  if (user?.role === 'admin') return true
  return permissions.some(p => hasPermission(p, user))
}

export function filterMenuByPermission(items, user = getUser()) {
  const result = []
  for (const item of items) {
    if (item.section || item.separator) {
      result.push(item)
      continue
    }
    if (hasPermission(item.permission, user)) result.push(item)
  }
  return result.filter((item, index, arr) => {
    if (!item.section && !item.separator) return true
    const next = arr.slice(index + 1).find(x => !x.section && !x.separator)
    return !!next
  })
}
