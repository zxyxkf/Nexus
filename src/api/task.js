import request from './http'

function emitTaskChanged(res) {
  if (typeof window !== 'undefined' && res?.code === 0) {
    window.dispatchEvent(new CustomEvent('nexus:task-updated', { detail: res }))
  }
  return res
}

function taskMutation(promise) {
  return promise.then(emitTaskChanged)
}

export const createTaskApi = (data) => taskMutation(request.post('/api/task/create', data))
export const publishTaskApi = ({ task, referenceFiles = [], materialStyleId = '', images = [] }) => {
  const formData = new FormData()
  formData.append('taskPayload', JSON.stringify(task || {}))
  const references = Array.from(referenceFiles || [])
  formData.append('referenceOriginalNames', JSON.stringify(references.map(file => String(file?.name || ''))))
  references.forEach((file, index) => {
    formData.append('references', file, safeMultipartFilename(file?.name, index))
  })

  const manifest = images.map(({ image, position, edited }) => {
    const editedField = edited?.file ? `edited-${image.id}` : ''
    if (editedField) formData.append(editedField, edited.file, safeMultipartFilename(edited.file.name, position))
    return {
      materialImageId: image.id,
      position,
      editedField,
      editedOriginalName: edited?.file?.name || ''
    }
  })
  formData.append('materialStyleId', materialStyleId || '')
  formData.append('styleManifest', JSON.stringify(manifest))
  return taskMutation(request.post('/api/task/publish', formData, { timeout: 600000 }))
}
export const snapshotMaterialImagesApi = (data) => taskMutation(request.post('/api/task/material-snapshot', data))

function safeMultipartFilename(name, index) {
  const rawName = String(name || '')
  const extension = rawName.match(/\.[A-Za-z0-9]{1,10}$/)?.[0].toLowerCase() || '.bin'
  return `nexus-upload-${index + 1}${extension}`
}

function appendSafeFiles(formData, files, fieldName = 'files') {
  const list = Array.from(files || [])
  formData.append('originalFileNames', JSON.stringify(list.map(file => String(file?.name || ''))))
  list.forEach((file, index) => {
    formData.append(fieldName, file, safeMultipartFilename(file?.name, index))
  })
  return list
}

export const saveStyleSnapshotsApi = ({ taskId, materialStyleId, images = [] }) => {
  const formData = new FormData()
  const manifest = images.map(({ image, position, edited }) => {
    const editedField = edited?.file ? `edited-${image.id}` : ''
    if (editedField) formData.append(editedField, edited.file, safeMultipartFilename(edited.file.name, position))
    return {
      materialImageId: image.id,
      position,
      editedField,
      editedOriginalName: edited?.file?.name || ''
    }
  })
  formData.append('taskId', taskId)
  formData.append('materialStyleId', materialStyleId)
  formData.append('manifest', JSON.stringify(manifest))
  return taskMutation(request.post('/api/task/style-snapshots', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000
  }))
}
export const resolveBatchSubmitApi = files => request.post('/api/task/batch-submit/resolve', { files })
export const getMyPublishedApi = (params) => request.get('/api/task/my-published', { params })
export const getMyAcceptedApi = (params) => request.get('/api/task/my-accepted', { params })
export const getTaskHallApi = (params) => request.get('/api/task/hall', { params })
export const searchTasksApi = (params) => request.get('/api/task/search', { params })
export const acceptTaskApi = (data) => taskMutation(request.post('/api/task/accept', data))

export const uploadFilesApi = (taskId, files, fileCategory = 'work', extraData = {}) => {
  const formData = new FormData()
  formData.append('taskId', taskId)
  formData.append('fileCategory', fileCategory)
  if (extraData.actualQuantity) formData.append('actualQuantity', extraData.actualQuantity)
  if (extraData.appliedScore !== undefined) formData.append('appliedScore', extraData.appliedScore)
  if (Object.prototype.hasOwnProperty.call(extraData, 'workPath')) {
    formData.append('workPath', extraData.workPath ?? '')
  }
  if (extraData.saveOnly !== undefined) formData.append('saveOnly', extraData.saveOnly ? '1' : '0')
  if (extraData.replaceExisting !== undefined) formData.append('replaceExisting', extraData.replaceExisting ? '1' : '0')
  if (extraData.rejectRecordId !== undefined && extraData.rejectRecordId !== null) {
    formData.append('rejectRecordId', extraData.rejectRecordId)
  }
  if (Object.prototype.hasOwnProperty.call(extraData, 'modificationReply')) {
    formData.append('modificationReply', extraData.modificationReply ?? '')
  }
  if (Object.prototype.hasOwnProperty.call(extraData, 'retainedFileIds')) {
    formData.append('retainedFileIds', JSON.stringify(extraData.retainedFileIds || []))
  }
  appendSafeFiles(formData, files)
  return taskMutation(request.post('/api/task/upload-files', formData, {
    timeout: 120000,
    onUploadProgress: extraData.onUploadProgress
  }))
}
export const finishTaskApi = (data) => taskMutation(request.post('/api/task/finish', data))
export const transferTaskApi = (data) => taskMutation(request.post('/api/task/transfer', data))
export const reviewTaskApi = (data) => taskMutation(request.post('/api/task/review', data))
export const requestCsModificationApi = ({ taskId, note = '', files = [] }) => {
  const formData = new FormData()
  formData.append('taskId', taskId)
  formData.append('note', note)
  appendSafeFiles(formData, files)
  return taskMutation(request.post('/api/task/request-modification', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000
  }))
}
export const completeCsModificationApi = ({
  taskId,
  rejectRecordId,
  reply = '',
  appliedScore = 1,
  retainedFileIds = [],
  files = []
}) => {
  const formData = new FormData()
  formData.append('taskId', taskId)
  formData.append('rejectRecordId', rejectRecordId)
  formData.append('reply', reply)
  formData.append('appliedScore', appliedScore)
  formData.append('retainedFileIds', JSON.stringify(retainedFileIds))
  appendSafeFiles(formData, files)
  return taskMutation(request.post('/api/task/complete-modification', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000
  }))
}

export const uploadOriginalFilesApi = (taskId, files, extraData = {}) => {
  const formData = new FormData()
  formData.append('taskId', taskId)
  appendSafeFiles(formData, files)
  return taskMutation(request.post('/api/task/upload-original', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    onUploadProgress: extraData.onUploadProgress
  }))
}
export const completeOriginalUploadApi = (taskId) => taskMutation(
  request.post('/api/task/complete-original-upload', { taskId })
)
export const reviewOriginalTaskApi = (data) => taskMutation(request.post('/api/task/review-original', data))
export const withdrawOriginalTaskApi = (data) => taskMutation(request.post('/api/task/withdraw-original', data))
export const getAllTasksApi = (params) => request.get('/api/task/all', { params })
export const getTaskDetailApi = (params) => request.get('/api/task/detail', { params })
export const getMyStatsApi = () => request.get('/api/task/stats/my')
export const getDashboardStatsApi = () => request.get('/api/task/stats/dashboard')
export const getAdminDetailStatsApi = () => request.get('/api/task/stats/admin/detail')
export const withdrawTaskApi = (data) => taskMutation(request.post('/api/task/withdraw', data))
export const undoSubmitApi = (data) => taskMutation(request.post('/api/task/undo-submit', data))
export const updateTaskApi = (data) => taskMutation(request.put('/api/task/update', data))
export const reopenFinishedCsTaskApi = (data) => taskMutation(request.post('/api/task/reopen-finished-cs', data))
export const updateCsTaskNoApi = (data) => taskMutation(request.put('/api/task/cs-task-no', data))
export const batchReviewApi = (data) => taskMutation(request.post('/api/task/batch-review', data))
export const deleteTaskApi = (data) => taskMutation(request.post('/api/task/delete', data))
export const batchDeleteApi = (data) => taskMutation(request.post('/api/task/batch-delete', data))
export const batchReassignApi = (data) => taskMutation(request.post('/api/task/batch-reassign', data))
export const batchDownloadFilesApi = (params) => request.get('/api/task/batch-download', { params, responseType: 'blob', timeout: 120000 })
