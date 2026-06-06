import { ElMessage } from 'element-plus'

let pasteUid = Date.now()

const EXT_BY_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp'
}

function buildFileName(prefix, mimeType) {
  const ext = EXT_BY_MIME[mimeType] || 'png'
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return `${prefix}-${stamp}.${ext}`
}

function getClipboardImageFiles(event, prefix) {
  const items = Array.from(event.clipboardData?.items || [])
  return items
    .filter(item => item.kind === 'file' && item.type?.startsWith('image/'))
    .map(item => {
      const blob = item.getAsFile()
      if (!blob) return null
      return new File([blob], buildFileName(prefix, blob.type), {
        type: blob.type || 'image/png',
        lastModified: Date.now()
      })
    })
    .filter(Boolean)
}

function toUploadFile(file) {
  return {
    name: file.name,
    raw: file,
    uid: pasteUid++,
    status: 'ready',
    url: URL.createObjectURL(file)
  }
}

export function syncRawFiles(uploadFiles) {
  return (uploadFiles || []).map(file => file.raw).filter(Boolean)
}

export function appendClipboardImages(event, uploadListRef, rawListRef, options = {}) {
  const files = getClipboardImageFiles(event, options.prefix || 'pasted-image')
  if (!files.length) return false

  event.preventDefault()

  const current = uploadListRef.value || []
  const maxCount = Number(options.maxCount) || 0
  const maxSizeMB = Number(options.maxSizeMB) || 0
  const maxSize = maxSizeMB > 0 ? maxSizeMB * 1024 * 1024 : 0

  let accepted = files
  if (maxSize > 0) {
    const oversize = accepted.find(file => file.size > maxSize)
    accepted = accepted.filter(file => file.size <= maxSize)
    if (oversize) ElMessage.warning(`文件"${oversize.name}"超过${maxSizeMB}MB限制`)
  }

  if (maxCount > 0) {
    const room = maxCount - current.length
    if (room <= 0) {
      ElMessage.warning(`一次最多上传${maxCount}个文件`)
      return true
    }
    if (accepted.length > room) {
      accepted = accepted.slice(0, room)
      ElMessage.warning(`一次最多上传${maxCount}个文件，已添加前${room}张截图`)
    }
  }

  if (!accepted.length) return true

  uploadListRef.value = [...current, ...accepted.map(toUploadFile)]
  if (rawListRef) rawListRef.value = syncRawFiles(uploadListRef.value)
  ElMessage.success(`已添加${accepted.length}张截图`)
  return true
}
