import request from './http'

const unwrap = promise => promise.then(res => res)

export const getMaterialProductsApi = (params = {}) => unwrap(request.get('/api/material-library/products', { params }))
export const createMaterialProductApi = data => unwrap(request.post('/api/material-library/products', data))
export const renameMaterialProductApi = (id, data) => unwrap(request.put(`/api/material-library/products/${id}`, data))
export const deleteMaterialProductApi = id => unwrap(request.delete(`/api/material-library/products/${id}`))
export const getMaterialStylesApi = (productId, params = {}) => unwrap(request.get(`/api/material-library/products/${productId}/styles`, { params }))
export const createMaterialStyleApi = (productId, data) => unwrap(request.post(`/api/material-library/products/${productId}/styles`, data))
export const renameMaterialStyleApi = (id, data) => unwrap(request.put(`/api/material-library/styles/${id}`, data))
export const deleteMaterialStyleApi = id => unwrap(request.delete(`/api/material-library/styles/${id}`))
export const getMaterialImagesApi = (styleId, params = {}) => unwrap(request.get(`/api/material-library/styles/${styleId}/images`, { params }))
export const uploadMaterialImagesApi = (styleId, files, onUploadProgress) => {
  const form = new FormData()
  files.forEach(file => form.append('files', file))
  return unwrap(request.post(`/api/material-library/styles/${styleId}/images`, form, {
    // Clear the JSON default so the browser can set multipart/form-data with a
    // boundary. A hard-coded multipart header is not parseable by busboy.
    headers: { 'Content-Type': undefined },
    timeout: 120000, onUploadProgress
  }))
}
export const renameMaterialImageApi = (id, data) => unwrap(request.put(`/api/material-library/images/${id}`, data))
export const updateMaterialImageColorApi = (id, color) => unwrap(request.put(`/api/material-library/images/${id}/color`, { color }))
export const deleteMaterialImageApi = id => unwrap(request.delete(`/api/material-library/images/${id}`))
export const reorderMaterialImagesApi = (styleId, imageIds) => unwrap(request.put('/api/material-library/images/reorder', { styleId, imageIds }))
export const searchMaterialLibraryApi = q => unwrap(request.get('/api/material-library/search', { params: { q } }))
