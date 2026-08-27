<template>
  <Teleport to="body">
    <Transition name="task-detail-fade">
      <div v-if="visible" class="task-detail-layer" :style="{ left: sidebarWidth }">
        <section
          class="task-detail-overlay"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <header class="task-detail-header">
            <div class="task-detail-heading">
              <h2 class="task-detail-title" :title="title">{{ title }}</h2>
              <div v-if="$slots.summary" class="task-detail-summary">
                <slot name="summary" />
              </div>
            </div>
            <div class="task-detail-actions">
              <slot name="actions" />
              <el-button circle aria-label="关闭" @click="emit('close')">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
          </header>

          <div ref="bodyRef" class="task-detail-body">
            <slot />
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Close } from '@element-plus/icons-vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: '任务详情' }
})

const emit = defineEmits(['close'])
const bodyRef = ref(null)
const sidebarWidth = ref('220px')
let layoutObserver = null

function syncSidebarWidth() {
  const layout = document.querySelector('.layout-container')
  if (!layout) return
  sidebarWidth.value = getComputedStyle(layout).getPropertyValue('--layout-sidebar-width').trim() || '220px'
}

onMounted(() => {
  const layout = document.querySelector('.layout-container')
  syncSidebarWidth()
  if (!layout) return
  layoutObserver = new MutationObserver(syncSidebarWidth)
  layoutObserver.observe(layout, { attributes: true, attributeFilter: ['style'] })
})

onBeforeUnmount(() => layoutObserver?.disconnect())

watch(() => props.visible, async (visible) => {
  if (!visible) return
  await nextTick()
  syncSidebarWidth()
  if (bodyRef.value) bodyRef.value.scrollTop = 0
})
</script>

<style scoped>
.task-detail-layer {
  position: fixed;
  top: 60px;
  right: 0;
  bottom: 0;
  left: var(--layout-sidebar-width, 220px);
  z-index: 1800;
  display: flex;
  padding: 16px 24px 24px;
  background: rgb(15 23 42 / 10%);
}

.task-detail-overlay {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--dd-bg-card, #fff);
  border: 1px solid var(--dd-border, #dcdfe6);
  border-radius: 6px;
  box-shadow: 0 12px 32px rgb(0 0 0 / 16%);
}

.task-detail-header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 62px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--dd-border, #dcdfe6);
  background: var(--dd-bg-card, #fff);
}

.task-detail-heading,
.task-detail-summary,
.task-detail-actions {
  display: flex;
  align-items: center;
}

.task-detail-heading {
  min-width: 0;
  gap: 14px;
}

.task-detail-title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--dd-text-primary, #303133);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-detail-summary {
  flex-wrap: wrap;
  gap: 10px;
  min-width: 0;
  color: var(--dd-text-secondary, #606266);
  font-size: 13px;
}

.task-detail-actions {
  flex: 0 0 auto;
  justify-content: flex-end;
  gap: 8px;
}

.task-detail-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.task-detail-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 18px 20px 24px;
  background: var(--dd-bg-page, #f5f7fa);
}

.task-detail-fade-enter-active,
.task-detail-fade-leave-active {
  transition: opacity 0.16s ease;
}

.task-detail-fade-enter-from,
.task-detail-fade-leave-to {
  opacity: 0;
}

@media (max-width: 1360px) {
  .task-detail-header {
    flex-wrap: wrap;
    align-content: center;
  }

  .task-detail-heading {
    flex: 1 1 640px;
  }

  .task-detail-actions {
    flex: 1 1 auto;
  }
}
</style>
