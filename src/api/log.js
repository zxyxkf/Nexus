import request from './http'

export const getLogListApi = (params) => request.get('/api/log/list', { params })
export const getOperationTypesApi = () => request.get('/api/log/operations')
export const batchDeleteLogsApi = (data) => request.post('/api/log/batch-delete', data)
