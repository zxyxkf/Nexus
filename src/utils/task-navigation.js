import router from '@/router'
import { getUser } from '@/utils/auth'

const ADMIN_TASK_ROUTES = {
  design: '/admin/tasks/design',
  operator: '/admin/tasks/operator',
  cs: '/admin/tasks/cs'
}

export function getTaskListPath(task = {}, user = getUser()) {
  const role = user?.role
  const group = task.task_group || task.taskGroup || 'design'
  const type = task.type || ''

  if (role === 'admin' || role === 'sub_admin') {
    return ADMIN_TASK_ROUTES[group] || ADMIN_TASK_ROUTES.design
  }

  if (role === 'operator' && (type === 'task_submit' || type === 'task_submitted')) {
    return group === 'operator' ? '/operator/op-review' : '/operator/review'
  }
  if (role === 'cs_agent' && (type === 'task_submit' || type === 'task_submitted')) {
    return '/cs/review'
  }

  if (Number(task.publisher_id) === Number(user?.id)) {
    if (group === 'operator') return '/operator/op-tasks'
    if (group === 'cs') return '/cs/tasks'
    return '/operator/tasks'
  }

  if (Number(task.designer_id) === Number(user?.id)) {
    if (group === 'operator') return '/operator-assistant/tasks'
    if (group === 'cs') return '/basic/tasks'
    return '/designer/tasks'
  }

  const fallbackByRole = {
    operator: group === 'operator' ? '/operator/op-tasks' : '/operator/tasks',
    cs_agent: '/cs/tasks',
    designer: '/designer/tasks',
    basic_designer: '/basic/tasks',
    operator_assistant: '/operator-assistant/tasks'
  }
  return fallbackByRole[role] || '/dashboard'
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
