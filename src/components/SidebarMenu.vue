<template>
  <div class="sidebar-nav" :class="{ 'is-collapsed': isCollapsed }">
    <template v-for="item in menuItems" :key="item._key">
      <div v-if="item.separator" class="nav-separator"></div>
      <div v-else-if="item.section" class="nav-section-label">{{ item.section }}</div>
      <div
        v-else
        class="nav-item"
        :class="{ active: activeMenu === item.path }"
        @click="nav(item.path)"
      >
        <el-icon :size="18"><component :is="iconMap[item.icon]" /></el-icon>
        <span class="nav-text">{{ item.label }}</span>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { DataAnalysis, User, List, Document, Setting, Plus, Select, DataLine, ShoppingCart, Bell } from '@element-plus/icons-vue'
import { useUserStore } from '@/store'
import { buildSidebarMenu } from '@/config/menus'
import { hasPermission } from '@/utils/permissions'

const props = defineProps({
  activePath: { type: String, default: '' },
  isCollapsed: { type: Boolean, default: false }
})

const emit = defineEmits(['navigate'])

const store = useUserStore()
const activeMenu = computed(() => props.activePath)

const iconMap = { DataAnalysis, User, List, Document, Setting, Plus, Select, DataLine, ShoppingCart, Bell }

const menuItems = computed(() => buildSidebarMenu(store.userInfo, hasPermission))

function nav(path) { emit('navigate', path) }
</script>

<style scoped>
.sidebar-nav {
  flex: 1;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.nav-item {
  display: flex;
  align-items: center;
  height: 36px;
  padding: 0 8px;
  border-radius: 8px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.55);
  transition: background-color 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
  position: relative;
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.07);
  color: rgba(255, 255, 255, 0.9);
}

.nav-item.active {
  background: rgba(67, 97, 238, 0.2);
  color: #6c83f5;
}

.nav-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 3px;
  background: #4361ee;
  border-radius: 0 3px 3px 0;
}

.nav-item :deep(.el-icon) {
  flex-shrink: 0;
}

.nav-text {
  margin-left: 10px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  opacity: 0;
  transition: opacity 0.15s ease 0.05s;
}

.sidebar-nav:not(.is-collapsed) .nav-text {
  opacity: 1;
}

.nav-section-label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.2);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  padding: 12px 10px 4px;
  white-space: nowrap;
  overflow: hidden;
  opacity: 0;
  transition: opacity 0.15s ease 0.05s;
  flex-shrink: 0;
}

.sidebar-nav:not(.is-collapsed) .nav-section-label {
  opacity: 1;
}

.nav-separator {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 4px 8px;
  flex-shrink: 0;
}
</style>
