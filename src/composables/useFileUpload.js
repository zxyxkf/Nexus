/**
 * 文件上传 composable — 上传队列 / 进度 / 预览 / 删除
 *
 * 用法:
 *   const { fileList, uploading, uploadFiles, removeFile, resetFiles } = useFileUpload()
 */

import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'

const MAX_SIZE = 50 * 1024 * 1024 // 50MB

export function useFileUpload() {
  const fileList = ref([])
  const uploading = ref(false)

  const hasFiles = computed(() => fileList.value.length > 0)
  const totalSize = computed(() => fileList.value.reduce((s, f) => s + (f.size || 0), 0))

  function validateFile(file) {
    if (file.size > MAX_SIZE) {
      ElMessage.warning(`文件 ${file.name} 超过 50MB 限制`)
      return false
    }
    return true
  }

  function addFiles(files) {
    const valid = files.filter(validateFile)
    fileList.value.push(...valid)
  }

  function removeFile(index) {
    fileList.value.splice(index, 1)
  }

  function resetFiles() {
    fileList.value = []
  }

  function getFormData() {
    const fd = new FormData()
    fileList.value.forEach(f => fd.append('files', f))
    return fd
  }

  function formatSize(bytes) {
    if (!bytes) return '0 B'
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  return {
    fileList, uploading, hasFiles, totalSize,
    addFiles, removeFile, resetFiles, getFormData, formatSize
  }
}
