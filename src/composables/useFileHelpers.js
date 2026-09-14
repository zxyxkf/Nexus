/**
 * 文件辅助函数 — 从 files 数组中筛选各类文件
 *
 * 用法:
 *   const { getRefImages, getRefAttachments, getWorkFiles, getFirstImage,
 *           getImageSrcList, getRefImageSrcList, downloadFile } = useFileHelpers()
 */

import { getFilePreviewUrl, getFileUrl, getTaskThumbnailUrl, saveFileToDisk } from '@/api'

const taskListFileGroups = new WeakMap()

export function useFileHelpers() {
  function isCurrentWorkFile(file) {
    return file &&
      file.file_category !== 'reference' &&
      file.file_category !== 'reject' &&
      file.file_category !== 'style' &&
      file.file_category !== 'original'
  }

  function getRefImages(files) {
    return getRefFiles(files).filter(f => f.file_type === 'image')
  }

  function getRefAttachments(files) {
    return getRefFiles(files).filter(f => f.file_type !== 'image')
  }

  function getRefFiles(files) {
    if (!files || !files.length) return []
    return files.filter(f => f.file_category === 'reference')
  }

  function getWorkFiles(files) {
    if (!files || !files.length) return []
    return files
      .map((file, index) => ({ file, index }))
      .filter(item => isCurrentWorkFile(item.file))
      .sort((left, right) => {
        const leftIsModification = Number(left.file.reject_record_id) > 0
        const rightIsModification = Number(right.file.reject_record_id) > 0
        if (leftIsModification !== rightIsModification) return leftIsModification ? -1 : 1
        if (leftIsModification) {
          const leftRound = Number(left.file.reject_index) || Number(left.file.reject_record_id) || 0
          const rightRound = Number(right.file.reject_index) || Number(right.file.reject_record_id) || 0
          if (leftRound !== rightRound) return rightRound - leftRound
        }
        return left.index - right.index
      })
      .map(item => item.file)
  }

  function getFirstImage(files) {
    return getWorkFiles(files).find(file => file.file_type === 'image') || null
  }

  function getInitialWorkFiles(files) {
    return (files || []).filter(file => file.file_category === 'work' && !Number(file.reject_record_id))
  }

  function getEffectFiles(files) {
    const selected = (files || []).filter(file => (
      file.file_category === 'work' &&
      file.file_type === 'image' &&
      file.is_selected_effect
    ))
    if (selected.length) return selected

    const modifications = (files || [])
      .filter(file => file.file_category === 'work' && Number(file.reject_record_id) > 0)
      .sort((left, right) => {
        const leftRound = Number(left.reject_index) || Number(left.reject_record_id) || 0
        const rightRound = Number(right.reject_index) || Number(right.reject_record_id) || 0
        return rightRound - leftRound || Number(left.id || 0) - Number(right.id || 0)
      })
    if (!modifications.length) return getInitialWorkFiles(files)
    const latestRound = Number(modifications[0].reject_index)
      || Number(modifications[0].reject_record_id)
      || 0
    return modifications.filter(file => (
      (Number(file.reject_index) || Number(file.reject_record_id) || 0) === latestRound
    ))
  }

  function getOriginalFiles(files) {
    return (files || [])
      .filter(file => file.file_category === 'original')
      .sort((left, right) => new Date(left.create_time || 0) - new Date(right.create_time || 0)
        || Number(left.id || 0) - Number(right.id || 0))
  }

  function getImageSrcList(files) {
    return getWorkFiles(files).filter(file => file.file_type === 'image').map(file => getFileUrl(file))
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

  function getTaskListFileGroups(files) {
    if (!Array.isArray(files)) return createTaskListFileGroups([])
    const cached = taskListFileGroups.get(files)
    if (cached) return cached
    const groups = createTaskListFileGroups(files)
    taskListFileGroups.set(files, groups)
    return groups
  }

  function createTaskListFileGroups(files) {
    const styleImages = files.filter(file => file.file_category === 'style' && file.file_type === 'image')
    const refFiles = getRefFiles(files)
    const refImages = refFiles.filter(file => file.file_type === 'image')
    const refAttachments = refFiles.filter(file => file.file_type !== 'image')
    const workFiles = getWorkFiles(files)
    const workImages = workFiles.filter(file => file.file_type === 'image')
    const effectFiles = getEffectFiles(files)
    const effectImages = effectFiles.filter(file => file.file_type === 'image')
    const originalFiles = getOriginalFiles(files)
    const originalImages = originalFiles.filter(file => file.file_type === 'image')

    return {
      styleImages,
      styleThumbnailUrl: getTaskThumbnailUrl(styleImages[0]),
      stylePreviewUrls: styleImages.map(getFilePreviewUrl),
      refFiles,
      refImages,
      refAttachments,
      refThumbnailUrl: getTaskThumbnailUrl(refImages[0]),
      refPreviewUrls: refImages.map(getFilePreviewUrl),
      workFiles,
      workImages,
      workThumbnailUrl: getTaskThumbnailUrl(workImages[0]),
      workPreviewUrls: workImages.map(getFilePreviewUrl),
      effectFiles,
      effectImages,
      effectThumbnailUrl: getTaskThumbnailUrl(effectImages[0]),
      effectPreviewUrls: effectImages.map(getFilePreviewUrl),
      originalFiles,
      originalImages,
      originalThumbnailUrl: getTaskThumbnailUrl(originalImages[0]),
      originalPreviewUrls: originalImages.map(getFilePreviewUrl)
    }
  }

  function downloadFile(file) {
    saveFileToDisk(file)
  }

  return {
    getRefImages,
    getRefAttachments,
    getRefFiles,
    getWorkFiles,
    getInitialWorkFiles,
    getEffectFiles,
    getOriginalFiles,
    getFirstImage,
    getImageSrcList,
    getRefImageSrcList,
    getTaskListFileGroups,
    getImagePreviewIndex,
    downloadFile
  }
}
