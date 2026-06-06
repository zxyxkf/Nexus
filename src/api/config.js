import request from './http'

export const getConfigListApi = (params) => request.get('/api/config/list', { params })
export const updateConfigApi = (data) => request.put('/api/config/update', data)
export const deleteConfigApi = (data) => request.post('/api/config/delete', data)
