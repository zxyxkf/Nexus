/**
 * Toast 窗口 preload — 在独立透明窗口中渲染样式化通知
 */
const { ipcRenderer } = require('electron')

const AUTO_HIDE_MS = 5000
let hideTimer = null
let remaining = AUTO_HIDE_MS
let pausedAt = 0

const ICONS = {
  info:    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  error:   `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function show(data) {
  console.log('[ToastPreload] show() 收到:', JSON.stringify(data))
  const root = document.getElementById('toast-root')
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

  // click → navigate
  toast.addEventListener('click', (e) => {
    if (e.target.closest('.nt-close')) return
    ipcRenderer.send('toast:click', { taskId: data.taskId, taskTitle: data.taskTitle })
    hide()
  })

  // close button
  toast.querySelector('.nt-close').addEventListener('click', () => hide())

  // hover pause/resume
  toast.addEventListener('mouseenter', pauseTimer)
  toast.addEventListener('mouseleave', resumeTimer)

  root.appendChild(toast)

  // trigger entry animation
  requestAnimationFrame(() => toast.classList.add('visible'))

  // show window (inactive = no focus steal)
  ipcRenderer.send('toast:show-window')

  startTimer()
}

function hide() {
  clearTimeout(hideTimer)
  const toast = document.querySelector('.nt-toast')
  if (toast) {
    toast.classList.add('hiding')
    setTimeout(() => {
      document.getElementById('toast-root').innerHTML = ''
      ipcRenderer.send('toast:hide-window')
    }, 350)
  } else {
    ipcRenderer.send('toast:hide-window')
  }
}

function startTimer() {
  clearTimeout(hideTimer)
  remaining = AUTO_HIDE_MS
  hideTimer = setTimeout(hide, remaining)
  const bar = document.querySelector('.nt-progress-bar')
  if (bar) {
    bar.style.animation = 'none'
    void bar.offsetHeight
    bar.style.animation = `nt-bar ${AUTO_HIDE_MS}ms linear forwards`
  }
}

function pauseTimer() {
  clearTimeout(hideTimer)
  pausedAt = Date.now()
  const bar = document.querySelector('.nt-progress-bar')
  if (bar) bar.style.animationPlayState = 'paused'
}

function resumeTimer() {
  const elapsed = Date.now() - pausedAt
  remaining = Math.max(200, remaining - elapsed)
  hideTimer = setTimeout(hide, remaining)
  const bar = document.querySelector('.nt-progress-bar')
  if (bar) bar.style.animationPlayState = 'running'
}

// Listen for toast data from main process
ipcRenderer.on('toast:show', (event, data) => show(data))

// Inject @keyframes for progress bar
const style = document.createElement('style')
style.textContent = '@keyframes nt-bar{from{transform:scaleX(1)}to{transform:scaleX(0)}}'
document.head.appendChild(style)
