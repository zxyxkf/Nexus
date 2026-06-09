/**
 * Token 管理工具
 */

const TOKEN_KEY = 'd_design_token'
const REFRESH_TOKEN_KEY = 'd_design_refresh_token'
const USER_KEY = 'd_design_user'
const AUTH_CHANGE_EVENT = 'nexus-auth-change'

function notifyAuthChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT))
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
  notifyAuthChange()
}

export function removeToken() {
  localStorage.removeItem(TOKEN_KEY)
  notifyAuthChange()
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setRefreshToken(token) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token)
}

export function removeRefreshToken() {
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function getUser() {
  const userStr = localStorage.getItem(USER_KEY)
  if (userStr) {
    try {
      return JSON.parse(userStr)
    } catch {
      return null
    }
  }
  return null
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  notifyAuthChange()
}

export function removeUser() {
  localStorage.removeItem(USER_KEY)
  notifyAuthChange()
}

export function clearAuth() {
  removeToken()
  removeRefreshToken()
  removeUser()
}

export function setAuth(token, user) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
  notifyAuthChange()
}

export function onAuthChange(callback) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(AUTH_CHANGE_EVENT, callback)
  return () => window.removeEventListener(AUTH_CHANGE_EVENT, callback)
}
