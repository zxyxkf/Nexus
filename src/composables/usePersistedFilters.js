import { isRef, watch } from 'vue'
import { getUser } from '@/utils/auth'

export function usePersistedFilters(key, state, options = {}) {
  const storageKey = getScopedStorageKey(key)
  const legacyStorageKey = `nexus_filters_${key}`
  const skipKeys = new Set(options.skip || [])

  try {
    const scopedRaw = localStorage.getItem(storageKey)
    const legacyRaw = scopedRaw ? null : localStorage.getItem(legacyStorageKey)
    const raw = scopedRaw || legacyRaw
    if (raw) {
      const saved = JSON.parse(raw)
      Object.keys(saved).forEach(k => {
        if (!skipKeys.has(k) && k in state) {
          if (isRef(state[k])) state[k].value = saved[k]
          else state[k] = saved[k]
        }
      })
      if (legacyRaw) {
        localStorage.setItem(storageKey, JSON.stringify(saved))
        localStorage.removeItem(legacyStorageKey)
      }
    }
  } catch {}

  const snapshot = () => {
    const payload = {}
    Object.keys(state).forEach(k => {
      if (!skipKeys.has(k)) payload[k] = isRef(state[k]) ? state[k].value : state[k]
    })
    return payload
  }

  watch(
    () => JSON.stringify(snapshot()),
    () => {
      localStorage.setItem(storageKey, JSON.stringify(snapshot()))
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
