/**
 * 通用格式化工具
 */

export const STATUS_MAP = {
  wait: '待接单',
  accepted: '已接单',
  doing: '待审核',
  finished: '已完成',
  rejected: '已驳回',
  draft: '草稿'
}

export const STATUS_TAG_TYPE = {
  wait: 'info',
  accepted: 'warning',
  doing: 'primary',
  finished: 'success',
  rejected: 'danger',
  draft: ''
}

export const PRIORITY_MAP = {
  1: '低',
  2: '中',
  3: '高',
  4: '紧急'
}

export const PRIORITY_TAG_TYPE = {
  1: 'info',
  2: '',
  3: 'warning',
  4: 'danger'
}

export function formatDate(str) {
  if (!str) return '-'
  return str.replace('T', ' ').substring(0, 19)
}

export function getTaskHeaderTime(task) {
  if (!task) return { label: '时间', value: '' }
  if (task.status === 'finished') {
    return { label: '审核通过时间', value: task.finish_time || task.update_time || task.submit_time || task.create_time || '' }
  }
  if (task.status === 'doing') {
    return { label: '上传提交时间', value: task.submit_time || task.update_time || task.create_time || '' }
  }
  if (task.status === 'rejected') {
    return { label: '驳回时间', value: task.update_time || task.submit_time || task.create_time || '' }
  }
  if (task.status === 'accepted') {
    return { label: '接单时间', value: task.accept_time || task.update_time || task.create_time || '' }
  }
  if (task.status === 'draft') {
    return { label: '撤回时间', value: task.update_time || task.create_time || '' }
  }
  return { label: '发布时间', value: task.create_time || task.update_time || '' }
}

export function formatTaskHeaderTime(task) {
  const item = getTaskHeaderTime(task)
  return item.value ? `${item.label} ${formatDate(item.value)}` : ''
}

export function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return Math.round(size * 100) / 100 + ' ' + units[i]
}

export function truncateFileName(name, max = 20) {
  if (!name || name.length <= max) return name || ''
  const ext = name.lastIndexOf('.')
  if (ext < 0) return name.substring(0, max - 2) + '..'
  return name.substring(0, max - 4 - (name.length - ext)) + '...' + name.substring(ext)
}

export const ROLE_LABEL = {
  admin: '超级管理员',
  sub_admin: '子管理员',
  operator: '运营专员',
  cs_agent: '客服专员',
  designer: '美工设计师',
  basic_designer: '基础美工',
  operator_assistant: '运营助理'
}

export const ROLE_TAG_TYPE = {
  admin: 'danger',
  sub_admin: '',
  operator: 'warning',
  cs_agent: 'warning',
  designer: 'success',
  basic_designer: '',
  operator_assistant: 'info'
}
