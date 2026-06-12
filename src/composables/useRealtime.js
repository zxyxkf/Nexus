/**
 * WebSocket 实时推送 composable
 * 连接 socket.io 监听任务变更事件，断开时自动 fallback 到轮询
 */
import { ref, onMounted, onUnmounted } from 'vue'
import { io } from 'socket.io-client'
import { getToken } from '@/utils/auth'
import { getServerBase } from '@/utils/server-base'

let socket = null
let socketRefs = 0

function getSocket() {
  if (socket) return socket

  const token = getToken()
  if (!token) return null

  const serverBase = getServerBase(location.origin)

  socket = io(serverBase, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    reconnectionAttempts: Infinity
  })

  socket.on('connect', () => {
    console.debug('[WS] 已连接:', socket.id)
  })

  socket.on('disconnect', (reason) => {
    console.debug('[WS] 断开:', reason)
  })

  socket.on('connect_error', (err) => {
    console.warn('[WS] 连接失败:', err.message)
  })

  return socket
}

function releaseSocket() {
  socketRefs--
  if (socketRefs <= 0 && socket) {
    socket.disconnect()
    socket = null
    socketRefs = 0
  }
}

export function useRealtime(fetchFn, interval = 3000, options = {}) {
  const loading = ref(false)
  let pollTimer = null
  let wsConnected = false
  let running = false
  let pendingOptions = null

  async function execute(runOptions = {}) {
    const shouldPause = runOptions.shouldPause || options.shouldPause
    if (runOptions.silent && typeof shouldPause === 'function' && shouldPause()) return
    if (running) {
      pendingOptions = { silent: true, ...runOptions, shouldPause }
      return
    }
    running = true
    try {
      loading.value = !runOptions.silent
      await fetchFn(runOptions)
    } finally {
      running = false
      loading.value = false
      if (pendingOptions) {
        const nextOptions = pendingOptions
        pendingOptions = null
        execute(nextOptions)
      }
    }
  }

  function startPolling() {
    if (pollTimer) return
    pollTimer = setInterval(() => execute({ silent: true, shouldPause: options.shouldPause }), interval)
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  onMounted(() => {
    // 首次加载
    execute()

    const s = getSocket()
    if (s) {
      socketRefs++

      const onUpdate = () => {
        wsConnected = true
        stopPolling()
        execute({ silent: true, shouldPause: options.shouldPause })
      }

      const onConnect = () => {
        wsConnected = true
        stopPolling()
      }

      const onDisconnect = () => {
        wsConnected = false
        startPolling()
      }

      s.on('task:update', onUpdate)
      s.on('connect', onConnect)
      s.on('disconnect', onDisconnect)

      // 初始状态：如果已经连接则不用轮询
      if (s.connected) {
        wsConnected = true
      } else {
        startPolling()
      }

      onUnmounted(() => {
        s.off('task:update', onUpdate)
        s.off('connect', onConnect)
        s.off('disconnect', onDisconnect)
        stopPolling()
        releaseSocket()
      })
    } else {
      // 无 token，直接轮询
      startPolling()
      onUnmounted(() => stopPolling())
    }
  })

  return { loading, refresh: execute }
}
