import { isRef, watch } from 'vue'
import { getUser } from '@/utils/auth'

export function usePersistedFilters(key, state, options = {}) {
  const skipKeys = new Set(options.skip || [])
  const snapshot = () => {
    const payload = {}
    Object.keys(state).forEach(k => {
      if (!skipKeys.has(k)) payload[k] = isRef(state[k]) ? state[k].value : state[k]
    })
    return payload
  }
  const defaults = JSON.parse(JSON.stringify(snapshot()))
  const resolveKey = () => {
    if (typeof key === 'function') return key()
    return isRef(key) ? key.value : key
  }
  let activeStorageKey = ''

  function restore() {
    const rawKey = resolveKey()
    const storageKey = getScopedStorageKey(rawKey)
    const legacyStorageKey = `nexus_filters_${rawKey}`
    activeStorageKey = storageKey
    let saved = defaults
    const scopedRaw = localStorage.getItem(storageKey)
    const legacyRaw = scopedRaw ? null : localStorage.getItem(legacyStorageKey)
    const raw = scopedRaw || legacyRaw
    if (raw) {
      saved = { ...defaults, ...JSON.parse(raw) }
      if (legacyRaw) {
        localStorage.setItem(storageKey, JSON.stringify(saved))
        localStorage.removeItem(legacyStorageKey)
      }
    }
    Object.keys(defaults).forEach(k => {
      if (!skipKeys.has(k) && k in state) {
        if (isRef(state[k])) state[k].value = saved[k]
        else state[k] = saved[k]
      }
    })
  }

  try {
    restore()
  } catch {}

  if (typeof key === 'function' || isRef(key)) {
    watch(resolveKey, () => {
      try { restore() } catch {}
    }, { flush: 'sync' })
  }

  watch(
    () => JSON.stringify(snapshot()),
    () => {
      localStorage.setItem(activeStorageKey || getScopedStorageKey(resolveKey()), JSON.stringify(snapshot()))
    },
    { deep: true }
  )
}

function getScopedStorageKey(key) {
  const user = getUser()
  const rawUserKey = String(user?.id || user?.username || 'guest')
  const userKey = rawUserKey
    .replace(/\s+/g, '_')
    .replace(/[^\w-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'guest'
  return `nexus_filters_${userKey}_${key}`
}
