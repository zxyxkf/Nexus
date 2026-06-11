/**
 * 文件辅助函数 — 从 files 数组中筛选各类文件
 *
 * 用法:
 *   const { getRefImages, getRefAttachments, getWorkFiles, getFirstImage,
 *           getImageSrcList, getRefImageSrcList, downloadFile } = useFileHelpers()
 */

import { getFileUrl, saveFileToDisk } from '@/api'

export function useFileHelpers() {
  function isCurrentWorkFile(file) {
    return file &&
      file.file_category !== 'reference' &&
      file.file_category !== 'reject'
  }

  function getRefImages(files) {
    if (!files || !files.length) return []
    return files.filter(f => f.file_category === 'reference' && f.file_type === 'image')
  }

  function getRefAttachments(files) {
    if (!files || !files.length) return []
    return files.filter(f => f.file_category === 'reference' && f.file_type !== 'image')
  }

  function getWorkFiles(files) {
    if (!files || !files.length) return []
    return files.filter(isCurrentWorkFile)
  }

  function getFirstImage(files) {
    if (!files || !files.length) return null
    return files.find(f => isCurrentWorkFile(f) && f.file_type === 'image') || null
  }

  function getImageSrcList(files) {
    if (!files) return []
    return files.filter(f => isCurrentWorkFile(f) && f.file_type === 'image').map(f => getFileUrl(f))
  }

  function getRefImageSrcList(files) {
    return getRefImages(files).map(f => getFileUrl(f))
  }

  function getImagePreviewIndex(files, currentFile, fallbackIndex = 0) {
    const imageFiles = (files || []).filter(f => f.file_type === 'image')
    const index = imageFiles.findIndex(f => {
      if (f === currentFile) return true
      if (f && currentFile && f.id != null && currentFile.id != null) return f.id === currentFile.id
      return false
    })
    return index >= 0 ? index : fallbackIndex
  }

  function downloadFile(file) {
    saveFileToDisk(file)
  }

  return { getRefImages, getRefAttachments, getWorkFiles, getFirstImage, getImageSrcList, getRefImageSrcList, getImagePreviewIndex, downloadFile }
}
