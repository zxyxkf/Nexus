<template>
  <Transition name="bubble">
    <div v-if="visible" class="announce-bubble-wrapper">
      <div class="announce-bubble">
        <!-- 尾部小三角 -->
        <div class="bubble-tail"></div>

        <!-- 图标 -->
        <div class="bubble-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </div>

        <!-- 内容 -->
        <div class="bubble-body">
          <span class="bubble-title">{{ announcement.title }}</span>
          <span class="bubble-sep">·</span>
          <span class="bubble-content">{{ announcement.content }}</span>
        </div>

        <!-- 关闭 -->
        <button class="bubble-close" @click="dismiss" title="关闭">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getActiveAnnouncementApi } from '@/api/announcement'

const ANNOUNCE_DISMISS_KEY = 'd_design_announce_dismissed'

const announcement = ref(null)
const visible = ref(false)

function getDismissedId() {
  try {
    const data = JSON.parse(localStorage.getItem(ANNOUNCE_DISMISS_KEY))
    // 检查是否是本次登录（loginTime 匹配）
    const loginTime = sessionStorage.getItem('d_design_login_time')
    if (data && data.loginTime === loginTime) return data.announceId
  } catch {}
  return null
}

function setDismissed(announceId) {
  const loginTime = sessionStorage.getItem('d_design_login_time')
  localStorage.setItem(ANNOUNCE_DISMISS_KEY, JSON.stringify({ announceId, loginTime }))
}

function dismiss() {
  visible.value = false
  setDismissed(announcement.value?.id)
}

onMounted(async () => {
  // 记录登录时间用于跟踪会话
  if (!sessionStorage.getItem('d_design_login_time')) {
    sessionStorage.setItem('d_design_login_time', Date.now().toString())
  }

  try {
    const res = await getActiveAnnouncementApi()
    if (res.code === 0 && res.data) {
      const dismissedId = getDismissedId()
      if (dismissedId !== res.data.id) {
        announcement.value = res.data
        visible.value = true
      }
    }
  } catch {}
})
</script>

<style scoped>
.announce-bubble-wrapper {
  position: fixed;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2000;
  max-width: 640px;
  width: calc(100% - 48px);
}

.announce-bubble {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: linear-gradient(135deg, #f0f7ff 0%, #e8f4fd 100%);
  border: 1px solid #cbe7ff;
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 95, 242, 0.10), 0 1px 4px rgba(0, 0, 0, 0.04);
}

/* 暗色模式 */
:root.dark .announce-bubble {
  background: linear-gradient(135deg, #0a1a3a 0%, #0d2247 100%);
  border-color: #003674;
  box-shadow: 0 4px 24px rgba(0, 110, 254, 0.15), 0 1px 4px rgba(0, 0, 0, 0.3);
}

.bubble-tall {
  position: absolute;
  top: -7px;
  left: 50%;
  transform: translateX(-50%);
  width: 14px;
  height: 7px;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-bottom: 7px solid #cbe7ff;
}

:root.dark .bubble-tail {
  border-bottom-color: #003674;
}

.bubble-icon {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: linear-gradient(135deg, #4361ee, #2ec4b6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bubble-body {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 13px;
  line-height: 1.5;
}

.bubble-title {
  font-weight: 600;
  color: #002359;
  white-space: nowrap;
}

:root.dark .bubble-title {
  color: #eaf5ff;
}

.bubble-sep {
  color: #94a3b8;
  font-weight: 300;
}

.bubble-content {
  color: #005FF2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:root.dark .bubble-content {
  color: #44a7ff;
}

.bubble-close {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #005FF2;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

:root.dark .bubble-close {
  color: #47a8ff;
}

.bubble-close:hover {
  background: #cae7ff;
}

:root.dark .bubble-close:hover {
  background: #012f61;
}

/* 动画 */
.bubble-enter-active {
  animation: bubbleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.bubble-leave-active {
  animation: bubbleOut 0.25s ease-in;
}

@keyframes bubbleIn {
  0% {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px) scale(0.9);
  }
  100% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
}

@keyframes bubbleOut {
  0% {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-12px) scale(0.95);
  }
}
</style>
