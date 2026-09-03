import request from './http'

function emitTaskChanged(response) {
  if (typeof window !== 'undefined' && response?.code === 0) {
    window.dispatchEvent(new CustomEvent('nexus:task-updated', { detail: response }))
  }
  return response
}

export const getCsShiftStatusApi = () => request.get('/api/task/cs-shift/status')
export const setCsShiftStatusApi = status => request
  .post('/api/task/cs-shift/status', { status })
  .then(emitTaskChanged)
export const getCsHandoffTasksApi = params => request.get('/api/task/cs-handoff', { params })
export const claimCsHandoffTaskApi = taskId => request
  .post(`/api/task/cs-handoff/${taskId}/claim`)
  .then(emitTaskChanged)
