import request from './http'

export const getScoreItemsApi = (params) => request.get('/api/score/items', { params })
export const getScoreRecordsApi = (params) => request.get('/api/score/records', { params })
export const saveScoreItemApi = (data) => request.post('/api/score/save', data)
export const deleteScoreItemApi = (data) => request.post('/api/score/delete', data)
export const getScoreReviewListApi = (params) => request.get('/api/score/review/list', { params })
export const getScoreReviewRecordsApi = (params) => request.get('/api/score/review/records', { params })
export const approveScoreReviewApi = (data) => request.post('/api/score/review/approve', data)
export const rejectScoreReviewApi = (data) => request.post('/api/score/review/reject', data)
