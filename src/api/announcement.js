import request from './http'

export const getActiveAnnouncementApi = () => request.get('/api/announcement/active')
export const getAnnouncementListApi = () => request.get('/api/announcement/list')
export const createAnnouncementApi = (data) => request.post('/api/announcement/create', data)
export const updateAnnouncementApi = (data) => request.put('/api/announcement/update', data)
export const deleteAnnouncementApi = (id) => request.delete('/api/announcement/delete', { data: { id } })
