/**
 * Pinia 缓存工具 — 基于时间戳的轻量请求缓存
 * 使用方式: cache.withCache(store, 'key', fetchFn, ttlMs)
 */

const DEFAULT_TTL = 5 * 60 * 1000 // 5 分钟

function withCache(store, key, fetchFn, ttl = DEFAULT_TTL) {
  const cacheKey = `_cache_${key}`
  const now = Date.now()

  const entry = store[cacheKey]
  if (entry && now - entry.ts < ttl) {
    return Promise.resolve(entry.data)
  }

  return fetchFn().then(data => {
    store[cacheKey] = { data, ts: now }
    return data
  })
}

function invalidate(store, key) {
  const cacheKey = `_cache_${key}`
  delete store[cacheKey]
}

function invalidateAll(store) {
  Object.keys(store).forEach(k => {
    if (k.startsWith('_cache_')) delete store[k]
  })
}

export { withCache, invalidate, invalidateAll }
