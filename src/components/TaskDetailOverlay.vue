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
              <div class="task-detail-title-row">
                <h2 class="task-detail-title" :title="title">{{ title }}</h2>
                <slot name="title-extra" />
              </div>
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

          <div ref="bodyRef" class="task-detail-body" :class="bodyClass">
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
  title: { type: String, default: '任务详情' },
  bodyClass: { type: [String, Array, Object], default: '' }
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
  background: #fff;
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
  background: #fff;
}

.task-detail-heading,
.task-detail-title-row,
.task-detail-summary,
.task-detail-actions {
  display: flex;
  align-items: center;
}

.task-detail-heading {
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  gap: 7px;
}

.task-detail-title-row {
  gap: 10px;
  min-width: 0;
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

.task-detail-summary :deep(.detail-header-left) {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.task-detail-summary :deep(.detail-number) {
  color: var(--dd-text-muted, #909399);
  font-family: var(--dd-font-mono, monospace);
  font-size: 20px;
  font-weight: 700;
}

.task-detail-summary :deep(.detail-project-title) {
  min-width: 0;
  max-width: min(520px, 42vw);
  overflow: hidden;
  color: #e63946;
  font-size: 16px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-detail-summary :deep(.detail-header-time) {
  padding: 4px 10px;
  color: var(--dd-text-secondary, #606266);
  font-family: var(--dd-font-mono, monospace);
  font-size: 13px;
  background: var(--dd-border-light, #ebeef5);
  border-radius: 6px;
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
  background: #f5f7fa;
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
