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
export const getTaskPublisherListApi = (params) => request.get('/api/user/task-publishers', { params })
export const getTaskDesignerListApi = (params) => request.get('/api/user/task-designers', { params })
export const getPermissionCatalogApi = () => request.get('/api/user/permissions/catalog')
export const getUserPermissionsApi = (userId) => request.get(`/api/user/permissions/${userId}`)
export const saveUserPermissionsApi = (data) => request.post('/api/user/permissions/save', data)

export const getMyAvatarApi = () => request.get('/api/user/avatar', {
  responseType: 'blob',
  headers: { Accept: 'image/webp' }
})

export function uploadMyAvatarApi(file) {
  const formData = new FormData()
  formData.append('avatar', file, 'avatar.webp')
  return request.post('/api/user/avatar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
