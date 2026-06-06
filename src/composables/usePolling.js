/**
 * 通用轮询 composable — 组件挂载时开始轮询，卸载时自动清理
 */

import { ref, onMounted, onUnmounted } from 'vue'

export function usePolling(fetchFn, interval = 3000) {
  const loading = ref(false)
  let timer = null

  async function execute() {
    try {
      loading.value = true
      await fetchFn()
    } finally {
      loading.value = false
    }
  }

  onMounted(() => {
    execute()
    timer = setInterval(execute, interval)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
    timer = null
  })

  return { loading, refresh: execute }
}
