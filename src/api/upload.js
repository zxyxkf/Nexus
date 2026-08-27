/**
 * 文件工具 — URL 拼接 + Electron IPC 预览/下载 + 拖拽到桌面
 */
import { getToken } from '@/utils/auth'
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
const preloadingDragFileIds = new Set()
let imageDragBridgeReady = false

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

function registerDragFileUrl(url, file) {
  if (!url || !file?.id || !file.file_name) return
  dragFileByUrl.set(url, file)
  dragFileByUrl.set(normalizeDragUrl(url), file)
  prepareFileDragCache(file)
  ensureImageDragBridge()
}

export function registerFileDragUrl(url, file) {
  registerDragFileUrl(url, file)
  return url
}

function findDragFileByUrl(url) {
  if (!url) return null
  return dragFileByUrl.get(url) || dragFileByUrl.get(normalizeDragUrl(url)) || null
}

function getFileDownloadUrl(file) {
  if (!file?.id || !file.file_name) return ''

  const token = getToken()
  if (!token) return ''

  const serverBase = getServerBase()
  const path = `/api/task/download/${file.id}?token=${encodeURIComponent(token)}`
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

function applyFileDragData(event, file) {
  if (!event?.dataTransfer) return ''

  const downloadUrl = getFileDownloadUrl(file)
  if (!downloadUrl) return ''

  const fileName = String(file.file_name)
  const safeFileName = fileName.replace(/[\r\n:]/g, '_')
  setDragData(event.dataTransfer, 'DownloadURL', `application/octet-stream:${safeFileName}:${downloadUrl}`)
  setDragData(event.dataTransfer, 'text/uri-list', downloadUrl)
  setDragData(event.dataTransfer, 'text/plain', downloadUrl)
  setDragData(event.dataTransfer, 'text/x-moz-url', `${downloadUrl}\n${fileName}`)
  setDragData(event.dataTransfer, 'text/html', `<a href="${escapeHtml(downloadUrl)}" download="${escapeHtml(fileName)}">${escapeHtml(fileName)}</a>`)
  event.dataTransfer.effectAllowed = 'copy'
  return downloadUrl
}

function prepareFileDragCache(file) {
  if (!file?.id || !file.file_name) return
  if (!window.electronAPI?.prepareFileDrags) return

  const fileId = String(file.id)
  if (preloadingDragFileIds.has(fileId)) return
  preloadingDragFileIds.add(fileId)

  Promise.resolve(preloadFilesForDrag([file])).then(success => {
    if (!success) preloadingDragFileIds.delete(fileId)
  }).catch(() => {
    preloadingDragFileIds.delete(fileId)
  })
}

function tryElectronFileDrag(file) {
  if (!file?.id || !file.file_name || !window.electronAPI) return false

  try {
    if (window.electronAPI.isFileCached?.(file.id)) {
      const dragged = window.electronAPI.doFileDrag?.(file.id)
      if (dragged) return true
    }
  } catch (e) {
    console.warn('[API] Electron 原生拖拽触发失败:', e.message)
  }

  prepareFileDragCache(file)
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

  document.addEventListener('dragstart', event => {
    const file = getImageDragFile(event.target)
    if (!file) return
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
        fileName: file.file_name || undefined
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

export function setupFileDrag(event, file) {
  if (event?.__nexusFileDragHandled) return ''
  if (event) event.__nexusFileDragHandled = true

  const downloadUrl = applyFileDragData(event, file)
  if (tryElectronFileDrag(file)) {
    event?.preventDefault?.()
  }
  return downloadUrl
}

export async function preloadFilesForDrag(files) {
  if (!files || files.length === 0) return false
  if (!window.electronAPI?.prepareFileDrags) return false

  const token = getToken()
  if (!token) return false

  const items = files
    .filter(f => f.id && f.file_name)
    .map(f => ({ fileId: f.id, fileName: f.file_name }))

  if (items.length === 0) return false

  try {
    await window.electronAPI.prepareFileDrags({ items, token })
    return true
  } catch (e) {
    console.warn('[API] 预加载拖拽文件失败:', e.message)
    return false
  }
}
