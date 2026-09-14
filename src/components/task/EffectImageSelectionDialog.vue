<template>
  <el-dialog
    :model-value="modelValue"
    title="选择最终效果图"
    width="min(760px, calc(100vw - 32px))"
    append-to-body
    destroy-on-close
    class="effect-selection-dialog"
    @update:model-value="handleVisibleChange"
  >
    <div v-if="task" class="effect-selection-content">
      <div class="effect-selection-summary">
        <span>任务 {{ task.task_no || '-' }}</span>
        <span>单击选择或取消，双击预览大图</span>
        <el-tag type="primary" size="small">已选 {{ selectedIds.length }} 张</el-tag>
      </div>

      <div v-if="sections.length" class="effect-selection-sections">
        <section
          v-for="section in sections"
          :key="section.key"
          class="effect-selection-section"
        >
          <button type="button" class="effect-selection-section-head" @click="toggleSection(section.key)">
            <span class="effect-selection-section-title">
              <span class="effect-selection-chevron" :class="{ 'is-open': isExpanded(section.key) }">›</span>
              <strong>{{ section.title }}</strong>
              <small>{{ section.files.length }} 张效果图</small>
            </span>
            <span v-if="section.selectedCount" class="effect-selection-section-count">
              已选 {{ section.selectedCount }}
            </span>
          </button>

          <div v-show="isExpanded(section.key)" class="effect-selection-grid">
            <div v-if="section.customerNote || section.designerReply" class="effect-selection-dialogue">
              <div v-if="section.customerNote" class="effect-selection-dialogue-item">
                <strong>客服说明</strong>
                <p>{{ section.customerNote }}</p>
              </div>
              <div v-if="section.designerReply" class="effect-selection-dialogue-item">
                <strong>基础美工回复</strong>
                <p>{{ section.designerReply }}</p>
              </div>
            </div>
            <div v-if="!section.files.length" class="effect-selection-no-files">本次修改没有上传效果图</div>
            <button
              v-for="file in section.files"
              :key="file.id"
              type="button"
              class="effect-selection-file"
              :class="{ 'is-selected': isSelected(file) }"
              :title="file.file_name || '未命名文件'"
              @click="handleClick(file)"
              @dblclick="handleDoubleClick(file)"
            >
              <img :src="fileSrc(file)" :alt="file.file_name || '效果图'" loading="lazy" />
              <span class="effect-selection-check">✓</span>
              <span class="effect-selection-file-name">{{ file.file_name || '未命名文件' }}</span>
            </button>
          </div>
        </section>
      </div>

      <div v-else class="effect-selection-empty">
        当前任务暂无可选择的效果图，将按原流程进入待上传原图。
      </div>
    </div>
    <div v-else class="effect-selection-empty">正在加载任务详情…</div>

    <template #footer>
      <div class="effect-selection-footer">
        <span v-if="hasImages && !selectedIds.length" class="effect-selection-hint">请至少选择一张效果图</span>
        <span v-else class="effect-selection-hint">未选择时将沿用最新效果图</span>
        <div class="effect-selection-actions">
          <el-button @click="close">取消</el-button>
          <el-button
            type="primary"
            :loading="loading"
            :disabled="hasImages && !selectedIds.length"
            @click="confirm"
          >确认通过</el-button>
        </div>
      </div>
    </template>
  </el-dialog>

  <el-dialog
    v-model="previewVisible"
    title="效果图预览"
    width="min(760px, calc(100vw - 32px))"
    append-to-body
    class="effect-selection-preview-dialog"
  >
    <img v-if="previewSrc" :src="previewSrc" class="effect-selection-preview-image" alt="效果图预览" />
  </el-dialog>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getFileUrl } from '@/api'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  task: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'cancel'])

const selectedIds = ref([])
const expandedKeys = ref([])
const previewVisible = ref(false)
const previewSrc = ref('')
let clickTimer = null

const initialFiles = computed(() => (props.task?.files || []).filter(file => (
  file.file_category === 'work' &&
  file.file_type === 'image' &&
  !Number(file.reject_record_id)
)))

const modificationSections = computed(() => [...(props.task?.reject_records || [])]
  .sort((left, right) => Number(right.reject_index || 0) - Number(left.reject_index || 0))
  .map((record, index) => ({
    key: `modification-${record.id ?? index}`,
    title: `第 ${record.reject_index || index + 1} 次修改`,
    customerNote: record.reject_reason || '',
    designerReply: record.designer_reply || '',
    files: (record.files || []).filter(file => (
      file.file_category === 'work' && file.file_type === 'image'
    ))
  })))

const sections = computed(() => [
  ...(initialFiles.value.length
    ? [{ key: 'initial', title: '首次上传', files: initialFiles.value }]
    : []),
  ...modificationSections.value
].map(section => ({
  ...section,
  selectedCount: section.files.filter(file => selectedIds.value.includes(Number(file.id))).length
})))

const allFiles = computed(() => sections.value.flatMap(section => section.files))
const hasImages = computed(() => allFiles.value.length > 0)

function fileSrc(file) {
  return file?._previewSrc || getFileUrl(file)
}

function resetState() {
  selectedIds.value = (props.task?.files || [])
    .filter(file => file.is_selected_effect)
    .map(file => Number(file.id))
    .filter(Number.isInteger)
  expandedKeys.value = sections.value.length
    ? sections.value.slice(0, 2).map(section => section.key)
    : []
  previewVisible.value = false
  previewSrc.value = ''
}

watch(
  () => [props.modelValue, props.task?.id],
  ([visible]) => { if (visible) resetState() },
  { immediate: true }
)

function isExpanded(key) { return expandedKeys.value.includes(key) }

function toggleSection(key) {
  expandedKeys.value = isExpanded(key)
    ? expandedKeys.value.filter(item => item !== key)
    : [...expandedKeys.value, key]
}

function isSelected(file) { return selectedIds.value.includes(Number(file.id)) }

function toggleFile(file) {
  const id = Number(file.id)
  if (!Number.isInteger(id)) return
  selectedIds.value = isSelected(file)
    ? selectedIds.value.filter(item => item !== id)
    : [...selectedIds.value, id]
}

function handleClick(file) {
  clearTimeout(clickTimer)
  clickTimer = setTimeout(() => toggleFile(file), 180)
}

function handleDoubleClick(file) {
  clearTimeout(clickTimer)
  clickTimer = null
  previewSrc.value = fileSrc(file)
  previewVisible.value = true
}

function close() {
  emit('update:modelValue', false)
  emit('cancel')
}

function handleVisibleChange(value) {
  emit('update:modelValue', value)
  if (!value) emit('cancel')
}

function confirm() {
  if (props.loading || (hasImages.value && !selectedIds.value.length)) return
  emit('confirm', [...selectedIds.value])
}

onBeforeUnmount(() => clearTimeout(clickTimer))
</script>

<style scoped>
.effect-selection-content { min-height: 180px; }
.effect-selection-summary,
.effect-selection-section-title,
.effect-selection-footer,
.effect-selection-actions { display: flex; align-items: center; }
.effect-selection-summary { gap: 14px; padding-bottom: 12px; color: #606266; font-size: 13px; }
.effect-selection-summary span:nth-child(2) { flex: 1; color: #909399; font-size: 12px; }
.effect-selection-sections { max-height: min(58vh, 540px); overflow: auto; padding-right: 3px; }
.effect-selection-section { margin-bottom: 10px; border: 1px solid #e4e7ed; border-radius: 6px; overflow: hidden; }
.effect-selection-section-head { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 44px; padding: 0 12px; border: 0; background: #f7f8fa; color: #303133; cursor: pointer; text-align: left; }
.effect-selection-section-title { gap: 8px; }
.effect-selection-section-title small { color: #909399; font-weight: 400; }
.effect-selection-section-count { color: var(--el-color-primary); font-size: 12px; }
.effect-selection-chevron { display: inline-block; color: #909399; font-size: 20px; line-height: 1; transform: rotate(0deg); transition: transform .15s ease; }
.effect-selection-chevron.is-open { transform: rotate(90deg); }
.effect-selection-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(112px, 1fr)); gap: 10px; padding: 12px; }
.effect-selection-dialogue { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-bottom: 2px; }
.effect-selection-dialogue-item { min-width: 0; padding: 8px 10px; border-radius: 5px; background: #f5f7fa; }
.effect-selection-dialogue-item strong { display: block; margin-bottom: 3px; color: #606266; font-size: 12px; }
.effect-selection-dialogue-item p { margin: 0; color: #606266; font-size: 12px; line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.effect-selection-no-files { grid-column: 1 / -1; padding: 10px; color: #909399; font-size: 12px; text-align: center; }
.effect-selection-file { position: relative; min-width: 0; padding: 0 0 5px; border: 1px solid #dcdfe6; border-radius: 5px; background: #fff; cursor: pointer; overflow: hidden; text-align: left; }
.effect-selection-file:hover { border-color: var(--el-color-primary); }
.effect-selection-file.is-selected { border: 2px solid var(--el-color-primary); padding: 0 0 4px; }
.effect-selection-file img { display: block; width: 100%; height: 104px; object-fit: contain; background: #f5f7fa; }
.effect-selection-check { position: absolute; top: 6px; right: 6px; display: none; width: 20px; height: 20px; border-radius: 50%; background: var(--el-color-primary); color: #fff; font-size: 13px; line-height: 20px; text-align: center; }
.effect-selection-file.is-selected .effect-selection-check { display: block; }
.effect-selection-file-name { display: block; overflow: hidden; padding: 4px 7px 0; color: #606266; font-size: 11px; line-height: 18px; text-overflow: ellipsis; white-space: nowrap; }
.effect-selection-empty { display: flex; align-items: center; justify-content: center; min-height: 150px; color: #909399; font-size: 13px; }
.effect-selection-footer { justify-content: space-between; gap: 12px; }
.effect-selection-hint { flex: 1; color: #909399; font-size: 12px; }
.effect-selection-actions { gap: 8px; }
.effect-selection-preview-image { display: block; max-width: 100%; max-height: 68vh; margin: 0 auto; object-fit: contain; }
@media (max-width: 600px) {
  .effect-selection-summary { flex-wrap: wrap; }
  .effect-selection-summary span:nth-child(2) { order: 3; flex-basis: 100%; }
  .effect-selection-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; padding: 8px; }
  .effect-selection-dialogue { grid-template-columns: 1fr; }
  .effect-selection-file img { height: 82px; }
  .effect-selection-footer { align-items: flex-end; flex-direction: column; }
}
</style>
