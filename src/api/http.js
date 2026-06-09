/**
 * HTTP 客户端 — axios 实例 + 拦截器 + 健康检查 + 重试
 */
import axios from 'axios'
import { getToken, getRefreshToken, setToken, setRefreshToken, setUser, clearAuth, setAuth } from '@/utils/auth'
import { ElMessage } from 'element-plus'
import router from '@/router'

// ==================== 连接状态管理 ====================

let isOnline = navigator.onLine
let reconnectTimer = null
let healthTimer = null
const onStatusChange = []

// ==================== Token 刷新状态 ====================

let isRefreshing = false
let refreshSubscribers = []
let proactiveRefreshTimer = null

function onRefreshed(newToken) {
  refreshSubscribers.forEach(cb => cb(newToken))
  refreshSubscribers = []
}

function addRefreshSubscriber(cb) {
  refreshSubscribers.push(cb)
}

function applyRefreshedAuth(token, user) {
  if (user) setAuth(token, user)
  else setToken(token)
}

function getTokenExpiry(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 // ms
  } catch { return 0 }
}

function scheduleProactiveRefresh(token) {
  clearTimeout(proactiveRefreshTimer)
  if (!token) return
  const exp = getTokenExpiry(token)
  if (!exp) return
  const delay = exp - Date.now() - 120_000 // 提前 2 分钟
  if (delay <= 0) return

  proactiveRefreshTimer = setTimeout(async () => {
    try {
      const rt = getRefreshToken()
      if (!rt) return
      const res = await request.post('/api/auth/refresh', { refreshToken: rt })
      if (res.code === 0) {
        applyRefreshedAuth(res.data.token, res.data.user)
        scheduleProactiveRefresh(res.data.token)
      }
    } catch { /* 静默失败，等 401 兜底 */ }
  }, delay)
}

async function doRefreshToken() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  try {
    const res = await request.post('/api/auth/refresh', { refreshToken })
    if (res.code === 0) {
      applyRefreshedAuth(res.data.token, res.data.user)
      scheduleProactiveRefresh(res.data.token)
      return res.data.token
    }
  } catch { /* 刷新失败 */ }
  return null
}

export function getOnlineStatus() { return isOnline }
export function onConnectionChange(fn) { onStatusChange.push(fn) }

function setOnline(val) {
  if (isOnline === val) return
  isOnline = val
  onStatusChange.forEach(fn => fn(val))
}

async function checkHealth() {
  try {
    const stored = localStorage.getItem('design_server_url') || 'http://127.0.0.1:18632'
    await axios.get(stored + '/api/health', { timeout: 5000 })
    setOnline(true)
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
  } catch {
    setOnline(false)
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => { reconnectTimer = null; checkHealth() }, 5000)
    }
  }
}

window.addEventListener('online', () => {
  setOnline(true)
  checkHealth()
})
window.addEventListener('offline', () => {
  setOnline(false)
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !isOnline) {
    checkHealth()
  }
})

checkHealth()
healthTimer = setInterval(checkHealth, 30000)

// ==================== Axios 实例 ====================

const request = axios.create({
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// ==================== 请求拦截器 ====================

request.interceptors.request.use(
  config => {
    const stored = localStorage.getItem('design_server_url')
    if (stored) {
      config.baseURL = stored
    } else if (!import.meta.env.DEV) {
      config.baseURL = 'http://192.168.101.78:18632'
    }

    const token = getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
      scheduleProactiveRefresh(token)
    }
    return config
  },
  error => Promise.reject(error)
)

// ==================== 响应拦截器（含重试） ====================

const errorTimestamps = new Map()

request.interceptors.response.use(
  async response => {
    const res = response.data
    if (res.code === 401) {
      if (response.config.url === '/api/auth/login' || response.config.url === '/api/auth/refresh') {
        return res
      }

      // 已有刷新进行中 → 排队等待
      if (isRefreshing) {
        return new Promise(resolve => {
          addRefreshSubscriber(newToken => {
            response.config.headers.Authorization = `Bearer ${newToken}`
            resolve(request(response.config))
          })
        })
      }

      // 开始刷新
      isRefreshing = true
      const newToken = await doRefreshToken()
      isRefreshing = false

      if (newToken) {
        onRefreshed(newToken)
        response.config.headers.Authorization = `Bearer ${newToken}`
        return request(response.config)
      }

      // 刷新失败 → 踢回登录
      onRefreshed(null)
      clearAuth()
      router.push('/login')
      ElMessage.error('登录已过期，请重新登录')
      return Promise.reject(new Error(res.msg || '未登录'))
    }
    if (res.code === 403) {
      ElMessage.error(res.msg || '权限不足')
      return Promise.reject(new Error(res.msg))
    }
    return res
  },
  async error => {
    const config = error.config
    const httpStatus = error.response?.status

    // ---- Token 刷新（HTTP 401） ----
    if (httpStatus === 401 && config.url !== '/api/auth/login' && config.url !== '/api/auth/refresh') {
      if (isRefreshing) {
        return new Promise(resolve => {
          addRefreshSubscriber(newToken => {
            if (!newToken) {
              resolve(Promise.reject(error))
              return
            }
            config.headers.Authorization = `Bearer ${newToken}`
            resolve(request(config))
          })
        })
      }

      isRefreshing = true
      const newToken = await doRefreshToken()
      isRefreshing = false

      if (newToken) {
        onRefreshed(newToken)
        config.headers.Authorization = `Bearer ${newToken}`
        return request(config)
      }

      // 刷新失败 → 踢回登录
      onRefreshed(null)
      clearAuth()
      router.push('/login')
      ElMessage.error('登录已过期，请重新登录')
      return Promise.reject(error)
    }

    // ---- 重试逻辑 ----
    const isNetworkError = !error.response
    const method = (config.method || 'get').toLowerCase()
    const isRetryableServerError = httpStatus >= 500 && method === 'get'

    if (isNetworkError || isRetryableServerError) {
      config.__retryCount = config.__retryCount || 0
      if (config.__retryCount < 2) {
        config.__retryCount++
        const delay = config.__retryCount * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
        return request(config)
      }
    }
    // ---- 重试逻辑结束 ----

    const now = Date.now()
    let msg = '网络异常，请检查连接'

    if (error.response) {
      const s = error.response.status
      if (s === 400) msg = '请求参数错误'
      else if (s === 401) msg = '未登录或Token已过期'
      else if (s === 403) msg = '权限不足'
      else if (s === 404) msg = '资源不存在'
      else if (s === 500) msg = '服务器内部错误'
      else msg = `服务异常 (${s})`
    } else if (error.code === 'ECONNABORTED') {
      msg = '请求超时'
    }

    const last = errorTimestamps.get(msg) || 0
    if (now - last > 3000) {
      errorTimestamps.set(msg, now)
      console.warn('[API]', msg)
      ElMessage.error(msg)
    }
    return Promise.reject(error)
  }
)

export default request
