import request from './http'

export const getShopListApi = () => request.get('/api/shop/list')
export const createShopApi = (data) => request.post('/api/shop/create', data)
export const updateShopApi = (data) => request.put('/api/shop/update', data)
export const deleteShopApi = (id) => request.delete('/api/shop/delete', { data: { id } })
