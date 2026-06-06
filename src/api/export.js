import request from './http'

export const exportTasksApi = (params) => request.get('/api/export/tasks', { params, responseType: 'blob' })
export const exportLogsApi = (params) => request.get('/api/export/logs', { params, responseType: 'blob' })
export const exportDashboardApi = () => request.get('/api/export/dashboard', { responseType: 'blob' })
