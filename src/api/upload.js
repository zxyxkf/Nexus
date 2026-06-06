/**
 * 文件工具 — URL 拼接 + Electron IPC 预览/下载 + 拖拽到桌面
 */
import { getToken } from '@/utils/auth'

// ==================== URL 工具 ====================

function getServerBase() {
  const stored = localStorage.getItem('design_server_url')
  if (stored) return stored
  if (location.protocol === 'file:') return 'http://127.0.0.1:18632'
  if (location.origin && location.origin !== 'null') return location.origin
  return 'http://192.168.101.78:18632'
}

function appendToken(url) {
  if (!url || !url.startsWith('/api/')) return url
  const token = getToken()
  if (!token) return url
  const sep = url.includes('?') ? '&' : '?'
  return url + sep + 'token=' + encodeURIComponent(token)
}

export function getFileUrl(fileOrPath) {
  if (!fileOrPath) return ''

  // File object with id → use preview API (files stored in Design_BOX dirs, not ./upload static)
  if (typeof fileOrPath === 'object' && fileOrPath.id) {
    return getServerBase() + appendToken(`/api/task/preview/${fileOrPath.id}`)
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
      return await window.electronAPI.previewImage({
        fileId, token,
        fileName: file.file_name || undefined
      })
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
  if (!file?.id || !file.file_name) return

  const token = getToken()
  if (!token) return

  const serverBase = getServerBase()
  const downloadUrl = `${serverBase}/api/task/download/${file.id}?token=${encodeURIComponent(token)}`
  event.dataTransfer.setData('DownloadURL', `application/octet-stream:${file.file_name}:${downloadUrl}`)
  event.dataTransfer.effectAllowed = 'copy'
}

export async function preloadFilesForDrag(files) {
  if (!files || files.length === 0) return
  if (!window.electronAPI?.prepareFileDrags) return

  const token = getToken()
  if (!token) return

  const items = files
    .filter(f => f.id && f.file_name)
    .map(f => ({ fileId: f.id, fileName: f.file_name }))

  if (items.length === 0) return

  try {
    await window.electronAPI.prepareFileDrags({ items, token })
  } catch (e) {
    console.warn('[API] 预加载拖拽文件失败:', e.message)
  }
}
