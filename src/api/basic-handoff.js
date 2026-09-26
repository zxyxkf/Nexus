import request from './http'

function emitTaskChanged(response) {
  if (typeof window !== 'undefined' && response?.code === 0) {
    window.dispatchEvent(new CustomEvent('nexus:task-updated', { detail: response }))
  }
  return response
}

export const getBasicShiftStatusApi = () => request.get('/api/task/basic-shift/status')
export const setBasicShiftStatusApi = status => request
  .post('/api/task/basic-shift/status', { status })
  .then(emitTaskChanged)
export const getBasicHandoffTasksApi = params => request.get('/api/task/basic-handoff', { params })
export const claimBasicHandoffTaskApi = taskId => request
  .post(`/api/task/basic-handoff/${taskId}/claim`)
  .then(emitTaskChanged)
