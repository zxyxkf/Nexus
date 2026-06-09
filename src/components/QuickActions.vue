<template>
  <el-dropdown trigger="click" @command="go">
    <el-button class="quick-action-btn" size="small">
      快捷操作
      <el-icon class="quick-arrow"><ArrowDown /></el-icon>
    </el-button>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item v-for="item in actions" :key="item.path" :command="item.path">
          <el-icon><component :is="icons[item.icon]" /></el-icon>{{ item.label }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Plus, ShoppingCart, Select, List, DataAnalysis, ArrowDown } from '@element-plus/icons-vue'
import { hasPermission } from '@/utils/permissions'
import { getUser } from '@/utils/auth'

const router = useRouter()
const icons = { Plus, ShoppingCart, Select, List, DataAnalysis }

const candidates = [
  { path: '/operator/publish', label: '发布美工任务', icon: 'Plus', permission: 'operator.publish.design' },
  { path: '/operator/op-publish', label: '发布运营任务', icon: 'Plus', permission: 'operator.publish.assistant' },
  { path: '/cs/publish', label: '发布基础美工任务', icon: 'Plus', permission: 'cs.publish.basic' },
  { path: '/designer/hall', label: '美工任务大厅', icon: 'ShoppingCart', permission: 'designer.hall.design' },
  { path: '/basic/hall', label: '基础美工任务大厅', icon: 'ShoppingCart', permission: 'basic.hall.cs' },
  { path: '/operator-assistant/hall', label: '运营助理任务大厅', icon: 'ShoppingCart', permission: 'assistant.hall.operator' },
  { path: '/operator/review', label: '作品审核', icon: 'Select', permission: 'operator.review.design' },
  { path: '/operator/op-review', label: '任务审核', icon: 'Select', permission: 'operator.review.assistant' },
  { path: '/cs/review', label: '客服审核', icon: 'Select', permission: 'cs.review.basic' },
  { path: '/dashboard', label: '数据仪表盘', icon: 'DataAnalysis', permission: 'dashboard.design' }
]

const actions = computed(() => {
  const user = getUser()
  return candidates.filter(item => hasPermission(item.permission, user)).slice(0, 8)
})

function go(path) {
  router.push(path)
}
</script>

<style scoped>
.quick-action-btn {
  height: 32px;
}
.quick-arrow {
  margin-left: 4px;
}
</style>
