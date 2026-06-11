import router from '@/router'
import { getUser } from '@/utils/auth'
import { hasPermission } from '@/utils/permissions'

const ADMIN_TASK_ROUTES = {
  design: '/admin/tasks/design',
  operator: '/admin/tasks/operator',
  cs: '/admin/tasks/cs'
}

const GROUP_ROUTES = {
  design: {
    admin: '/admin/tasks/design',
    publisherTasks: '/operator/tasks',
    workerTasks: '/designer/tasks',
    workerTodo: '/designer/tasks/todo',
    workerPending: '/designer/tasks/pending',
    review: '/operator/review',
    permissions: {
      admin: 'admin.tasks.design',
      publisherTasks: 'operator.tasks.design',
      workerTasks: 'designer.tasks.design',
      review: 'operator.review.design'
    }
  },
  operator: {
    admin: '/admin/tasks/operator',
    publisherTasks: '/operator/op-tasks',
    workerTasks: '/operator-assistant/tasks',
    workerTodo: '/operator-assistant/tasks/todo',
    workerPending: '/operator-assistant/tasks/pending',
    review: '/operator/op-review',
    permissions: {
      admin: 'admin.tasks.operator',
      publisherTasks: 'operator.tasks.assistant',
      workerTasks: 'assistant.tasks.operator',
      review: 'operator.review.assistant'
    }
  },
  cs: {
    admin: '/admin/tasks/cs',
    publisherTasks: '/cs/tasks',
    workerTasks: '/basic/tasks',
    workerTodo: '/basic/tasks/todo',
    workerPending: '/basic/tasks/pending',
    review: '/cs/review',
    permissions: {
      admin: 'admin.tasks.cs',
      publisherTasks: 'cs.tasks.basic',
      workerTasks: 'basic.tasks.cs',
      review: 'cs.review.basic'
    }
  }
}

function normalizeGroup(group) {
  return GROUP_ROUTES[group] ? group : 'design'
}

function rawEventType(task = {}) {
  return task.eventType || task.rawType || task.notificationType || task.noticeType || task.type || ''
}

function canUse(permission, user) {
  return !permission || hasPermission(permission, user)
}

function pickAllowed(routes, key, user) {
  if (!routes) return ''
  return canUse(routes.permissions?.[key], user) ? routes[key] : ''
}

function isSubmitEvent(task = {}) {
  const type = task.type || ''
  const eventType = rawEventType(task)
  return type === 'task_submit' || type === 'task_submitted' || eventType === 'task_submit' || eventType === 'task_submitted'
}

function isRejectEvent(task = {}) {
  const type = task.type || ''
  const eventType = rawEventType(task)
  return type === 'task_rejected' || eventType === 'task_reject' || eventType === 'task_review_reject'
}

function isPassEvent(task = {}) {
  const type = task.type || ''
  const eventType = rawEventType(task)
  return type === 'task_accepted' || eventType === 'task_review' || eventType === 'task_review_pass'
}

function isTodoEvent(task = {}) {
  const type = task.type || ''
  const eventType = rawEventType(task)
  return type === 'urge' ||
    eventType === 'task_urge' ||
    eventType === 'task_assigned' ||
    eventType === 'task_transfer'
}

export function getTaskListPath(task = {}, user = getUser()) {
  const role = user?.role
  const group = normalizeGroup(task.task_group || task.taskGroup || 'design')
  const routes = GROUP_ROUTES[group]
  const publisherId = Number(task.publisher_id ?? task.publisherId)
  const designerId = Number(task.designer_id ?? task.designerId)
  const userId = Number(user?.id)

  if (role === 'admin' || role === 'sub_admin') {
    return ADMIN_TASK_ROUTES[group] || ADMIN_TASK_ROUTES.design
  }

  if (isSubmitEvent(task)) {
    const reviewPath = pickAllowed(routes, 'review', user)
    if (reviewPath) return reviewPath
  }

  if (designerId && designerId === userId) {
    if (isRejectEvent(task) || isTodoEvent(task)) {
      return pickAllowed(routes, 'workerTodo', user) || pickAllowed(routes, 'workerTasks', user) || '/dashboard'
    }
    if (isSubmitEvent(task)) {
      return pickAllowed(routes, 'workerPending', user) || pickAllowed(routes, 'workerTasks', user) || '/dashboard'
    }
    if (isPassEvent(task)) {
      return pickAllowed(routes, 'workerTasks', user) || '/dashboard'
    }
  }

  if (publisherId && publisherId === userId) {
    return pickAllowed(routes, 'publisherTasks', user) || pickAllowed(routes, 'admin', user) || '/dashboard'
  }

  if (designerId && designerId === userId) {
    return pickAllowed(routes, 'workerTasks', user) || pickAllowed(routes, 'admin', user) || '/dashboard'
  }

  return pickAllowed(routes, 'admin', user) ||
    pickAllowed(routes, 'publisherTasks', user) ||
    pickAllowed(routes, 'workerTasks', user) ||
    pickAllowed(routes, 'review', user) ||
    '/dashboard'
}

export function openTask(task = {}) {
  const path = getTaskListPath(task)
  if (!task.id && !task.taskId && !task.task_id) {
    router.push(path)
    return
  }
  router.push({
    path,
    query: { openTask: task.id || task.taskId || task.task_id }
  })
}
