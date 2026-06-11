/**
 * Toast window preload. Renders a small stack of desktop notifications in a
 * transparent Electron window.
 */
const { ipcRenderer } = require('electron')

const MAX_TOASTS = 3
const DEFAULT_HIDE_MS = 5000
const MEDIUM_HIDE_MS = 7000
const HIGH_HIDE_MS = 10000
const HIDE_ANIMATION_MS = 260

const toasts = []
const timerEntries = new Map()

const ICONS = {
  info: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  error: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function toastKey(data = {}) {
  return `${data.taskId || data.task_id || 'notice'}_${data.eventType || data.rawType || data.type || 'info'}`
}

function getPriority(data = {}) {
  const priority = Number(data.priority || 0)
  if (priority > 0) return priority
  const type = data.type || ''
  const eventType = data.eventType || data.rawType || data.type || ''
  if (type === 'warning' || type === 'error' || ['task_urge', 'task_reject', 'score_review', 'score_reject'].includes(eventType)) return 3
  if (['task_submit', 'task_review', 'task_assigned'].includes(eventType)) return 2
  return 1
}

function getDuration(data = {}) {
  if (Number(data.duration) > 0) return Number(data.duration)
  const priority = getPriority(data)
  if (priority >= 3) return HIGH_HIDE_MS
  if (priority === 2) return MEDIUM_HIDE_MS
  return DEFAULT_HIDE_MS
}

function rootEl() {
  return document.getElementById('toast-root')
}

function clearToastTimers(id) {
  const entry = timerEntries.get(id)
  if (!entry) return
  clearTimeout(entry.dismissTimer)
  clearTimeout(entry.removeTimer)
  timerEntries.delete(id)
}

function scheduleLayout() {
  requestAnimationFrame(() => {
    const root = rootEl()
    const height = Math.max(1, Math.ceil(root.scrollHeight))
    ipcRenderer.send('toast:resize-window', { height })
    if (toasts.length > 0) {
      ipcRenderer.send('toast:show-window', { height })
    } else {
      ipcRenderer.send('toast:hide-window')
    }
  })
}

function removeToast(id, animate = true) {
  const idx = toasts.findIndex(t => t.id === id)
  if (idx < 0) return

  clearToastTimers(id)
  const element = document.querySelector(`[data-toast-id="${id}"]`)

  const finish = () => {
    const nextIdx = toasts.findIndex(t => t.id === id)
    if (nextIdx >= 0) toasts.splice(nextIdx, 1)
    if (element && element.parentNode) element.parentNode.removeChild(element)
    scheduleLayout()
  }

  if (animate && element) {
    element.classList.add('hiding')
    setTimeout(finish, HIDE_ANIMATION_MS)
  } else {
    finish()
  }
}

function startTimer(toast) {
  clearToastTimers(toast.id)
  const entry = {
    startTime: Date.now(),
    duration: toast.duration,
    remaining: toast.duration,
    dismissTimer: setTimeout(() => removeToast(toast.id), toast.duration),
    removeTimer: null,
    paused: false
  }
  timerEntries.set(toast.id, entry)

  const bar = document.querySelector(`[data-toast-id="${toast.id}"] .nt-progress-bar`)
  if (bar) {
    bar.style.animation = 'none'
    void bar.offsetHeight
    bar.style.animation = `nt-bar ${toast.duration}ms linear forwards`
  }
}

function pauseTimer(id) {
  const entry = timerEntries.get(id)
  if (!entry || entry.paused) return
  clearTimeout(entry.dismissTimer)
  entry.remaining = Math.max(200, entry.remaining - (Date.now() - entry.startTime))
  entry.paused = true

  const bar = document.querySelector(`[data-toast-id="${id}"] .nt-progress-bar`)
  if (bar) bar.style.animationPlayState = 'paused'
}

function resumeTimer(id) {
  const entry = timerEntries.get(id)
  if (!entry || !entry.paused) return
  entry.startTime = Date.now()
  entry.paused = false
  entry.dismissTimer = setTimeout(() => removeToast(id), entry.remaining)

  const bar = document.querySelector(`[data-toast-id="${id}"] .nt-progress-bar`)
  if (bar) bar.style.animationPlayState = 'running'
}

function createToastElement(toast) {
  const element = document.createElement('div')
  element.className = `nt-toast ${toast.type || 'info'}`
  element.dataset.toastId = toast.id
  element.innerHTML =
    `<div class="nt-accent"></div>` +
    `<div class="nt-body">` +
      `<div class="nt-icon">${ICONS[toast.type] || ICONS.info}</div>` +
      `<div class="nt-text">` +
        `<h3 class="nt-title">${esc(toast.title)}</h3>` +
        `<p class="nt-content">${esc(toast.content)}</p>` +
      `</div>` +
      `<button class="nt-close" aria-label="close">&times;</button>` +
    `</div>` +
    `<div class="nt-progress"><div class="nt-progress-bar"></div></div>`

  element.addEventListener('click', (event) => {
    if (event.target.closest('.nt-close')) return
    ipcRenderer.send('toast:click', toast.data)
    removeToast(toast.id)
  })

  element.querySelector('.nt-close').addEventListener('click', (event) => {
    event.stopPropagation()
    removeToast(toast.id)
  })
  element.addEventListener('mouseenter', () => pauseTimer(toast.id))
  element.addEventListener('mouseleave', () => resumeTimer(toast.id))
  return element
}

function addToast(data = {}) {
  const root = rootEl()
  const key = toastKey(data)
  const existing = toasts.find(t => t.key === key)
  if (existing) {
    existing.data = data
    existing.type = data.type || 'info'
    existing.title = data.title || ''
    existing.content = data.content || ''
    existing.duration = getDuration(data)
    const oldElement = document.querySelector(`[data-toast-id="${existing.id}"]`)
    const nextElement = createToastElement(existing)
    if (oldElement) root.replaceChild(nextElement, oldElement)
    else root.prepend(nextElement)
    requestAnimationFrame(() => nextElement.classList.add('visible'))
    startTimer(existing)
    scheduleLayout()
    return
  }

  const toast = {
    id: `${key}_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    key,
    data,
    type: data.type || 'info',
    title: data.title || '',
    content: data.content || '',
    duration: getDuration(data)
  }

  toasts.unshift(toast)
  const element = createToastElement(toast)
  root.prepend(element)
  requestAnimationFrame(() => element.classList.add('visible'))
  startTimer(toast)

  while (toasts.length > MAX_TOASTS) {
    const oldest = toasts[toasts.length - 1]
    removeToast(oldest.id, false)
  }

  scheduleLayout()
}

ipcRenderer.on('toast:show', (event, data) => addToast(data || {}))

const style = document.createElement('style')
style.textContent = '@keyframes nt-bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}'
document.head.appendChild(style)
