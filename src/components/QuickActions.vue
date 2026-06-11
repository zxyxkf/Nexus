<template>
  <el-popover
    v-model:visible="visible"
    placement="bottom-end"
    :width="340"
    trigger="click"
    popper-class="quick-actions-popper"
  >
    <template #reference>
      <div class="quick-action-trigger" :class="{ active: visible }" title="快捷操作">
        <el-icon :size="16"><Menu /></el-icon>
      </div>
    </template>

    <div class="quick-panel">
      <div class="quick-header">
        <div>
          <div class="quick-title">快捷操作</div>
          <div class="quick-subtitle">按当前账号权限自动同步</div>
        </div>
        <span class="quick-count">{{ actionCount }} 项</span>
      </div>

      <div v-if="actionSections.length" class="quick-section-list">
        <section v-for="section in actionSections" :key="section.key" class="quick-section">
          <div class="quick-section-title">{{ section.label }}</div>
          <button
            v-for="item in section.items"
            :key="item.path"
            type="button"
            class="quick-item"
            :class="{ active: route.path === item.path }"
            @click="go(item.path)"
          >
            <span class="quick-item-icon">
              <el-icon :size="16"><component :is="icons[item.icon] || List" /></el-icon>
            </span>
            <span class="quick-item-main">
              <span class="quick-item-label">{{ item.label }}</span>
              <span class="quick-item-desc">{{ item.groupLabel }}</span>
            </span>
          </button>
        </section>
      </div>

      <div v-else class="quick-empty">
        <el-icon :size="28"><Menu /></el-icon>
        <span>暂无可用快捷操作</span>
      </div>
    </div>
  </el-popover>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell, DataAnalysis, DataLine, Document, List, Menu, Plus, Select, Setting, ShoppingCart, User } from '@element-plus/icons-vue'
import { useUserStore } from '@/store'
import { buildSidebarMenu, MENU_SECTIONS } from '@/config/menus'

const router = useRouter()
const route = useRoute()
const store = useUserStore()

const visible = ref(false)
const icons = { Bell, DataAnalysis, DataLine, Document, List, Plus, Select, Setting, ShoppingCart, User }
const sectionLabels = Object.fromEntries(MENU_SECTIONS.map(section => [section.key, section.label]))

const categoryDefs = [
  {
    key: 'publish',
    label: '发布',
    match: item => item.icon === 'Plus' || item.path.includes('publish')
  },
  {
    key: 'review',
    label: '审核处理',
    match: item => item.path.includes('review') || item.permission?.includes('review')
  },
  {
    key: 'task',
    label: '任务入口',
    match: item => item.path.includes('/tasks') || item.path.includes('/hall') || item.group === 'all_tasks'
  },
  {
    key: 'data',
    label: '数据',
    match: item => item.path.includes('/dashboard') || item.path.includes('/stats')
  },
  {
    key: 'manage',
    label: '管理',
    match: item => ['system', 'score', 'common'].includes(item.group)
  }
]

const menuActions = computed(() => {
  const menu = buildSidebarMenu(store.userInfo, permission => store.hasPermission(permission))
  const seen = new Set()

  return menu
    .filter(item => item.path)
    .filter(item => {
      if (seen.has(item.path)) return false
      seen.add(item.path)
      return true
    })
    .map(item => ({
      ...item,
      groupLabel: sectionLabels[item.group] || '快捷入口'
    }))
})

const actionSections = computed(() => {
  const remaining = [...menuActions.value]
  const sections = []

  for (const category of categoryDefs) {
    const matched = remaining.filter(category.match)
    if (!matched.length) continue
    sections.push({ key: category.key, label: category.label, items: matched })
    for (const item of matched) {
      const index = remaining.findIndex(candidate => candidate.path === item.path)
      if (index >= 0) remaining.splice(index, 1)
    }
  }

  if (remaining.length) {
    sections.push({ key: 'other', label: '其他', items: remaining })
  }

  return sections
})

const actionCount = computed(() => menuActions.value.length)

function go(path) {
  visible.value = false
  router.push(path)
}
</script>

<style scoped>
.quick-action-trigger {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--dd-bg-card);
  color: var(--dd-text-secondary);
  box-shadow: 0 0 0 1.5px var(--dd-border);
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.quick-action-trigger:hover,
.quick-action-trigger.active {
  color: var(--dd-primary);
  box-shadow: 0 0 0 1.5px var(--dd-primary-light);
}

.quick-action-trigger:active {
  opacity: 0.8;
}

.quick-panel {
  max-height: 520px;
  display: flex;
  flex-direction: column;
}

.quick-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 2px 2px 12px;
  border-bottom: 1px solid var(--dd-border-light);
}

.quick-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--dd-text-primary);
  line-height: 1.3;
}

.quick-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: var(--dd-text-muted);
}

.quick-count {
  flex-shrink: 0;
  font-size: 12px;
  color: var(--dd-text-secondary);
  background: var(--dd-bg);
  border: 1px solid var(--dd-border-light);
  border-radius: 999px;
  padding: 3px 8px;
}

.quick-section-list {
  overflow-y: auto;
  padding: 8px 0 2px;
}

.quick-section + .quick-section {
  margin-top: 8px;
}

.quick-section-title {
  padding: 6px 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--dd-text-muted);
}

.quick-item {
  width: 100%;
  min-height: 42px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.quick-item:hover,
.quick-item.active {
  background: var(--dd-primary-lighter);
}

.quick-item.active .quick-item-label {
  color: var(--dd-primary);
}

.quick-item-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--dd-primary);
  background: rgba(67, 97, 238, 0.1);
}

.quick-item-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.quick-item-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--dd-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-item-desc {
  font-size: 12px;
  color: var(--dd-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quick-empty {
  min-height: 120px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--dd-text-muted);
  font-size: 13px;
}

:global(.quick-actions-popper) {
  padding: 12px !important;
}
</style>
