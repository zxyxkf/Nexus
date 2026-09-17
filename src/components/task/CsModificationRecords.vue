<template>
  <section v-if="showSection" class="cs-modification-records">
    <div class="modification-section-head">
      <div>
        <h3>修改历史</h3>
        <p>每次修改分别保留客服要求和基础美工处理结果</p>
      </div>
      <el-button
        v-if="canCreateCustomerRound"
        type="warning"
        size="small"
        @click="openCustomerDraft"
      >新增修改</el-button>
    </div>

    <el-collapse v-model="expandedRecords" class="modification-collapse">
      <el-collapse-item
        v-for="(record, index) in records"
        :key="recordKey(record, index)"
        :name="recordKey(record, index)"
        :ref="element => setRecordItemRef(recordKey(record, index), element)"
      >
        <template #title>
          <div class="modification-record-head">
            <span>第 {{ record.reject_index || index + 1 }} 次修改</span>
            <small>{{ record.create_time || '-' }}</small>
            <el-tag :type="record.designer_complete_time ? 'success' : 'warning'" size="small" effect="plain">
              {{ record.designer_complete_time ? '双方已完成' : '等待基础美工' }}
            </el-tag>
          </div>
        </template>

        <div class="modification-columns">
          <section class="modification-side modification-side--customer">
            <div class="modification-side-title">
              <strong>客服修改要求</strong>
              <span>{{ record.reviewer_name || '客服' }}</span>
            </div>
            <div class="modification-readonly-text">{{ record.reject_reason || '暂无文字说明' }}</div>
            <ModificationPersistedFiles :files="customerFiles(record)" />
          </section>

          <section class="modification-side modification-side--designer">
            <div class="modification-side-title">
              <strong>基础美工处理结果</strong>
              <span>{{ record.designer_name || (record.designer_complete_time ? '基础美工' : '待处理') }}</span>
            </div>

            <template v-if="isEditableDesignerRecord(record)">
              <el-input
                v-model="designerReply"
                type="textarea"
                :rows="4"
                maxlength="500"
                show-word-limit
                placeholder="填写本次处理结果"
              />
              <EditablePersistedFiles
                :files="retainedDesignerFiles"
                @remove="removeRetainedDesignerFile"
              />
              <ModificationUploader
                v-model="designerUploadFiles"
                :max-count="designerUploadLimit"
                :max-size-m-b="maxFileSizeMB"
                title="上传本次修改作品"
                @mouseenter="pasteTarget = 'designer'"
                @mouseleave="clearPasteTarget('designer')"
              />
              <label class="modification-score-field">
                <span>申请分数</span>
                <el-input-number v-model="designerScore" :min="1" :max="9999" :step="0.5" :precision="1" />
              </label>
              <div class="modification-complete-row">
                <span>文字或作品文件至少填写一项</span>
                <el-button type="primary" :loading="submitting" @click="completeDesignerRound">完成</el-button>
              </div>
            </template>

            <template v-else>
              <div class="modification-readonly-text">{{ record.designer_reply || '暂无处理结果' }}</div>
              <ModificationPersistedFiles :files="designerFiles(record)" />
              <div v-if="record.designer_complete_time" class="modification-result-meta">
                <span>完成时间：{{ record.designer_complete_time }}</span>
                <span>申请分数：{{ formatScore(record.applied_score) }}</span>
              </div>
            </template>
          </section>
        </div>
      </el-collapse-item>

      <el-collapse-item v-if="customerDraftOpen" ref="customerDraftItemRef" name="customer-draft">
        <template #title>
          <div class="modification-record-head">
            <span>第 {{ nextRoundIndex }} 次修改</span>
            <small>尚未完成</small>
            <el-tag type="warning" size="small" effect="plain">编辑中</el-tag>
          </div>
        </template>

        <div class="modification-columns">
          <section class="modification-side modification-side--customer">
            <div class="modification-side-title">
              <strong>客服修改要求</strong>
              <span>当前客服</span>
            </div>
            <el-input
              v-model="customerNote"
              type="textarea"
              :rows="4"
              maxlength="500"
              show-word-limit
              placeholder="填写本次修改要求"
            />
            <ModificationUploader
              v-model="customerUploadFiles"
              :max-count="maxFileCount"
              :max-size-m-b="maxFileSizeMB"
              title="上传修改说明附件"
              @mouseenter="pasteTarget = 'customer'"
              @mouseleave="clearPasteTarget('customer')"
            />
            <div class="modification-complete-row">
              <el-button text @click="cancelCustomerDraft">取消</el-button>
              <el-button type="warning" :loading="submitting" @click="completeCustomerRound">完成</el-button>
            </div>
          </section>
          <section class="modification-side modification-side--designer modification-side--waiting">
            <strong>基础美工处理结果</strong>
            <span>客服完成本次修改要求后，基础美工可在此处提交处理结果</span>
          </section>
        </div>
      </el-collapse-item>
    </el-collapse>
  </section>
</template>

<script setup>
import { computed, defineComponent, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElButton, ElIcon, ElImage, ElMessage, ElUpload } from 'element-plus'
import { Delete, Document, UploadFilled } from '@element-plus/icons-vue'
import { getFileUrl, saveFileToDisk, setupFileDrag } from '@/api'
import { useConfig } from '@/composables/useConfig'
import { appendClipboardImages, syncRawFiles } from '@/utils/clipboard-upload'
import { formatFileSize } from '@/utils/format'

const props = defineProps({
  task: { type: Object, default: null },
  mode: { type: String, default: 'readonly' },
  submitCustomer: { type: Function, default: null },
  submitDesigner: { type: Function, default: null }
})

const { getInt } = useConfig()
const maxFileCount = computed(() => getInt('upload.max_file_count', 10))
const maxFileSizeMB = computed(() => getInt('upload.max_file_size_mb', 50))
const records = computed(() => [...(props.task?.reject_records || [])].sort((left, right) => (
  Number(left.reject_index || 0) - Number(right.reject_index || 0)
)))
const latestRecord = computed(() => records.value[records.value.length - 1] || null)
const pendingRecord = computed(() => {
  const record = latestRecord.value
  return record && !record.designer_complete_time ? record : null
})
const canCreateCustomerRound = computed(() => (
  props.mode === 'customer' &&
  props.task?.status === 'doing' &&
  !pendingRecord.value &&
  !customerDraftOpen.value
))
const showSection = computed(() => records.value.length > 0 || props.mode === 'customer' || customerDraftOpen.value)
const nextRoundIndex = computed(() => Math.max(0, ...records.value.map(record => Number(record.reject_index) || 0)) + 1)
const designerUploadLimit = computed(() => Math.max(0, maxFileCount.value - retainedDesignerFiles.value.length))

const expandedRecords = ref([])
const customerDraftOpen = ref(false)
const customerNote = ref('')
const customerUploadFiles = ref([])
const designerReply = ref('')
const designerScore = ref(1)
const designerUploadFiles = ref([])
const retainedDesignerFiles = ref([])
const submitting = ref(false)
const pasteTarget = ref('')
const customerDraftItemRef = ref(null)
const recordItemRefs = new Map()

function recordKey(record, index) {
  return String(record.id ?? `record-${index}`)
}

function setRecordItemRef(key, element) {
  if (element) recordItemRefs.set(key, element)
  else recordItemRefs.delete(key)
}

async function scrollToModificationItem(item) {
  await nextTick()
  await new Promise(resolve => requestAnimationFrame(resolve))
  const target = item?.$el || item
  const scrollBody = target?.closest?.('.task-detail-body')
  if (!target || !scrollBody) return false
  const targetRect = target.getBoundingClientRect()
  const scrollBodyRect = scrollBody.getBoundingClientRect()
  scrollBody.scrollTo({
    top: Math.max(0, scrollBody.scrollTop + targetRect.top - scrollBodyRect.top - 12),
    behavior: 'auto'
  })
  return true
}

function customerFiles(record) {
  return (record.files || []).filter(file => file.file_category === 'reject')
}

function designerFiles(record) {
  return (record.files || []).filter(file => file.file_category === 'work')
}

function isEditableDesignerRecord(record) {
  return props.mode === 'designer' &&
    props.task?.status === 'rejected' &&
    pendingRecord.value &&
    Number(record.id) === Number(pendingRecord.value.id)
}

function formatScore(value) {
  const score = Number(value)
  return Number.isFinite(score) && score > 0 ? score : 1
}

function resetDesignerEditor() {
  const record = pendingRecord.value
  designerReply.value = record?.designer_reply || ''
  designerScore.value = formatScore(
    Number(record?.applied_score) > 0 ? record.applied_score : props.task?.applied_score
  )
  retainedDesignerFiles.value = record ? [...designerFiles(record)] : []
  designerUploadFiles.value = []
}

function resetExpansion() {
  customerDraftOpen.value = false
  customerNote.value = ''
  customerUploadFiles.value = []
  const record = pendingRecord.value
  expandedRecords.value = record ? [recordKey(record, records.value.length - 1)] : []
  resetDesignerEditor()
}

watch(
  () => `${props.task?.id || ''}:${records.value.map(record => `${record.id}:${record.designer_complete_time || ''}:${designerFiles(record).map(file => file.id).join('.')}`).join('|')}`,
  resetExpansion,
  { immediate: true }
)

function openCustomerDraft() {
  customerDraftOpen.value = true
  customerNote.value = ''
  customerUploadFiles.value = []
  expandedRecords.value = ['customer-draft']
}

async function openNewModification(options = {}) {
  if (!customerDraftOpen.value) {
    if (!canCreateCustomerRound.value) return false
    openCustomerDraft()
  }
  await nextTick()
  if (options.focus !== false) await scrollToModificationItem(customerDraftItemRef.value)
  return true
}

async function focusPendingModification() {
  const record = pendingRecord.value
  if (!record) return false
  const key = recordKey(record, records.value.length - 1)
  expandedRecords.value = [key]
  await nextTick()
  return scrollToModificationItem(recordItemRefs.get(key))
}

defineExpose({ openNewModification, focusPendingModification })

function cancelCustomerDraft() {
  customerDraftOpen.value = false
  customerNote.value = ''
  customerUploadFiles.value = []
  expandedRecords.value = []
}

function clearPasteTarget(target) {
  if (pasteTarget.value === target) pasteTarget.value = ''
}

function pasteIntoActiveUploader(event) {
  if (!pasteTarget.value) return
  const uploadList = pasteTarget.value === 'customer' ? customerUploadFiles : designerUploadFiles
  const existingCount = pasteTarget.value === 'designer' ? retainedDesignerFiles.value.length : 0
  appendClipboardImages(event, uploadList, null, {
    prefix: pasteTarget.value === 'customer' ? 'modification-request' : 'modification-work',
    maxCount: Math.max(0, maxFileCount.value - existingCount),
    maxSizeMB: maxFileSizeMB.value
  })
}

onMounted(() => window.addEventListener('paste', pasteIntoActiveUploader))
onBeforeUnmount(() => window.removeEventListener('paste', pasteIntoActiveUploader))

async function completeCustomerRound() {
  const note = customerNote.value.trim()
  const files = syncRawFiles(customerUploadFiles.value)
  if (!note && !files.length) {
    ElMessage.warning('请填写修改说明或上传附件')
    return
  }
  if (!props.submitCustomer || submitting.value) return
  submitting.value = true
  try {
    const saved = await props.submitCustomer({ taskId: props.task.id, note, files })
    if (saved !== false) cancelCustomerDraft()
  } finally {
    submitting.value = false
  }
}

function removeRetainedDesignerFile(file) {
  retainedDesignerFiles.value = retainedDesignerFiles.value.filter(item => Number(item.id) !== Number(file.id))
}

async function completeDesignerRound() {
  const record = pendingRecord.value
  const reply = designerReply.value.trim()
  const files = syncRawFiles(designerUploadFiles.value)
  if (!record || (!reply && !retainedDesignerFiles.value.length && !files.length)) {
    ElMessage.warning('请填写处理结果或上传作品')
    return
  }
  if (!props.submitDesigner || submitting.value) return
  submitting.value = true
  try {
    await props.submitDesigner({
      taskId: props.task.id,
      rejectRecordId: record.id,
      reply,
      appliedScore: designerScore.value,
      retainedFileIds: retainedDesignerFiles.value.map(file => file.id),
      files
    })
  } finally {
    submitting.value = false
  }
}

function previewList(files) {
  return (files || []).filter(file => file.file_type === 'image').map(file => file._previewSrc || getFileUrl(file))
}

function previewIndex(files, currentFile) {
  return (files || []).filter(file => file.file_type === 'image').findIndex(file => Number(file.id) === Number(currentFile.id))
}

const ModificationPersistedFiles = defineComponent({
  name: 'ModificationPersistedFiles',
  props: { files: { type: Array, default: () => [] } },
  setup(fileProps) {
    return () => fileProps.files.length
      ? h('div', { class: 'modification-file-list' }, fileProps.files.map(file => h('article', {
          key: file.id,
          class: 'modification-file',
          draggable: true,
          onDragstart: event => setupFileDrag(event, file)
        }, [
          file.file_type === 'image'
            ? h(ElImage, {
                class: 'modification-file-image',
                src: file._previewSrc || getFileUrl(file),
                fit: 'contain',
                previewSrcList: previewList(fileProps.files),
                initialIndex: previewIndex(fileProps.files, file),
                previewTeleported: true
              })
            : h(ElIcon, { size: 24 }, () => h(Document)),
          h('div', { class: 'modification-file-name', title: file.file_name }, file.file_name || '未命名文件'),
          h(ElButton, { type: 'primary', link: true, size: 'small', onClick: () => saveFileToDisk(file) }, () => '下载')
        ])))
      : h('div', { class: 'modification-empty-files' }, '暂无附件')
  }
})

const EditablePersistedFiles = defineComponent({
  name: 'EditablePersistedFiles',
  props: { files: { type: Array, default: () => [] } },
  emits: ['remove'],
  setup(fileProps, { emit }) {
    return () => fileProps.files.length
      ? h('div', { class: 'modification-retained-files' }, fileProps.files.map(file => h('div', {
          key: file.id,
          class: 'modification-retained-file'
        }, [
          h('span', { title: file.file_name }, file.file_name),
          h('small', formatFileSize(file.file_size)),
          h(ElButton, { circle: true, text: true, title: '移除文件', onClick: () => emit('remove', file) }, () => h(ElIcon, () => h(Delete)))
        ])))
      : null
  }
})

const ModificationUploader = defineComponent({
  name: 'ModificationUploader',
  props: {
    modelValue: { type: Array, default: () => [] },
    title: { type: String, default: '上传文件' },
    maxCount: { type: Number, default: 10 },
    maxSizeMB: { type: Number, default: 50 }
  },
  emits: ['update:modelValue', 'mouseenter', 'mouseleave'],
  setup(uploadProps, { emit }) {
    function updateFiles(uploadFile, uploadFiles) {
      if (uploadFile?.raw && uploadProps.maxSizeMB > 0 && uploadFile.raw.size > uploadProps.maxSizeMB * 1024 * 1024) {
        ElMessage.warning(`文件“${uploadFile.name}”超过${uploadProps.maxSizeMB}MB限制`)
        emit('update:modelValue', uploadFiles.filter(file => file.uid !== uploadFile.uid))
        return
      }
      emit('update:modelValue', uploadFiles)
    }
    return () => h('div', {
      class: 'modification-uploader-wrap',
      onMouseenter: () => emit('mouseenter'),
      onMouseleave: () => emit('mouseleave')
    }, [
      h(ElUpload, {
        class: 'modification-uploader',
        fileList: uploadProps.modelValue,
        listType: 'picture-card',
        'onUpdate:fileList': value => emit('update:modelValue', value),
        drag: true,
        multiple: true,
        autoUpload: false,
        limit: Math.max(1, uploadProps.maxCount),
        disabled: uploadProps.maxCount <= 0,
        onChange: updateFiles,
        onRemove: (uploadFile, uploadFiles) => emit('update:modelValue', uploadFiles)
      }, {
        default: () => [
          h(ElIcon, { size: 26 }, () => h(UploadFilled)),
          h('div', { class: 'modification-uploader-title' }, uploadProps.title),
          h('small', uploadProps.maxCount > 0 ? '拖拽、点击选择，或鼠标移入后粘贴截图' : '已达到文件数量上限')
        ]
      })
    ])
  }
})
</script>

<style scoped>
.cs-modification-records {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--dd-border-light, #e4e7ed);
}
.modification-section-head,
.modification-record-head,
.modification-side-title,
.modification-complete-row,
.modification-result-meta,
.modification-retained-file {
  display: flex;
  align-items: center;
}
.modification-section-head { justify-content: space-between; gap: 16px; margin-bottom: 10px; }
.modification-section-head h3 { margin: 0; font-size: 15px; letter-spacing: 0; }
.modification-section-head p { margin: 3px 0 0; color: var(--dd-text-muted, #909399); font-size: 12px; }
.modification-collapse { overflow: hidden; border: 1px solid var(--dd-border-light, #e4e7ed); border-radius: 6px; }
.modification-collapse :deep(.el-collapse-item__header) { min-height: 48px; height: auto; padding: 8px 14px; background: var(--dd-bg-secondary, #f7f8fa); }
.modification-collapse :deep(.el-collapse-item__content) { padding: 14px; }
.modification-collapse :deep(.el-collapse-item__wrap),
.modification-collapse :deep(.el-collapse-item:last-child) { border-bottom: 0; }
.modification-record-head { width: 100%; min-width: 0; gap: 12px; font-weight: 700; }
.modification-record-head small { flex: 1; color: var(--dd-text-muted, #909399); font-weight: 400; }
.modification-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.modification-side { min-width: 0; padding: 13px; border: 1px solid var(--dd-border-light, #e4e7ed); border-radius: 6px; background: #fff; }
.modification-side--customer { border-top: 3px solid var(--el-color-warning-light-3); }
.modification-side--designer { border-top: 3px solid var(--el-color-primary-light-3); }
.modification-side-title { justify-content: space-between; gap: 12px; margin-bottom: 10px; font-size: 13px; }
.modification-side-title span { color: var(--dd-text-muted, #909399); font-size: 12px; }
.modification-readonly-text { min-height: 70px; padding: 10px; border-radius: 4px; background: var(--dd-bg-secondary, #f5f7fa); color: var(--dd-text-regular, #606266); line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
.modification-file-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(126px, 1fr)); gap: 8px; margin-top: 10px; }
.modification-file { display: grid; grid-template-rows: 92px 24px 28px; min-width: 0; overflow: hidden; border: 1px solid var(--dd-border-light, #e4e7ed); border-radius: 5px; text-align: center; }
.modification-file > .el-icon { align-self: center; justify-self: center; }
.modification-file-image { width: 100%; height: 92px; background: #fff; }
.modification-file-name { overflow: hidden; padding: 0 6px; font-size: 12px; line-height: 24px; text-overflow: ellipsis; white-space: nowrap; }
.modification-empty-files { display: flex; align-items: center; justify-content: center; min-height: 68px; margin-top: 10px; border: 1px dashed var(--dd-border, #dcdfe6); border-radius: 5px; color: var(--dd-text-muted, #909399); font-size: 12px; }
.modification-retained-files { margin-top: 10px; border: 1px solid var(--dd-border-light, #e4e7ed); border-radius: 5px; }
.modification-retained-file { min-height: 36px; gap: 8px; padding: 0 8px; border-bottom: 1px solid var(--dd-border-light, #e4e7ed); }
.modification-retained-file:last-child { border-bottom: 0; }
.modification-retained-file span { flex: 1; min-width: 0; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.modification-retained-file small { color: var(--dd-text-muted, #909399); }
.modification-uploader-wrap { margin-top: 10px; }
.modification-uploader :deep(.el-upload),
.modification-uploader :deep(.el-upload-dragger) { width: 100%; }
.modification-uploader :deep(.el-upload-dragger) { padding: 15px 10px; border-radius: 5px; }
.modification-uploader-wrap:hover :deep(.el-upload-dragger) { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.modification-uploader-title { margin-top: 4px; color: var(--dd-text-regular, #606266); font-size: 13px; }
.modification-uploader small { color: var(--dd-text-muted, #909399); font-size: 11px; }
.modification-score-field { display: flex; align-items: center; gap: 10px; margin-top: 12px; color: var(--dd-text-regular, #606266); font-size: 13px; }
.modification-score-field :deep(.el-input-number) { width: 130px; }
.modification-complete-row { justify-content: flex-end; gap: 12px; margin-top: 12px; }
.modification-complete-row > span { flex: 1; color: var(--dd-text-muted, #909399); font-size: 11px; }
.modification-side--waiting { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 240px; color: var(--dd-text-muted, #909399); text-align: center; }
.modification-side--waiting strong { margin-bottom: 8px; color: var(--dd-text-regular, #606266); }
.modification-result-meta { flex-wrap: wrap; gap: 8px 18px; margin-top: 10px; color: var(--dd-text-muted, #909399); font-size: 12px; }
@media (max-width: 900px) { .modification-columns { grid-template-columns: 1fr; } }
</style>
