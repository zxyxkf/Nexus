import { computed } from 'vue'

export function useOverdueSort(listRef) {
  function isOverdue() {
    return false
  }

  function isUrged(task) {
    return task?.status === 'accepted' && !!task?.urge_time
  }

  const sortedList = computed(() => {
    const arr = [...listRef.value]
    arr.sort((a, b) => {
      const aUrged = isUrged(a) ? 0 : 1
      const bUrged = isUrged(b) ? 0 : 1
      if (aUrged !== bUrged) return aUrged - bUrged
      if (isUrged(a) && isUrged(b)) return new Date(b.urge_time) - new Date(a.urge_time)
      return new Date(b.update_time || b.create_time || 0) - new Date(a.update_time || a.create_time || 0)
    })
    return arr
  })

  function tableRowClassName({ row }) {
    return isUrged(row) ? 'row-urged' : ''
  }

  return { isOverdue, sortedList, tableRowClassName }
}
