<template>
  <div class="task-empty-state">
    <el-empty :description="description" :image-size="80">
      <div v-if="hint" class="empty-hint">{{ hint }}</div>
      <el-button v-if="actionText" type="primary" size="small" @click="$emit('action')">
        {{ actionText }}
      </el-button>
    </el-empty>
  </div>
</template>

<script setup>
defineProps({
  description: { type: String, default: '暂无任务' },
  hint: { type: String, default: '' },
  actionText: { type: String, default: '' }
})
defineEmits(['action'])
</script>

<style scoped>
.task-empty-state {
  padding: 28px 0;
}
.empty-hint {
  margin: -4px 0 10px;
  font-size: 12px;
  color: var(--dd-text-muted, #909399);
}
</style>
