/**
 * 任务状态工具 composable
 * 提供统一的 statusLabel / statusType / progressWidth
 */

const STATUS_MAP = {
  pending_original_review: '待审核原图',
  draft: '草稿',
  wait: '待接单',
  accepted: '已接单',
  doing: '作图中',
  pending_original: '待上传原图',
  submitted: '待审核',
  finished: '已完成',
  rejected: '已驳回'
}

const STATUS_TAG_TYPE = {
  pending_original_review: 'warning',
  draft: '',
  wait: 'warning',
  accepted: 'primary',
  doing: '',
  pending_original: 'warning',
  submitted: 'info',
  finished: 'success',
  rejected: 'danger'
}

const PROGRESS_STEPS = {
  pending_original_review: '90%',
  draft: '5%',
  wait: '15%',
  accepted: '35%',
  doing: '65%',
  pending_original: '80%',
  submitted: '85%',
  finished: '100%',
  rejected: '65%'
}

const VALID_TRANSITIONS = {
  wait: ['accepted'],
  accepted: ['doing', 'draft'],
  doing: ['submitted', 'accepted'],
  submitted: ['finished', 'rejected'],
  pending_original: ['pending_original_review'],
  pending_original_review: ['finished', 'pending_original'],
  rejected: ['submitted']
}

export function useTaskStatus() {
  function statusLabel(s) { return STATUS_MAP[s] || s }
  function statusType(s) { return STATUS_TAG_TYPE[s] || 'info' }
  function progressWidth(s) { return PROGRESS_STEPS[s] || '0%' }
  function validActions(status) { return VALID_TRANSITIONS[status] || [] }

  return { statusLabel, statusType, progressWidth, validActions, STATUS_MAP, STATUS_TAG_TYPE }
}
