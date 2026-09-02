<template>
  <figure class="task-detail-image" draggable="true" @dragstart="setupFileDrag($event, file)">
    <el-image
      class="task-detail-image__preview"
      :src="file._previewSrc || getFileUrl(file)"
      :preview-src-list="previewList"
      :initial-index="initialIndex"
      :hide-on-click-modal="hideOnClickModal"
      fit="contain"
      preview-teleported
    />
    <figcaption>
      <span :title="file.file_name">{{ file.file_name }}</span>
      <el-button v-if="showDownload" type="primary" link size="small" @click="emit('download')">下载</el-button>
    </figcaption>
  </figure>
</template>

<script setup>
import { getFileUrl, setupFileDrag } from '@/api/upload'

defineProps({
  file: { type: Object, required: true },
  previewList: { type: Array, default: () => [] },
  initialIndex: { type: Number, default: 0 },
  hideOnClickModal: { type: Boolean, default: false },
  showDownload: { type: Boolean, default: true }
})

const emit = defineEmits(['download'])
</script>

<style scoped>
.task-detail-image {
  width: 108px;
  min-width: 0;
  margin: 0;
}

.task-detail-image__preview {
  width: 108px;
  height: 108px;
  border: 1px solid #dfe4ec;
  border-radius: 5px;
  cursor: zoom-in;
}

figcaption {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  min-width: 0;
  margin-top: 4px;
  font-size: 11px;
}

figcaption > span {
  min-width: 0;
  overflow: hidden;
  color: #7a8497;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
