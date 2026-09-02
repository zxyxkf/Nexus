<template>
  <div class="task-detail-attachment" draggable="true" @dragstart="setupFileDrag($event, file)">
    <el-icon :size="22"><Document /></el-icon>
    <div class="task-detail-attachment__info">
      <span :title="file.file_name">{{ file.file_name }}</span>
      <small>{{ formattedSize || formatFileSize(file.file_size) }}</small>
    </div>
    <el-button type="primary" link size="small" @click="emit('download')">下载</el-button>
  </div>
</template>

<script setup>
import { Document } from '@element-plus/icons-vue'
import { setupFileDrag } from '@/api/upload'
import { formatFileSize } from '@/utils/format'

defineProps({
  file: { type: Object, required: true },
  formattedSize: { type: String, default: '' }
})

const emit = defineEmits(['download'])
</script>

<style scoped>
.task-detail-attachment {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  padding: 8px 0;
  border-top: 1px solid #edf0f4;
  color: #7a8497;
}

.task-detail-attachment__info {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.task-detail-attachment__info > span {
  overflow: hidden;
  color: #344054;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-detail-attachment__info small {
  color: #9099aa;
}
</style>
