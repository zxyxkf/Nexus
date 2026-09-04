<template>
  <div v-if="records.length" class="modification-history">
    <div class="modification-history__title">修改历史</div>
    <el-collapse v-model="expandedRecords" class="modification-history__collapse">
      <el-collapse-item
        v-for="(record, index) in records"
        :key="recordKey(record, index)"
        :name="recordKey(record, index)"
      >
        <template #title>
          <div class="modification-record__head">
            <span>第 {{ record.reject_index || record.rejectIndex || index + 1 }} 次修改</span>
            <small>{{ formatTime(record.create_time) }}</small>
            <el-tag :type="isResubmitted(record, index) ? 'success' : 'warning'" size="small" effect="plain">
              {{ isResubmitted(record, index) ? '已重新提交' : '等待基础美工修改' }}
            </el-tag>
          </div>
        </template>

        <div class="modification-record__columns">
          <section class="modification-side">
            <h4>客服修改说明</h4>
            <div class="modification-side__text">{{ record.reject_reason || '暂无文字说明' }}</div>
            <div class="modification-side__meta">发起人：{{ record.reviewer_name || '-' }}</div>
            <div class="modification-side__subtitle">客服修改附件 ({{ customerFiles(record).length }})</div>
            <ModificationFiles :files="customerFiles(record)" />
          </section>

          <section class="modification-side">
            <h4>基础美工回复</h4>
            <div class="modification-side__text">{{ record.designer_reply || '暂无回复' }}</div>
            <div class="modification-side__subtitle">基础美工重新上传 ({{ designerFiles(record).length }})</div>
            <ModificationFiles :files="designerFiles(record)" />
          </section>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, ref, watch } from 'vue'
import { ElButton, ElIcon, ElImage } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
import { getFileUrl, saveFileToDisk, setupFileDrag } from '@/api'
import { formatFileSize } from '@/utils/format'

const props = defineProps({
  records: { type: Array, default: () => [] },
  taskStatus: { type: String, default: '' }
})

const records = computed(() => props.records || [])
const expandedRecords = ref([])

function recordKey(record, index) {
  return String(record.id ?? `record-${index}`)
}

watch(
  () => records.value.map((record, index) => recordKey(record, index)).join(','),
  () => {
    const lastIndex = records.value.length - 1
    expandedRecords.value = lastIndex >= 0 ? [recordKey(records.value[lastIndex], lastIndex)] : []
  },
  { immediate: true }
)

function customerFiles(record) {
  return (record.files || []).filter(file => file.file_category === 'reject')
}

function designerFiles(record) {
  return (record.files || []).filter(file => file.file_category === 'work')
}

function isResubmitted(record, index) {
  if (record.designer_complete_time) return true
  if (props.taskStatus === 'rejected' && index === records.value.length - 1) return false
  return Boolean(String(record.designer_reply || '').trim() || designerFiles(record).length)
}

function imagePreviewList(files) {
  return (files || [])
    .filter(file => file.file_type === 'image')
    .map(file => file._previewSrc || getFileUrl(file))
}

function imagePreviewIndex(files, currentFile) {
  return (files || [])
    .filter(file => file.file_type === 'image')
    .findIndex(file => file === currentFile || (file.id && file.id === currentFile.id))
}

const ModificationFiles = defineComponent({
  name: 'ModificationFiles',
  props: { files: { type: Array, default: () => [] } },
  setup(fileProps) {
    return () => {
      if (!fileProps.files.length) {
        return h('div', { class: 'modification-files__empty' }, '暂无文件')
      }
      return h('div', { class: 'modification-files' }, fileProps.files.map(file => {
        const isImage = file.file_type === 'image'
        const content = isImage
          ? [
              h(ElImage, {
                class: 'modification-file__image',
                src: file._previewSrc || getFileUrl(file),
                fit: 'contain',
                previewSrcList: imagePreviewList(fileProps.files),
                initialIndex: imagePreviewIndex(fileProps.files, file),
                previewTeleported: true
              }),
              h('div', { class: 'modification-file__name', title: file.file_name }, file.file_name),
              h(ElButton, {
                class: 'modification-file__download',
                type: 'primary',
                link: true,
                size: 'small',
                onClick: () => saveFileToDisk(file)
              }, () => '下载')
            ]
          : [
              h(ElIcon, { size: 24 }, () => h(Document)),
              h('div', { class: 'modification-file__info' }, [
                h('div', { class: 'modification-file__name', title: file.file_name }, file.file_name),
                h('small', formatFileSize(file.file_size))
              ]),
              h(ElButton, { type: 'primary', link: true, size: 'small', onClick: () => saveFileToDisk(file) }, () => '下载')
            ]
        return h('div', {
          key: file.id || file.file_path || file.file_name,
          class: ['modification-file', isImage ? 'modification-file--image' : 'modification-file--attachment'],
          draggable: true,
          onDragstart: event => setupFileDrag(event, file)
        }, content)
      }))
    }
  }
})

function formatTime(value) {
  return value || '-'
}
</script>

<style scoped>
.modification-history {
  grid-column: 1 / -1;
  align-self: stretch;
  width: 100%;
  min-width: 0;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--dd-border-light, #e4e7ed);
}
.modification-history__title {
  margin-bottom: 10px;
  color: var(--dd-text-primary, #303133);
  font-size: 15px;
  font-weight: 700;
}
.modification-history__collapse {
  border: 1px solid var(--dd-border-light, #e4e7ed);
  border-radius: 8px;
  overflow: hidden;
}
.modification-history__collapse :deep(.el-collapse-item__header) {
  min-height: 48px;
  height: auto;
  padding: 8px 14px;
  background: var(--dd-bg-secondary, #f7f8fa);
}
.modification-history__collapse :deep(.el-collapse-item__content) {
  padding: 14px;
}
.modification-history__collapse :deep(.el-collapse-item__wrap),
.modification-history__collapse :deep(.el-collapse-item:last-child) {
  border-bottom: 0;
}
.modification-record__head {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-width: 0;
  color: var(--dd-text-primary, #303133);
  font-weight: 700;
}
.modification-record__head small {
  flex: 1;
  color: var(--dd-text-muted, #909399);
  font-weight: 400;
}
.modification-record__columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.modification-side {
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--dd-border-light, #e4e7ed);
  border-radius: 8px;
  background: var(--dd-bg-card, #fff);
}
.modification-side h4,
.modification-side__subtitle {
  margin: 0 0 8px;
  color: var(--dd-text-primary, #303133);
  font-size: 13px;
  font-weight: 700;
}
.modification-side__text {
  min-height: 52px;
  padding: 9px 10px;
  border-radius: 6px;
  background: var(--dd-bg-secondary, #f5f7fa);
  color: var(--dd-text-regular, #606266);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
.modification-side__meta {
  margin: 7px 0 12px;
  color: var(--dd-text-muted, #909399);
  font-size: 12px;
}
.modification-side__subtitle {
  margin-top: 12px;
}
.modification-files {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
  gap: 8px;
  align-items: start;
}
.modification-files__empty {
  min-height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--dd-border, #dcdfe6);
  border-radius: 6px;
  color: var(--dd-text-muted, #909399);
  font-size: 13px;
}
.modification-file {
  min-width: 0;
  height: 178px;
  overflow: hidden;
  border: 1px solid var(--dd-border-light, #e4e7ed);
  border-radius: 8px;
  background: var(--dd-bg-card, #fff);
}
.modification-file--image {
  position: relative;
}
.modification-file__image {
  width: 100%;
  height: 150px;
  background: #fff;
}
.modification-file__download {
  position: absolute;
  right: 4px;
  bottom: 28px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.9);
}
.modification-file__name {
  overflow: hidden;
  padding: 0 6px;
  font-size: 12px;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.modification-file--attachment {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
}
.modification-file__info {
  flex: 1;
  min-width: 0;
}
.modification-file__info small {
  color: var(--dd-text-muted, #909399);
}
@media (max-width: 900px) {
  .modification-record__columns {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 520px) {
  .modification-record__head {
    flex-wrap: wrap;
  }
  .modification-files {
    grid-template-columns: 1fr;
  }
}
</style>
