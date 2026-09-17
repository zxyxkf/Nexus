/**
 * 文件工具 — URL 拼接 + Electron IPC 预览/下载 + 拖拽到桌面
 */
import { getToken, getUser } from '@/utils/auth'
import { getServerBase as resolveServerBase } from '@/utils/server-base'

// ==================== URL 工具 ====================

function getServerBase() {
  return resolveServerBase()
}

function appendToken(url) {
  if (!url || !url.startsWith('/api/')) return url
  const token = getToken()
  if (!token) return url
  const sep = url.includes('?') ? '&' : '?'
  return url + sep + 'token=' + encodeURIComponent(token)
}

const dragFileByUrl = new Map()
const dragPreloadRequests = new Map()
const taskDragNames = new Map()
const taskDragNextIndexes = new Map()
let imageDragBridgeReady = false

const TASK_NUMBER_ROLES = new Set(['cs_agent', 'basic_designer'])
const DRAG_WATERMARK_VERSION = 'wm-v1'

function normalizeDragUrl(url) {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return url || ''
  try {
    const parsed = new URL(url, window.location?.href || undefined)
    parsed.searchParams.delete('token')
    return parsed.href
  } catch (e) {
    return url
  }
}

function registerDragFileUrl(url, file, options = {}) {
  if (!url || !file?.id || !file.file_name) return
  dragFileByUrl.set(url, file)
  dragFileByUrl.set(normalizeDragUrl(url), file)
  if (options.preloadDrag !== false) prepareFileDragCache(file)
  ensureImageDragBridge()
}

export function registerFileDragUrl(url, file, options = {}) {
  registerDragFileUrl(url, file, options)
  return url
}

function findDragFileByUrl(url) {
  if (!url) return null
  return dragFileByUrl.get(url) || dragFileByUrl.get(normalizeDragUrl(url)) || null
}

function getFileDownloadPath(file) {
  if (!file?.id) return ''
  if (typeof file.downloadUrl === 'string' && file.downloadUrl.startsWith('/api/')) {
    return file.downloadUrl
  }
  return `/api/task/download/${encodeURIComponent(file.id)}`
}

function getFileDownloadUrl(file) {
  if (!file?.id || !file.file_name) return ''

  const downloadPath = getFileDownloadPath(file)
  const token = getToken()
  if (!token) return ''

  const serverBase = getServerBase()
  const path = appendToken(downloadPath)
  try {
    return new URL(`${serverBase}${path}`, window.location?.href || undefined).href
  } catch (_) {
    return `${serverBase}${path}`
  }
}

function setDragData(dataTransfer, type, value) {
  try {
    dataTransfer.setData(type, value)
  } catch (_) {}
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function sanitizeDragFileName(fileName, fileId) {
  const fallback = `file-${String(fileId || 'download').replace(/[^a-zA-Z0-9_-]/g, '_')}`
  let safeName = String(fileName || '').trim()
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '')
  if (!safeName || safeName === '.' || safeName === '..') safeName = fallback
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i.test(safeName)) safeName = `_${safeName}`
  return safeName
}

function getDragNamingMode(options = {}) {
  if (options.namingMode === 'task' || options.namingMode === 'original') {
    return options.namingMode
  }
  return TASK_NUMBER_ROLES.has(getUser()?.role) ? 'task' : 'original'
}

function getFileExtension(fileName = '') {
  const match = String(fileName).match(/(\.[^./\\]+)$/)
  return match ? match[1] : ''
}

function getDragFileName(file, options = {}) {
  const originalName = file?.file_name || `file-${file?.id || 'download'}`
  if (getDragNamingMode(options) !== 'task') return originalName

  const taskNo = String(options.taskNo || file?.task_no || file?.taskNo || '').trim()
  if (!taskNo) return originalName

  const fileKey = `${taskNo}:${String(file.id || '')}`
  const existingName = taskDragNames.get(fileKey)
  if (existingName) return existingName

  const nextIndex = taskDragNextIndexes.get(taskNo) || 0
  const baseName = nextIndex === 0 ? taskNo : `${taskNo}_${nextIndex}`
  const dragName = `${baseName}${getFileExtension(originalName)}`
  taskDragNames.set(fileKey, dragName)
  taskDragNextIndexes.set(taskNo, nextIndex + 1)
  return dragName
}

function getDragWatermarkMetadata(file) {
  const role = getUser()?.role
  const label = String(file?.drag_watermark_label || '').trim()
  if (!TASK_NUMBER_ROLES.has(role) || file?.file_category !== 'work' || file?.file_type !== 'image' || !label) {
    return {}
  }
  return {
    watermarkText: label,
    watermarkVariant: `${DRAG_WATERMARK_VERSION}:${label}`
  }
}

function getElectronDragItem(file, options = {}, extra = {}) {
  return {
    fileId: file.id,
    fileName: getDragFileName(file, options),
    downloadPath: getFileDownloadPath(file),
    ...getDragWatermarkMetadata(file),
    ...extra
  }
}

function applyFileDragData(event, file) {
  if (!event?.dataTransfer) return ''

  const downloadUrl = getFileDownloadUrl(file)
  if (!downloadUrl) return ''

  const safeFileName = sanitizeDragFileName(file.file_name, file.id)
  setDragData(event.dataTransfer, 'DownloadURL', `application/octet-stream:${safeFileName}:${downloadUrl}`)
  setDragData(event.dataTransfer, 'text/uri-list', downloadUrl)
  setDragData(event.dataTransfer, 'text/plain', downloadUrl)
  setDragData(event.dataTransfer, 'text/x-moz-url', `${downloadUrl}\n${safeFileName}`)
  setDragData(event.dataTransfer, 'text/html', `<a href="${escapeHtml(downloadUrl)}" download="${escapeHtml(safeFileName)}">${escapeHtml(safeFileName)}</a>`)
  event.dataTransfer.effectAllowed = 'copy'
  return downloadUrl
}

function getDragPreloadKey(file, options = {}) {
  if (!file?.id || !file.file_name) return ''
  const item = getElectronDragItem(file, options)
  return `${String(item.fileId)}:${item.fileName}:${item.downloadPath}:${item.watermarkVariant || ''}`
}

function dispatchDragPreload(entry) {
  if (!entry || entry.dispatched) return entry?.promise
  entry.dispatched = true
  entry.promise = Promise.resolve(preloadFilesForDrag([entry.file], {
    ...entry.options,
    priority: entry.priority
  })).finally(() => {
    if (dragPreloadRequests.get(entry.key) === entry) {
      dragPreloadRequests.delete(entry.key)
    }
  })
  return entry.promise
}

function prepareFileDragCache(file, options = {}) {
  if (!file?.id || !file.file_name) return
  if (!window.electronAPI?.prepareFileDrags) return

  const key = getDragPreloadKey(file, options)
  const priority = options.priority === 'high' ? 'high' : 'normal'
  const existing = dragPreloadRequests.get(key)
  if (existing) {
    if (priority === 'high' && existing.priority !== 'high') {
      existing.priority = 'high'
      existing.promotionPromise = Promise.resolve(preloadFilesForDrag([existing.file], {
        ...existing.options,
        priority: 'high'
      })).finally(() => {
        existing.promotionPromise = null
      })
    }
    return existing.promotionPromise || existing.promise
  }

  const entry = {
    key,
    file,
    options: { ...options },
    priority,
    dispatched: false,
    promise: null,
    promotionPromise: null
  }
  dragPreloadRequests.set(key, entry)
  return dispatchDragPreload(entry)
}

function tryElectronFileDrag(file, options = {}) {
  if (!file?.id || !file.file_name || !window.electronAPI) return false
  const item = getElectronDragItem(file, options, { token: getToken() })

  try {
    if (window.electronAPI.isFileCached?.(item)) {
      const dragged = window.electronAPI.doFileDrag?.(item)
      if (dragged) return true
    }
  } catch (e) {
    console.warn('[API] Electron 原生拖拽触发失败:', e.message)
  }

  prepareFileDragCache(file, { ...options, priority: 'high' })
  return false
}

function getElectronDragItems(files, options = {}) {
  const uniqueItems = new Map()
  for (const file of Array.isArray(files) ? files : []) {
    if (!file?.id || !file.file_name) continue
    const item = getElectronDragItem(file, options, { token: getToken() })
    const key = `${item.fileId}:${item.fileName}:${item.downloadPath}:${item.watermarkVariant || ''}`
    if (!uniqueItems.has(key)) uniqueItems.set(key, item)
  }
  return Array.from(uniqueItems.values())
}

function tryElectronFilesDrag(files, options = {}) {
  if (!window.electronAPI?.isFileCached || !window.electronAPI?.doFileDrag) return false
  const items = getElectronDragItems(files, options)
  if (!items.length) return false

  try {
    if (window.electronAPI.isFileCached({ items })) {
      const dragged = window.electronAPI.doFileDrag({ items })
      if (dragged) return true
    }
  } catch (e) {
    console.warn('[API] Electron 批量原生拖拽触发失败:', e.message)
  }

  preloadFilesForDrag(files, { ...options, priority: 'high' })
  return false
}

function getImageDragFile(target) {
  if (!(target instanceof HTMLImageElement)) return null
  return findDragFileByUrl(target.currentSrc || target.src)
}

function primeImageDragTarget(target, file) {
  if (!(target instanceof HTMLImageElement) || !file) return
  target.draggable = true
  target.style.cursor = 'grab'
  target.style.webkitUserDrag = 'element'
  prepareFileDragCache(file)
}

function isPreviewImage(target) {
  return target.closest?.('.el-image-viewer__wrapper, .inline-work-preview')
}

function ensureImageDragBridge() {
  if (imageDragBridgeReady || typeof document === 'undefined') return
  imageDragBridgeReady = true

  document.addEventListener('mousedown', event => {
    if (event.button !== 0) return
    const file = getImageDragFile(event.target)
    if (!file) return
    if (!isPreviewImage(event.target) && !event.target.closest?.('[draggable="true"]')) return
    primeImageDragTarget(event.target, file)
    if (!isPreviewImage(event.target)) return
    event.stopImmediatePropagation()
  }, true)

  document.addEventListener('pointermove', event => {
    const file = getImageDragFile(event.target)
    if (file) prepareFileDragCache(file)
  }, true)

  document.addEventListener('dragstart', event => {
    const file = getImageDragFile(event.target)
    if (!file) return
    // List thumbnails delegate to their draggable container, which may represent a whole file group.
    if (event.target.parentElement?.closest?.('[draggable="true"]')) return
    setupFileDrag(event, file)
  }, true)
}

export function getFileUrl(fileOrPath) {
  if (!fileOrPath) return ''

  // File object with id → use preview API (files stored in Design_BOX dirs, not ./upload static)
  if (typeof fileOrPath === 'object' && fileOrPath.id) {
    const url = getServerBase() + appendToken(`/api/task/preview/${fileOrPath.id}`)
    registerDragFileUrl(url, fileOrPath)
    return url
  }

  const filePath = typeof fileOrPath === 'string' ? fileOrPath : (fileOrPath.fileUrl || fileOrPath.file_path || '')
  if (!filePath) return ''
  if (filePath.startsWith('http')) return filePath
  if (filePath.startsWith('/api/')) return getServerBase() + appendToken(filePath)
  if (filePath.startsWith('/upload/')) return getServerBase() + filePath
  return getServerBase() + '/upload/' + filePath
}

export function getFilePreviewUrl(fileOrPath) {
  if (!fileOrPath) return ''
  if (typeof fileOrPath === 'object' && fileOrPath.id) {
    const url = getServerBase() + appendToken(`/api/task/preview/${fileOrPath.id}`)
    registerDragFileUrl(url, fileOrPath, { preloadDrag: false })
    return url
  }
  return getFileUrl(fileOrPath)
}

export function getTaskThumbnailUrl(fileOrPath) {
  if (!fileOrPath) return ''
  if (typeof fileOrPath === 'object' && fileOrPath.id) {
    const url = getServerBase() + appendToken(`/api/task/thumbnail/${fileOrPath.id}`)
    registerDragFileUrl(url, fileOrPath, { preloadDrag: false })
    return url
  }
  return getFilePreviewUrl(fileOrPath)
}

export function downloadFile(fileOrPath) {
  const downloadUrl = typeof fileOrPath === 'object' ? fileOrPath.downloadUrl : null
  const url = getFileUrl(downloadUrl || fileOrPath)
  window.open(url, '_blank')
}

// ==================== Electron IPC 预览/下载 ====================

const isElectron = () => !!(window.electronAPI && window.electronAPI.previewImage && window.electronAPI.downloadFile)

export async function fetchImageDataUrl(file) {
  if (!file) return ''
  const fileId = file.id
  if (!fileId) return getFileUrl(file)

  if (isElectron()) {
    try {
      const token = getToken()
      if (!token) return getFileUrl(file)
      const previewUrl = await window.electronAPI.previewImage({
        fileId, token,
        fileName: getDragFileName(file)
      })
      registerDragFileUrl(previewUrl, file)
      registerDragFileUrl(getFileUrl(file), file)
      return previewUrl
    } catch (e) {
      console.warn('[API] IPC 预览失败，降级到 HTTP:', e.message)
      return getFileUrl(file)
    }
  }

  return getFileUrl(file)
}

export async function saveFileToDisk(file) {
  if (!file) return { success: false }

  if (isElectron()) {
    try {
      const token = getToken()
      if (!token) { downloadFile(file); return { success: false } }
      return await window.electronAPI.downloadFile({
        fileId: file.id,
        fileName: file.file_name || 'download',
        token
      })
    } catch (e) {
      console.warn('[API] IPC 下载失败，降级到浏览器:', e.message)
      downloadFile(file)
      return { success: false }
    }
  }

  downloadFile(file)
  return { success: true }
}

// ==================== 文件拖拽到桌面 ====================

export function setupFileDrag(event, file, options = {}) {
  if (event?.__nexusFileDragHandled) return ''
  if (event) event.__nexusFileDragHandled = true

  if (window.electronAPI?.doFileDrag) {
    if (tryElectronFileDrag(file, options)) {
      event?.preventDefault?.()
      return ''
    }
    event?.preventDefault?.()
    window.dispatchEvent(new CustomEvent('nexus:file-drag-pending'))
    return ''
  }

  return applyFileDragData(event, file)
}

export function setupFilesDrag(event, files, options = {}) {
  const validFiles = Array.from(files || []).filter(file => file?.id && file.file_name)
  if (!validFiles.length) return ''
  if (validFiles.length === 1) return setupFileDrag(event, validFiles[0], options)
  if (event?.__nexusFileDragHandled) return ''
  if (event) event.__nexusFileDragHandled = true

  if (window.electronAPI?.doFileDrag) {
    if (tryElectronFilesDrag(validFiles, options)) {
      event?.preventDefault?.()
      return ''
    }
    event?.preventDefault?.()
    window.dispatchEvent(new CustomEvent('nexus:file-drag-pending'))
    return ''
  }

  return applyFileDragData(event, validFiles[0])
}

export async function preloadFilesForDrag(files, options = {}) {
  if (!files || files.length === 0) return false
  if (!window.electronAPI?.prepareFileDrags) return false

  const token = getToken()
  if (!token) return false

  const items = files
    .filter(f => f.id && f.file_name)
    .map(f => getElectronDragItem(f, options, {
      priority: options.priority === 'high' ? 'high' : 'normal'
    }))

  if (items.length === 0) return false

  try {
    const result = await window.electronAPI.prepareFileDrags({ items, token })
    if (result?.success === false) {
      const watermarkFailed = Array.isArray(result.failures)
        && (result.failures.some(failure => failure?.code === 'watermark')
          || items.some(item => item.watermarkVariant))
      if (watermarkFailed && options.priority === 'high') {
        window.dispatchEvent(new CustomEvent('nexus:file-drag-watermark-error'))
      }
      return false
    }
    return true
  } catch (e) {
    console.warn('[API] 预加载拖拽文件失败:', e.message)
    if (options.priority === 'high' && items.some(item => item.watermarkVariant)) {
      window.dispatchEvent(new CustomEvent('nexus:file-drag-watermark-error'))
    }
    return false
  }
}
