import request from './http'
import { getServerBase } from '@/utils/server-base'
import { getToken } from '@/utils/auth'

export const listPaymentRecordsApi = params => request.get('/api/payment-tracking/records', { params })
export const getPaymentRecordApi = id => request.get(`/api/payment-tracking/records/${id}`)
export const createPaymentRecordApi = data => request.post('/api/payment-tracking/records', data)
export const savePaymentStageApi = (id, stageCode, data) => request.put(`/api/payment-tracking/records/${id}/stages/${stageCode}`, data)
export const advancePaymentStageApi = (id, data) => request.post(`/api/payment-tracking/records/${id}/advance`, data)
export const endPaymentProcessApi = (id, data) => request.post(`/api/payment-tracking/records/${id}/end`, data)
export const restorePaymentProcessApi = (id, data) => request.post(`/api/payment-tracking/records/${id}/restore`, data)
export const reopenPaymentStageApi = (id, stageCode, data) => request.post(`/api/payment-tracking/records/${id}/stages/${stageCode}/reopen`, data)
export const deletePaymentRecordApi = (id, version) => request.delete(`/api/payment-tracking/records/${id}`, { data: { version } })
export const openPaymentFromTaskApi = taskId => request.post(`/api/payment-tracking/open/task/${taskId}`)
export const openPaymentBatchApi = taskIds => request.post('/api/payment-tracking/open/batch', { taskIds })

export function uploadPaymentImagesApi(id, category, files, version) {
  const formData = new FormData()
  formData.append('version', String(version))
  Array.from(files || []).forEach(file => formData.append('files', file))
  return request.post(`/api/payment-tracking/records/${id}/images/${category}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export const sortPaymentImagesApi = (id, imageIds, version) => request.put(`/api/payment-tracking/records/${id}/images/order`, { imageIds, version })
export const deletePaymentImageApi = (id, imageId, version) => request.delete(`/api/payment-tracking/records/${id}/images/${imageId}`, { data: { version } })

export function getPaymentImageUrl(image) {
  if (!image?.id) return ''
  const token = getToken()
  return `${getServerBase()}/api/payment-tracking/images/${image.id}/preview?token=${encodeURIComponent(token || '')}`
}
