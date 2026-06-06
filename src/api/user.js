import request from './http'

export const getUserListApi = (params) => request.get('/api/user/list', { params })
export const createUserApi = (data) => request.post('/api/user/create', data)
export const updateUserApi = (data) => request.put('/api/user/update', data)
export const resetPasswordApi = (data) => request.post('/api/user/reset-password', data)
export const toggleUserStatusApi = (data) => request.post('/api/user/toggle-status', data)
export const deleteUserApi = (data) => request.post('/api/user/delete', data)
export const getDesignerListApi = () => request.get('/api/user/designers')
export const getBasicDesignerListApi = () => request.get('/api/user/basic-designers')
export const getOperatorAssistantListApi = () => request.get('/api/user/operator-assistants')
export const getPublisherListApi = () => request.get('/api/user/publishers')
