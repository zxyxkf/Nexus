const DEFAULT_SERVER = 'http://192.168.101.78:18632'
const LOCAL_SERVER = 'http://127.0.0.1:18632'

export function shouldForceLocalApi() {
  return import.meta.env.DEV && import.meta.env.VITE_FORCE_LOCAL_API === '1'
}

export function getDefaultServerBase() {
  if (shouldForceLocalApi()) return ''
  if (location.protocol === 'file:') return LOCAL_SERVER
  if (location.origin && location.origin !== 'null') return location.origin
  return DEFAULT_SERVER
}

export function getStoredServerBase() {
  if (shouldForceLocalApi()) return ''
  return localStorage.getItem('design_server_url') || ''
}

export function getServerBase(fallback = getDefaultServerBase()) {
  return getStoredServerBase() || fallback
}

export { DEFAULT_SERVER, LOCAL_SERVER }
