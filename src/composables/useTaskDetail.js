import { ref } from 'vue'
import { getTaskDetailApi, fetchImageDataUrl, preloadFilesForDrag } from '@/api'

function defaultNormalizeDetail(data = {}) {
  const files = data.files || []
  const rejectRecords = data.reject_records || []
  return { ...data, files, reject_records: rejectRecords }
}

function defaultCollectPreloadFiles(detail = {}) {
  const files = detail.files || []
  const rejectFiles = (detail.reject_records || []).flatMap(record => record.files || [])
  return [...files, ...rejectFiles]
}

export function useTaskDetail(options = {}) {
  const detailVisible = ref(false)
  const currentTask = ref(null)
  const loadingDetail = ref(false)

  const {
    getTaskId = row => row?.id,
    normalizeDetail,
    mergeDetail,
    collectPreloadFiles = defaultCollectPreloadFiles,
    collectPreviewFiles,
    onLoaded,
    onError
  } = options

  const normalize = normalizeDetail || mergeDetail || defaultNormalizeDetail

  async function openDetail(row) {
    loadingDetail.value = true
    try {
      const res = await getTaskDetailApi({ taskId: getTaskId(row) })
      if (res.code === 0) {
        const detail = normalize(res.data || {}, row, res)
        const preloadFiles = collectPreloadFiles(detail, res.data || {}, row, res) || []
        const previewFiles = (collectPreviewFiles || collectPreloadFiles)(detail, res.data || {}, row, res) || []
        const imageFiles = previewFiles.filter(file => file?.file_type === 'image')
        await Promise.all(imageFiles.map(async (file) => {
          file._previewSrc = await fetchImageDataUrl(file)
        }))
        preloadFilesForDrag(preloadFiles)
        onLoaded?.(detail, row, res)
        currentTask.value = detail
        detailVisible.value = true
      }
      return res
    } catch (error) {
      if (onError) {
        onError(error, row)
      } else {
        console.error('[useTaskDetail] Failed to load task detail:', error)
      }
      return null
    } finally {
      loadingDetail.value = false
    }
  }

  function closeDetail() {
    detailVisible.value = false
  }

  function setCurrentTask(task) {
    currentTask.value = task
  }

  return {
    detailVisible,
    currentTask,
    loadingDetail,
    openDetail,
    closeDetail,
    setCurrentTask
  }
}
