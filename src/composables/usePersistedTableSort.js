import { computed, isRef, onUnmounted, watch } from 'vue'
import { getUser } from '@/utils/auth'

const PREFIX = 'nexus_table_custom_sort'

export function usePersistedTableSort(key, sortState, options = {}) {
  const defaultProp = options.defaultProp || ''
  const defaultOrder = options.defaultOrder || ''
  const tableRef = options.tableRef || null
  let isLoading = false

  const storageKey = () => getScopedStorageKey(resolveValue(key))

  const resolveTable = () => (tableRef ? (isRef(tableRef) ? tableRef.value : tableRef) : null)

  // Clear the header sort arrow on the live, mounted el-table instance. This
  // runs only on reset (never at mount), so there is no race with el-table's
  // own mount. We mirror Element Plus's own native clear: clearSort() resets the
  // store, but it leaves the previously-sorted column's `order` property set,
  // and the arrow highlight is a CSS class derived from `column.order` — so we
  // must null it explicitly, exactly like handleSortClick does internally.
  const clearArrow = () => {
    const table = resolveTable()
    if (!table) return
    table.clearSort?.()
    const cols = table.store?.states?.columns?.value
    if (Array.isArray(cols)) cols.forEach(col => { if (col && col.order) col.order = null })
  }

  // The el-table reads `default-sort` once at mount to light up the header
  // arrow. For sortable="custom" columns it does NOT reorder rows (the view's
  // displayList computed owns ordering), so binding this is purely the visual
  // indicator — and it is race-free because el-table applies it during its own
  // mount instead of us replaying table.sort() against an unknown timeline.
  const defaultSort = computed(() => {
    const prop = getStateValue(sortState.prop)
    const order = getStateValue(sortState.order)
    return prop && order ? { prop, order } : undefined
  })

  const load = () => {
    isLoading = true
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) || 'null')
      if (saved && typeof saved === 'object') {
        setStateValue(sortState.prop, saved.prop || defaultProp)
        setStateValue(sortState.order, saved.order || defaultOrder)
      } else {
        setStateValue(sortState.prop, defaultProp)
        setStateValue(sortState.order, defaultOrder)
      }
    } catch {
      setStateValue(sortState.prop, defaultProp)
      setStateValue(sortState.order, defaultOrder)
    } finally {
      isLoading = false
    }
  }

  const persist = () => {
    if (isLoading) return
    const prop = getStateValue(sortState.prop)
    const order = getStateValue(sortState.order)
    if (!prop || !order) {
      localStorage.removeItem(storageKey())
      return
    }
    localStorage.setItem(storageKey(), JSON.stringify({ prop, order }))
  }

  watch(() => resolveValue(key), load, { immediate: true })

  watch(
    () => [getStateValue(sortState.prop), getStateValue(sortState.order)],
    persist
  )

  const reset = () => {
    if (!isCurrentRoute(options.routePath)) return
    isLoading = true
    setStateValue(sortState.prop, defaultProp)
    setStateValue(sortState.order, defaultOrder)
    localStorage.removeItem(storageKey())
    queueMicrotask(() => { isLoading = false })
    clearArrow()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('nexus-table-preferences-reset', reset)
  }

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('nexus-table-preferences-reset', reset)
    }
  })

  return { resetSortPreference: reset, sortStorageKey: storageKey, defaultSort }
}

function getStateValue(target) {
  return isRef(target) ? target.value : target
}

function setStateValue(target, value) {
  if (isRef(target)) target.value = value
}

function resolveValue(value) {
  if (typeof value === 'function') return value()
  return isRef(value) ? value.value : value
}

function stableRoutePath() {
  const raw = window.location.hash || window.location.pathname || 'root'
  const route = (raw.split('?')[0] || raw || 'root')
  return route.startsWith('#') ? route.slice(1) : route
}

function isCurrentRoute(routePath) {
  if (!routePath) return true
  return String(resolveValue(routePath) || '') === stableRoutePath()
}

function getScopedStorageKey(key) {
  const user = getUser()
  const rawUserKey = String(user?.id || user?.username || 'guest')
  const userKey = rawUserKey
    .replace(/\s+/g, '_')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'guest'
  return `${PREFIX}_${userKey}_${key}`
}
