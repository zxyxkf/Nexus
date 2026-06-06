/**
 * 任务列表通用逻辑 — 分页 / 筛选 / 刷新
 *
 * 用法:
 *   const { list, loading, total, page, pageSize, loadData, resetPage } = useTaskList(fetchFn, filterRef)
 */

import { ref, reactive } from 'vue'

export function useTaskList(fetchFn) {
  const list = ref([])
  const loading = ref(false)
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(15)

  const filters = reactive({
    status: '',
    keyword: '',
    dateRange: null,
    designerId: '',
    styleNumber: '',
    shopName: '',
    publisherId: ''
  })

  function buildParams(overrides = {}) {
    return {
      page: page.value,
      pageSize: pageSize.value,
      status: filters.status || undefined,
      keyword: filters.keyword || undefined,
      dateStart: filters.dateRange?.[0] || undefined,
      dateEnd: filters.dateRange?.[1] || undefined,
      designerId: filters.designerId || undefined,
      styleNumber: filters.styleNumber || undefined,
      shopName: filters.shopName || undefined,
      publisherId: filters.publisherId || undefined,
      ...overrides
    }
  }

  async function loadData(paramsOverrides = {}) {
    loading.value = true
    try {
      const params = buildParams(paramsOverrides)
      const res = await fetchFn(params)
      if (res.code === 0) {
        list.value = res.data.list || []
        total.value = Number(res.data.total) || 0
      }
    } catch (e) {
      console.error('[useTaskList] 加载失败:', e)
    } finally {
      loading.value = false
    }
  }

  function onPageChange(p) {
    page.value = p
    loadData()
  }

  function onSizeChange(s) {
    pageSize.value = s
    page.value = 1
    loadData()
  }

  function onFilterChange() {
    page.value = 1
    loadData()
  }

  function resetFilters() {
    filters.status = ''
    filters.keyword = ''
    filters.dateRange = null
    filters.designerId = ''
    filters.styleNumber = ''
    filters.shopName = ''
    page.value = 1
    loadData()
  }

  return {
    list, loading, total, page, pageSize, filters,
    loadData, onPageChange, onSizeChange, onFilterChange, resetFilters
  }
}
