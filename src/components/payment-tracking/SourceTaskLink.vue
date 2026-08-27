<template>
  <span v-if="sourceTaskId" class="source-task-link">
    <span>来源任务</span>
    <el-button
      link
      type="primary"
      size="small"
      :loading="loadingDetail"
      @click="openDetail({ id: sourceTaskId })"
    >{{ sourceTaskNo || `#${sourceTaskId}` }}</el-button>
    <TaskDetail
      :visible="detailVisible"
      :task="currentTask"
      task-group="design"
      @close="closeDetail"
    />
  </span>
</template>

<script setup>
import TaskDetail from '@/components/TaskDetail.vue'
import { useTaskDetail } from '@/composables/useTaskDetail'

defineProps({
  sourceTaskId: { type: [Number, String], default: null },
  sourceTaskNo: { type: String, default: '' }
})

const {
  detailVisible,
  currentTask,
  loadingDetail,
  openDetail,
  closeDetail
} = useTaskDetail()
</script>

<style scoped>
.source-task-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
}

.source-task-link :deep(.el-button) {
  max-width: 160px;
  height: auto;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
