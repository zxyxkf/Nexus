<template>
  <router-view />
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useUserStore } from '@/store'
import { ElMessage } from 'element-plus'

const userStore = useUserStore()

// 立即设置默认服务器地址（同步执行，确保任何 API 调用前已有值）
const DEFAULT_SERVER = 'http://192.168.101.78:18632'
if (!localStorage.getItem('design_server_url')) {
  localStorage.setItem('design_server_url', DEFAULT_SERVER)
}

// ===== 自动更新事件监听 =====
let lastProgress = 0

function setupUpdateListeners() {
  if (!window.electronAPI) return
  window.electronAPI.onUpdateAvailable((info) => {
    ElMessage.info(`发现新版本 ${info.version}，正在下载...`)
  })
  window.electronAPI.onUpdateProgress((progress) => {
    const pct = Math.floor(progress.percent)
    if (pct - lastProgress >= 10) {
      lastProgress = pct
      ElMessage({ message: `下载中 ${pct}%`, duration: 2000 })
    }
  })
  window.electronAPI.onUpdateDownloaded(() => {
    ElMessage.success('更新已下载完成，请重启应用')
  })
  window.electronAPI.onUpdateError((msg) => {
    ElMessage.error(`更新失败: ${msg}`)
  })
}

onMounted(async () => {
  // 从 Electron 加载服务器配置（可能覆盖默认值）
  if (window.electronAPI?.getServerConfig) {
    try {
      const config = await window.electronAPI.getServerConfig()
      if (config?.serverUrl) {
        localStorage.setItem('design_server_url', config.serverUrl)
      }
    } catch (e) {
      // 静默 - 使用默认值
    }
  }
  userStore.initFromStorage()
  setupUpdateListeners()
})
</script>
