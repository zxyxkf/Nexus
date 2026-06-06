/**
 * 文件辅助函数 — 从 files 数组中筛选各类文件
 *
 * 用法:
 *   const { getRefImages, getRefAttachments, getWorkFiles, getFirstImage,
 *           getImageSrcList, getRefImageSrcList, downloadFile } = useFileHelpers()
 */

import { getFileUrl, saveFileToDisk } from '@/api'

export function useFileHelpers() {
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
    return files.filter(f => f.file_category !== 'reference')
  }

  function getFirstImage(files) {
    if (!files || !files.length) return null
    return files.find(f => f.file_category !== 'reference' && f.file_type === 'image') || null
  }

  function getImageSrcList(files) {
    if (!files) return []
    return files.filter(f => f.file_category !== 'reference' && f.file_type === 'image').map(f => getFileUrl(f))
  }

  function getRefImageSrcList(files) {
    return getRefImages(files).map(f => getFileUrl(f))
  }

  function downloadFile(file) {
    saveFileToDisk(file)
  }

  return { getRefImages, getRefAttachments, getWorkFiles, getFirstImage, getImageSrcList, getRefImageSrcList, downloadFile }
}
