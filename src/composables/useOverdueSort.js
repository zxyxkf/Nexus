/**
 * 逾期置顶排序 — 逾期任务自动排在列表最前面
 *
 * 用法:
 *   const { isOverdue, sortedList, tableRowClassName } = useOverdueSort(list)
 *   // 在模板中使用 sortedList 代替 list，使用 tableRowClassName 作为 row-class-name
 */

import { computed } from 'vue'

export function useOverdueSort(listRef) {
  function isOverdue(task) {
    if (!task.deadline) return false
    return new Date(task.deadline.replace(' ', 'T')) < new Date()
  }

  const sortedList = computed(() => {
    const arr = [...listRef.value]
    arr.sort((a, b) => {
      const aOver = isOverdue(a) ? 0 : 1
      const bOver = isOverdue(b) ? 0 : 1
      if (aOver !== bOver) return aOver - bOver
      return new Date(b.create_time) - new Date(a.create_time)
    })
    return arr
  })

  function tableRowClassName({ row }) {
    if (row.status === 'rejected') return 'row-rejected'
    if (isOverdue(row) && row.status === 'accepted') return 'row-overdue'
    return ''
  }

  return { isOverdue, sortedList, tableRowClassName }
}
