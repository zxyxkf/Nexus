import { ref, shallowRef } from 'vue'
import { getConfigListApi } from '@/api'

const configMap = shallowRef({})
const loaded = ref(false)
let loadingPromise = null

export function useConfig() {
  async function ensureLoaded() {
    if (loaded.value) return
    if (loadingPromise) {
      await loadingPromise
      return
    }
    loadingPromise = (async () => {
      try {
        const res = await getConfigListApi()
        if (res.code === 0) {
          const map = {}
          for (const item of res.data) {
            map[item.config_key] = item.config_value
          }
          configMap.value = map
        }
      } catch (e) {
        console.warn('[useConfig] 加载配置失败:', e)
      } finally {
        loaded.value = true
        loadingPromise = null
      }
    })()
    await loadingPromise
  }

  function get(key, fallback = '') {
    return configMap.value[key] ?? fallback
  }

  function getInt(key, fallback = 0) {
    const v = parseInt(configMap.value[key], 10)
    return Number.isNaN(v) ? fallback : v
  }

  function getFloat(key, fallback = 0) {
    const v = parseFloat(configMap.value[key])
    return Number.isNaN(v) ? fallback : v
  }

  return { configMap, loaded, ensureLoaded, get, getInt, getFloat }
}
