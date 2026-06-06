import request from './http'

export const getNotificationList = (params) => request.get('/api/notification/list', { params })
export const getUnreadCount = () => request.get('/api/notification/unread-count')
export const readNotification = (data) => request.post('/api/notification/read', data)
export const deleteNotification = (data) => request.post('/api/notification/delete', data)
export const urgeTaskApi = (data) => request.post('/api/notification/urge', data)
