/**
 * 桌面通知 Toast 系统
 * - 模块级状态，任意文件 import 即用
 * - WebSocket 实时推送，断开自动降级轮询
 * - 同任务同类型 30s 防抖，最多 2 条并存
 * - Electron 窗口失焦时任务栏闪烁
 */
import { shallowRef } from 'vue'
import { io } from 'socket.io-client'
import { getToken, getUser } from '@/utils/auth'
import { getUnreadCount, readNotification as readNotificationApi } from '@/api'
import router from '@/router'

const MAX_TOASTS = 2
const DEDUP_WINDOW = 30_000
const AUTO_DISMISS_MS = 5_000
const POLL_INTERVAL = 5_000

// ---- 模块级状态 ----
export const toasts = shallowRef([])

const dedupMap = new Map()
const timerEntries = new Map()
let socket = null
let pollTimer = null
let lastUnreadCount = 0
let wsConnected = false
let initialized = false
let unreadPollCb = null // 外部注入的未读数刷新回调

// ---- 内部工具 ----

function getServerBase() {
  return localStorage.getItem('design_server_url') || 'http://192.168.101.78:18632'
}

function flashTaskbar(toast) {
  if (window.electronAPI?.flashFrame) {
    window.electronAPI.flashFrame()
  }
  showNativeNotification(toast.title, toast.content, toast.type)
}

function showNativeNotification(title, body, type) {
  // Electron 环境：通过 IPC 让主进程创建原生通知（最可靠）
  if (window.electronAPI?.showDesktopNotification) {
    window.electronAPI.showDesktopNotification({ title, body, type: type || 'info' })
    return
  }

  // 非 Electron 浏览器环境：标准 Notification API
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'granted') {
    try { new Notification(title, { body }) } catch { /* 静默 */ }
  } else if (Notification.permission === 'default') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') {
        try { new Notification(title, { body }) } catch { /* 静默 */ }
      }
    })
  }
}

function clearToastTimers(id) {
  const entry = timerEntries.get(id)
  if (!entry) return
  clearTimeout(entry.dismissTimer)
  timerEntries.delete(id)
}

function startToastTimer(toast) {
  clearToastTimers(toast.id)
  const entry = {
    startTime: Date.now(),
    remaining: AUTO_DISMISS_MS,
    dismissTimer: null,
    paused: false
  }
  entry.dismissTimer = setTimeout(() => remove(toast.id), AUTO_DISMISS_MS)
  timerEntries.set(toast.id, entry)
}

function resetToastTimer(id) {
  const entry = timerEntries.get(id)
  if (!entry) return
  clearTimeout(entry.dismissTimer)
  entry.startTime = Date.now()
  entry.remaining = AUTO_DISMISS_MS
  entry.paused = false
  entry.dismissTimer = setTimeout(() => remove(id), AUTO_DISMISS_MS)
}

// ---- 公开 API ----

export function notify(type, title, content, payload = {}) {
  const key = `${payload.taskId || ''}_${type}`
  const now = Date.now()

  // 1) 防抖：同 key 30s 内不重复弹
  const lastTime = dedupMap.get(key)
  if (lastTime && now - lastTime < DEDUP_WINDOW) {
    // Electron: toast window handles its own timer → skip
    if (window.electronAPI) return
    const existing = toasts.value.find(t => t.key === key)
    if (existing) resetToastTimer(existing.id)
    return
  }
  dedupMap.set(key, now)

  // === Electron: 通过 IPC 发送到独立透明 toast 窗口 ===
  if (window.electronAPI?.showToast) {
    console.log('[Notify] Electron toast:', JSON.stringify({ type, title, content, taskId: payload.taskId, taskTitle: payload.taskTitle }))
    window.electronAPI.showToast({ type, title, content, taskId: payload.taskId, taskTitle: payload.taskTitle })
    if (window.electronAPI?.flashFrame) window.electronAPI.flashFrame()
    return
  }
  console.log('[Notify] Browser fallback:', type, title)

  // === 浏览器降级：Vue 响应式 toast ===
  const toast = {
    id: `${key}_${now}`,
    key,
    type,
    title,
    content,
    taskId: payload.taskId,
    taskTitle: payload.taskTitle,
    createdAt: now
  }

  const current = toasts.value

  // 2) 同 key 已存在 → 原地替换（重置动画）
  const existIdx = current.findIndex(t => t.key === key)
  if (existIdx >= 0) {
    clearToastTimers(current[existIdx].id)
    const next = [...current]
    next.splice(existIdx, 1, toast)
    toasts.value = next
    startToastTimer(toast)
    flashTaskbar(toast)
    return
  }

  // 3) 超过上限 → 移除最早的一条
  let next
  if (current.length >= MAX_TOASTS) {
    const oldest = current[current.length - 1]
    clearToastTimers(oldest.id)
    next = [toast, ...current.slice(0, MAX_TOASTS - 1)]
  } else {
    next = [toast, ...current]
  }
  toasts.value = next

  startToastTimer(toast)
  flashTaskbar(toast)
}

export function remove(id) {
  const idx = toasts.value.findIndex(t => t.id === id)
  if (idx < 0) return
  clearToastTimers(id)
  const next = [...toasts.value]
  next.splice(idx, 1)
  toasts.value = next
}

export function pauseToastTimer(id) {
  const entry = timerEntries.get(id)
  if (!entry || entry.paused) return
  clearTimeout(entry.dismissTimer)
  entry.remaining = Math.max(0, entry.remaining - (Date.now() - entry.startTime))
  entry.paused = true
}

export function resumeToastTimer(id) {
  const entry = timerEntries.get(id)
  if (!entry || !entry.paused) return 0
  entry.startTime = Date.now()
  entry.paused = false
  entry.dismissTimer = setTimeout(() => remove(id), entry.remaining)
  return entry.remaining
}

export async function handleToastClick(toast) {
  if (toast.taskId) {
    try {
      await readNotificationApi({ taskId: toast.taskId })
    } catch { /* 静默 */ }
  }

  // 跳转到对应角色的任务列表页
  const user = getUser()
  const role = user?.role
  const routeMap = {
    designer: '/designer/tasks',
    basic_designer: '/basic/tasks',
    operator_assistant: '/operator-assistant/tasks'
  }
  const target = routeMap[role]
  if (target && router.currentRoute.value.path !== target) {
    router.push(target)
  }

  remove(toast.id)
}

// ---- WebSocket ----

function setupWebSocket() {
  const token = getToken()
  if (!token) return

  const serverBase = getServerBase()
  socket = io(serverBase, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
    reconnectionAttempts: Infinity
  })

  socket.on('notification:new', (payload) => {
    if (!payload) return
    console.log('[WS] 收到通知:', JSON.stringify(payload))
    const typeMap = {
      urge: 'warning',
      task_rejected: 'error',
      task_accepted: 'success',
      task_transferred: 'info'
    }
    notify(
      typeMap[payload.type] || 'info',
      payload.title || '新通知',
      payload.content || payload.message || '',
      payload
    )
    // 同步刷新顶部 bell 未读数
    if (unreadPollCb) unreadPollCb()
  })

  socket.on('connect', () => {
    wsConnected = true
    stopPollingFallback()
  })

  socket.on('disconnect', () => {
    wsConnected = false
    startPollingFallback()
  })

  if (socket.connected) {
    wsConnected = true
  } else {
    startPollingFallback()
  }
}

// ---- 轮询降级 ----

function startPollingFallback() {
  if (pollTimer) return
  pollTimer = setInterval(pollUnreadDiff, POLL_INTERVAL)
}

function stopPollingFallback() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function pollUnreadDiff() {
  try {
    const res = await getUnreadCount()
    if (res.code !== 0) return
    const current = res.data?.count ?? 0
    if (current > lastUnreadCount && lastUnreadCount > 0) {
      // 有新通知产生，但不知道详情，发一个通用通知
      notify('info', '新通知', `您有 ${current - lastUnreadCount} 条新通知`, {})
    }
    lastUnreadCount = current
    // 同步 bell
    if (unreadPollCb) unreadPollCb()
  } catch { /* 静默 */ }
}

// ---- 初始化 & 销毁 ----

export function initNotificationToast(onUnreadChange) {
  if (initialized) return
  initialized = true

  unreadPollCb = onUnreadChange || null

  // Electron: 监听来自独立 toast 窗口的点击事件
  if (window.electronAPI?.onToastClick) {
    window.electronAPI.onToastClick((data) => {
      if (data.taskId) {
        readNotificationApi({ taskId: data.taskId }).catch(() => {})
      }
      const user = getUser()
      const role = user?.role
      const routeMap = {
        designer: '/designer/tasks',
        basic_designer: '/basic/tasks',
        operator_assistant: '/operator-assistant/tasks',
        operator: '/operator/tasks',
        cs_agent: '/cs/tasks',
        admin: '/admin/tasks',
        sub_admin: '/dashboard'
      }
      const target = routeMap[role]
      if (target && data.taskId) {
        router.push({ path: target, query: { openTask: data.taskId } })
      } else if (target && router.currentRoute.value.path !== target) {
        router.push(target)
      }
    })
  }

  // 初始化未读数基线
  getUnreadCount().then(res => {
    if (res.code === 0) lastUnreadCount = res.data?.count ?? 0
  }).catch(() => {})

  setupWebSocket()

  window.addEventListener('beforeunload', destroyNotificationToast)
}

export function destroyNotificationToast() {
  initialized = false

  for (const [id] of timerEntries) {
    clearToastTimers(id)
  }
  timerEntries.clear()
  dedupMap.clear()
  toasts.value = []

  if (socket) {
    socket.off('notification:new')
    socket.off('connect')
    socket.off('disconnect')
    socket.disconnect()
    socket = null
  }

  stopPollingFallback()
  lastUnreadCount = 0
  unreadPollCb = null

  window.removeEventListener('beforeunload', destroyNotificationToast)
}
