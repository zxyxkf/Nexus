/**
 * 任务状态工具 composable
 * 提供统一的 statusLabel / statusType / progressWidth
 */

const STATUS_MAP = {
  draft: '草稿',
  wait: '待接单',
  accepted: '已接单',
  doing: '作图中',
  submitted: '待审核',
  finished: '已完成',
  rejected: '已驳回'
}

const STATUS_TAG_TYPE = {
  draft: '',
  wait: 'warning',
  accepted: 'primary',
  doing: '',
  submitted: 'info',
  finished: 'success',
  rejected: 'danger'
}

const PROGRESS_STEPS = {
  draft: '5%',
  wait: '15%',
  accepted: '35%',
  doing: '65%',
  submitted: '85%',
  finished: '100%',
  rejected: '65%'
}

const VALID_TRANSITIONS = {
  wait: ['accepted'],
  accepted: ['doing', 'draft'],
  doing: ['submitted', 'accepted'],
  submitted: ['finished', 'rejected'],
  rejected: ['submitted']
}

export function useTaskStatus() {
  function statusLabel(s) { return STATUS_MAP[s] || s }
  function statusType(s) { return STATUS_TAG_TYPE[s] || 'info' }
  function progressWidth(s) { return PROGRESS_STEPS[s] || '0%' }
  function validActions(status) { return VALID_TRANSITIONS[status] || [] }

  return { statusLabel, statusType, progressWidth, validActions, STATUS_MAP, STATUS_TAG_TYPE }
}
