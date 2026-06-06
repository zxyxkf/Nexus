<template>
  <Teleport to="body">
    <div class="nt-portal">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="nt-toast"
          :class="toast.type"
          @mouseenter="onHover(toast)"
          @mouseleave="onLeave(toast)"
          @click="onClick(toast)"
        >
          <div class="nt-accent"></div>
          <div class="nt-body">
            <div class="nt-icon" v-html="iconSvg(toast.type)"></div>
            <div class="nt-text">
              <h3 class="nt-title">{{ toast.title }}</h3>
              <p class="nt-content">{{ toast.content }}</p>
            </div>
            <button class="nt-close" @click.stop="onClose(toast.id)" v-html="closeSvg"></button>
          </div>
          <div class="nt-progress">
            <div class="nt-progress-bar" :ref="el => setBar(toast.id, el)"></div>
          </div>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { toasts, remove, pauseToastTimer, resumeToastTimer, handleToastClick } from '@/composables/useNotificationToast'

const bars = {}

function setBar(id, el) {
  if (el) bars[id] = el
}

const ICONS = {
  info:    `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  success: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`,
  error:   `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`
}

const closeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`

function iconSvg(type) { return ICONS[type] || ICONS.info }

function onHover(toast) {
  pauseToastTimer(toast.id)
  const b = bars[toast.id]
  if (b) b.style.animationPlayState = 'paused'
}
function onLeave(toast) {
  const ms = resumeToastTimer(toast.id)
  const b = bars[toast.id]
  if (b && ms > 0) {
    b.style.animation = 'none'
    void b.offsetHeight
    b.style.animation = `nt-bar ${ms}ms linear forwards`
    b.style.animationPlayState = 'running'
  }
}
function onClose(id) { remove(id) }
function onClick(toast) { handleToastClick(toast) }
</script>

<style scoped>
.nt-portal {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 100000;
  display: flex;
  flex-direction: column-reverse;
  gap: 10px;
  pointer-events: none;
}

/* ---- single toast ---- */
.nt-toast {
  position: relative;
  width: 380px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 4px 24px rgba(0,0,0,.12), 0 1px 4px rgba(0,0,0,.08);
  overflow: hidden;
  cursor: pointer;
  pointer-events: auto;
  transition: box-shadow .2s;
}
.nt-toast:hover {
  box-shadow: 0 8px 32px rgba(0,0,0,.16), 0 2px 8px rgba(0,0,0,.1);
}

/* accent left bar */
.nt-accent {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
}
.nt-toast.info    .nt-accent { background: #3b82f6; }
.nt-toast.success .nt-accent { background: #22c55e; }
.nt-toast.warning .nt-accent { background: #f59e0b; }
.nt-toast.error   .nt-accent { background: #ef4444; }

/* body */
.nt-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px 10px 18px;
}

/* icon */
.nt-icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 2px;
}
.nt-toast.info    .nt-icon { background: #eff6ff; color: #3b82f6; }
.nt-toast.success .nt-icon { background: #f0fdf4; color: #22c55e; }
.nt-toast.warning .nt-icon { background: #fffbeb; color: #f59e0b; }
.nt-toast.error   .nt-icon { background: #fef2f2; color: #ef4444; }

/* text */
.nt-text { flex: 1; min-width: 0; }
.nt-title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  line-height: 1.3;
  letter-spacing: -.01em;
}
.nt-content {
  font-size: 12.5px;
  color: #64748b;
  margin: 3px 0 0;
  line-height: 1.45;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* close */
.nt-close {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all .15s;
}
.nt-close:hover { background: #f1f5f9; color: #475569; }

/* progress bar */
.nt-progress {
  height: 3px;
  background: #f1f5f9;
  margin: 0 14px 0 18px;
  border-radius: 0 0 6px 6px;
  overflow: hidden;
}
.nt-progress-bar {
  height: 100%;
  width: 100%;
  border-radius: 6px;
  transform-origin: left;
  animation: nt-bar 5000ms linear forwards;
}
.nt-toast.info    .nt-progress-bar { background: #3b82f6; }
.nt-toast.success .nt-progress-bar { background: #22c55e; }
.nt-toast.warning .nt-progress-bar { background: #f59e0b; }
.nt-toast.error   .nt-progress-bar { background: #ef4444; }

/* ---- transition-group ---- */
.toast-enter-active {
  animation: nt-in .5s cubic-bezier(.22,1.3,.36,1) both;
}
.toast-leave-active {
  animation: nt-out .35s ease forwards;
}
.toast-move { transition: transform .35s ease; }

@keyframes nt-in {
  0%   { transform: translateX(110%); opacity: 0; }
  60%  { transform: translateX(-6px); opacity: 1; }
  100% { transform: translateX(0);    opacity: 1; }
}
@keyframes nt-out {
  0%   { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(.92); }
}
@keyframes nt-bar {
  from { transform: scaleX(1); }
  to   { transform: scaleX(0); }
}
</style>
