import { isRef, watch } from 'vue'

export function usePersistedFilters(key, state, options = {}) {
  const storageKey = `nexus_filters_${key}`
  const skipKeys = new Set(options.skip || [])

  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const saved = JSON.parse(raw)
      Object.keys(saved).forEach(k => {
        if (!skipKeys.has(k) && k in state) {
          if (isRef(state[k])) state[k].value = saved[k]
          else state[k] = saved[k]
        }
      })
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
