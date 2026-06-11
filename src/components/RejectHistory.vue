<template>
  <div v-if="records.length" class="reject-history">
    <div class="reject-history__title">驳回历史</div>
    <div
      v-for="record in records"
      :key="record.id"
      class="reject-record"
    >
      <div class="reject-record__head">
        <span>第 {{ record.reject_index || record.rejectIndex || '-' }} 次驳回</span>
        <small>{{ formatTime(record.create_time) }}</small>
      </div>
      <div class="reject-record__reason">
        <label>驳回原因</label>
        <div>{{ record.reject_reason || '-' }}</div>
      </div>
      <div class="reject-record__meta">
        <span>审核人：{{ record.reviewer_name || '-' }}</span>
      </div>

      <div class="reject-record__files">
        <div class="reject-file-group">
          <div class="reject-file-group__title">客服驳回时上传 ({{ rejectFiles(record).length }})</div>
          <div v-if="!rejectFiles(record).length" class="reject-file-group__empty">暂无文件</div>
          <div v-else class="reject-file-group__body">
            <div
              v-for="(file, fileIndex) in rejectFiles(record)"
              :key="file.id || file.file_path || file.file_name"
              :class="['reject-file', file.file_type === 'image' ? 'reject-file--image' : 'reject-file--attachment']"
              draggable="true"
              @dragstart="setupFileDrag($event, file)"
            >
              <template v-if="file.file_type === 'image'">
                <el-image
                  class="reject-file__image"
                  :src="file._previewSrc || getFileUrl(file)"
                  fit="contain"
                  :preview-src-list="imagePreviewList(rejectFiles(record))"
                  :initial-index="imagePreviewIndex(rejectFiles(record), file, fileIndex)"
                  preview-teleported
                />
                <div class="reject-file__name" :title="file.file_name">{{ file.file_name }}</div>
                <el-button class="reject-file__download" type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
              </template>
              <template v-else>
                <el-icon :size="24"><Document /></el-icon>
                <div class="reject-file__info">
                  <div class="reject-file__name" :title="file.file_name">{{ file.file_name }}</div>
                  <small>{{ formatFileSize(file.file_size) }}</small>
                </div>
                <el-button type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
              </template>
            </div>
          </div>
        </div>

        <div class="reject-file-group">
          <div class="reject-file-group__title">基础美工重新上传 ({{ resubmitFiles(record).length }})</div>
          <div v-if="!resubmitFiles(record).length" class="reject-file-group__empty">暂无文件</div>
          <div v-else class="reject-file-group__body">
            <div
              v-for="(file, fileIndex) in resubmitFiles(record)"
              :key="file.id || file.file_path || file.file_name"
              :class="['reject-file', file.file_type === 'image' ? 'reject-file--image' : 'reject-file--attachment']"
              draggable="true"
              @dragstart="setupFileDrag($event, file)"
            >
              <template v-if="file.file_type === 'image'">
                <el-image
                  class="reject-file__image"
                  :src="file._previewSrc || getFileUrl(file)"
                  fit="contain"
                  :preview-src-list="imagePreviewList(resubmitFiles(record))"
                  :initial-index="imagePreviewIndex(resubmitFiles(record), file, fileIndex)"
                  preview-teleported
                />
                <div class="reject-file__name" :title="file.file_name">{{ file.file_name }}</div>
                <el-button class="reject-file__download" type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
              </template>
              <template v-else>
                <el-icon :size="24"><Document /></el-icon>
                <div class="reject-file__info">
                  <div class="reject-file__name" :title="file.file_name">{{ file.file_name }}</div>
                  <small>{{ formatFileSize(file.file_size) }}</small>
                </div>
                <el-button type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Document } from '@element-plus/icons-vue'
import { getFileUrl, saveFileToDisk, setupFileDrag } from '@/api'
import { formatFileSize } from '@/utils/format'

const props = defineProps({
  records: { type: Array, default: () => [] }
})

const records = computed(() => props.records || [])

function rejectFiles(record) {
  return (record.files || []).filter(file => file.file_category === 'reject')
}

function resubmitFiles(record) {
  return (record.files || []).filter(file => file.file_category !== 'reject')
}

function imagePreviewList(files) {
  return (files || []).filter(file => file.file_type === 'image').map(file => file._previewSrc || getFileUrl(file))
}

function imagePreviewIndex(files, currentFile, fallbackIndex = 0) {
  const imageFiles = (files || []).filter(file => file.file_type === 'image')
  const index = imageFiles.findIndex(file => file === currentFile || (file.id && file.id === currentFile.id))
  return index >= 0 ? index : fallbackIndex
}

function formatTime(value) {
  return value || '-'
}
</script>

<style scoped>
.reject-history {
  grid-column: 1 / -1;
  align-self: stretch;
  width: 100%;
  min-width: 0;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--dd-border-light, #e4e7ed);
}
.reject-history__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--dd-text-primary, #303133);
  margin-bottom: 10px;
}
.reject-record {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid #f3c3c7;
  border-radius: 8px;
  background: #fff2f3;
}
.reject-record__head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #9f1d2a;
  font-weight: 700;
  margin-bottom: 8px;
}
.reject-record__head small {
  font-weight: 400;
  color: #b66b72;
}
.reject-record__reason {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px;
  color: #7f1d1d;
  white-space: pre-wrap;
  word-break: break-word;
}
.reject-record__reason label,
.reject-file-group__title {
  font-weight: 700;
}
.reject-record__meta {
  margin-top: 6px;
  color: #9f4f58;
  font-size: 12px;
}
.reject-record__files {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  margin-top: 12px;
}
.reject-file-group {
  min-height: 100%;
  padding: 10px;
  border: 1px solid rgba(243, 195, 199, 0.82);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.48);
  min-width: 0;
}
.reject-file-group__title {
  color: #7f1d1d;
  margin-bottom: 8px;
}
.reject-file-group__body {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 8px;
  align-items: start;
}
.reject-file-group__empty {
  min-height: 118px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed #f0b9bf;
  border-radius: 6px;
  color: #b66b72;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.38);
}
.reject-file {
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  min-width: 0;
  height: 178px;
  overflow: hidden;
}
.reject-file--image {
  position: relative;
  padding: 0;
}
.reject-file__image {
  width: 100%;
  height: 150px;
  border-radius: 8px;
  background: #fff;
}
.reject-file__download {
  position: absolute;
  right: 4px;
  bottom: 28px;
  background: rgba(255, 255, 255, 0.88);
  border-radius: 4px;
}
.reject-file__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 24px;
  padding: 0 6px;
  background: rgba(255, 255, 255, 0.92);
}
.reject-file--attachment {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}
.reject-file__info {
  flex: 1;
  min-width: 0;
}
.reject-file__info small {
  color: #9f4f58;
}
@media (max-width: 900px) {
  .reject-record__files {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 520px) {
  .reject-file-group__body {
    grid-template-columns: 1fr;
  }
}
</style>
