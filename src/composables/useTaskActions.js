/**
 * 任务操作封装 — 撤回 / 编辑 / 删除 / 催促
 *
 * 用法:
 *   const { withdrawTask, urgeTask, deleteTask } = useTaskActions(loadData)
 *   await withdrawTask(row)
 */

import { ElMessageBox, ElMessage } from 'element-plus'
import { withdrawTaskApi, deleteTaskApi, urgeTaskApi } from '@/api'

export function useTaskActions(onSuccess) {
  async function handleWithdraw(row) {
    try {
      await ElMessageBox.confirm(
        `确认撤回任务「${row.title}」？${row.status === 'accepted' ? '该任务已被接单，撤回后将取消指派。' : ''}`,
        '确认撤回',
        { type: 'warning', confirmButtonText: '确认撤回' }
      )
      const res = await withdrawTaskApi({ taskId: row.id })
      if (res.code === 0) {
        ElMessage.success('任务已撤回')
        onSuccess?.()
      } else {
        ElMessage.error(res.msg || '撤回失败')
      }
    } catch { /* 用户取消 */ }
  }

  async function handleDelete(row, label = '任务') {
    try {
      await ElMessageBox.confirm(
        `确认删除${label}「${row.title}」？此操作不可恢复。`,
        '确认删除',
        { type: 'warning', confirmButtonText: '确认删除' }
      )
      const res = await deleteTaskApi({ taskId: row.id })
      if (res.code === 0) {
        ElMessage.success('已删除')
        onSuccess?.()
      } else {
        ElMessage.error(res.msg || '删除失败')
      }
    } catch { /* 用户取消 */ }
  }

  async function handleUrge(row, designerLabel = '美工') {
    try {
      await ElMessageBox.confirm(
        `确认催促${designerLabel}尽快完成任务「${row.title}」？`,
        '催促提醒'
      )
      const res = await urgeTaskApi({ taskId: row.id, taskTitle: row.title, designerId: row.designer_id })
      if (res.code === 0) {
        ElMessage.success(`已向${designerLabel}发送催促提醒`)
      } else {
        ElMessage.error(res.msg || '操作失败')
      }
    } catch { /* 用户取消 */ }
  }

  return { handleWithdraw, handleDelete, handleUrge }
}
