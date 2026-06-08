/**
 * Toast window preload. Renders one notification in a transparent Electron window.
 */
const { ipcRenderer } = require('electron')

const AUTO_HIDE_MS = 5000
let hideTimer = null
let hideAnimationTimer = null
let remaining = AUTO_HIDE_MS
let timerStartedAt = 0
let activeToastToken = 0

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

function show(data) {
  const root = document.getElementById('toast-root')
  const token = ++activeToastToken

  clearTimeout(hideTimer)
  clearTimeout(hideAnimationTimer)
  root.innerHTML = ''

  const toast = document.createElement('div')
  toast.className = 'nt-toast ' + (data.type || 'info')
  toast.innerHTML =
    `<div class="nt-accent"></div>` +
    `<div class="nt-body">` +
      `<div class="nt-icon">${ICONS[data.type] || ICONS.info}</div>` +
      `<div class="nt-text">` +
        `<h3 class="nt-title">${esc(data.title)}</h3>` +
        `<p class="nt-content">${esc(data.content)}</p>` +
      `</div>` +
      `<button class="nt-close">&times;</button>` +
    `</div>` +
    `<div class="nt-progress"><div class="nt-progress-bar"></div></div>`

  toast.addEventListener('click', (event) => {
    if (event.target.closest('.nt-close')) return
    ipcRenderer.send('toast:click', { taskId: data.taskId, taskTitle: data.taskTitle })
    hide(token)
  })

  toast.querySelector('.nt-close').addEventListener('click', () => hide(token))
  toast.addEventListener('mouseenter', pauseTimer)
  toast.addEventListener('mouseleave', resumeTimer)

  root.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('visible'))
  ipcRenderer.send('toast:show-window')

  startTimer(token)
}

function hide(token = activeToastToken) {
  if (token !== activeToastToken) return

  clearTimeout(hideTimer)
  const toast = document.querySelector('.nt-toast')
  if (toast) {
    toast.classList.add('hiding')
    hideAnimationTimer = setTimeout(() => {
      if (token !== activeToastToken) return
      document.getElementById('toast-root').innerHTML = ''
      ipcRenderer.send('toast:hide-window')
    }, 350)
  } else {
    ipcRenderer.send('toast:hide-window')
  }
}

function startTimer(token = activeToastToken) {
  clearTimeout(hideTimer)
  remaining = AUTO_HIDE_MS
  timerStartedAt = Date.now()
  hideTimer = setTimeout(() => hide(token), remaining)

  const bar = document.querySelector('.nt-progress-bar')
  if (bar) {
    bar.style.animation = 'none'
    void bar.offsetHeight
    bar.style.animation = `nt-bar ${AUTO_HIDE_MS}ms linear forwards`
  }
}

function pauseTimer() {
  clearTimeout(hideTimer)
  remaining = Math.max(200, remaining - (Date.now() - timerStartedAt))

  const bar = document.querySelector('.nt-progress-bar')
  if (bar) bar.style.animationPlayState = 'paused'
}

function resumeTimer() {
  clearTimeout(hideTimer)
  const token = activeToastToken
  timerStartedAt = Date.now()
  hideTimer = setTimeout(() => hide(token), remaining)

  const bar = document.querySelector('.nt-progress-bar')
  if (bar) bar.style.animationPlayState = 'running'
}

ipcRenderer.on('toast:show', (event, data) => show(data || {}))

const style = document.createElement('style')
style.textContent = '@keyframes nt-bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}'
document.head.appendChild(style)
