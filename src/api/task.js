import request from './http'

export const createTaskApi = (data) => request.post('/api/task/create', data)
export const getMyPublishedApi = (params) => request.get('/api/task/my-published', { params })
export const getMyAcceptedApi = (params) => request.get('/api/task/my-accepted', { params })
export const getTaskHallApi = (params) => request.get('/api/task/hall', { params })
export const searchTasksApi = (params) => request.get('/api/task/search', { params })
export const acceptTaskApi = (data) => request.post('/api/task/accept', data)
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
  files.forEach(file => formData.append('files', file))
  return request.post('/api/task/upload-files', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
    onUploadProgress: extraData.onUploadProgress
  })
}
export const finishTaskApi = (data) => request.post('/api/task/finish', data)
export const transferTaskApi = (data) => request.post('/api/task/transfer', data)
export const reviewTaskApi = (data) => request.post('/api/task/review', data)
export const getAllTasksApi = (params) => request.get('/api/task/all', { params })
export const getTaskDetailApi = (params) => request.get('/api/task/detail', { params })
export const getMyStatsApi = () => request.get('/api/task/stats/my')
export const getDashboardStatsApi = () => request.get('/api/task/stats/dashboard')
export const getAdminDetailStatsApi = () => request.get('/api/task/stats/admin/detail')
export const withdrawTaskApi = (data) => request.post('/api/task/withdraw', data)
export const undoSubmitApi = (data) => request.post('/api/task/undo-submit', data)
export const updateTaskApi = (data) => request.put('/api/task/update', data)
export const reopenFinishedCsTaskApi = (data) => request.post('/api/task/reopen-finished-cs', data)
export const updateCsTaskNoApi = (data) => request.put('/api/task/cs-task-no', data)
export const batchReviewApi = (data) => request.post('/api/task/batch-review', data)
export const deleteTaskApi = (data) => request.post('/api/task/delete', data)
export const batchDeleteApi = (data) => request.post('/api/task/batch-delete', data)
export const batchReassignApi = (data) => request.post('/api/task/batch-reassign', data)
export const batchDownloadFilesApi = (params) => request.get('/api/task/batch-download', { params, responseType: 'blob', timeout: 120000 })
