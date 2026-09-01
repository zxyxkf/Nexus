<template>
  <el-avatar
    data-testid="user-avatar"
    shape="circle"
    :size="size"
    :src="userStore.avatarUrl || undefined"
    :style="userStore.avatarUrl ? undefined : { backgroundColor }"
  >
    {{ initial }}
  </el-avatar>
</template>

<script setup>
import { computed } from 'vue'
import { useUserStore } from '@/store'

defineProps({
  size: { type: Number, default: 34 },
  backgroundColor: { type: String, default: '#4361ee' }
})

const userStore = useUserStore()
const initial = computed(() => (
  userStore.realName?.charAt(0) || userStore.username?.charAt(0) || ''
))
</script>

<style scoped>
.el-avatar {
  flex-shrink: 0;
  border-radius: 50%;
}
</style>
