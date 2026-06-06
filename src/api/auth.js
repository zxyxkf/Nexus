import request from './http'

export const loginApi = (data) => request.post('/api/auth/login', data)
export const changePasswordApi = (data) => request.post('/api/auth/password', data)
