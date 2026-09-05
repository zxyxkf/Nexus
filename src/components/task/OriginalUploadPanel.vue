<template>
  <section class="original-upload-panel">
    <div class="original-upload-head">
      <div>
        <h3>原图上传</h3>
        <p>{{ autoComplete ? '选择原图后点击完成上传即可提交任务' : '原图可以分批上传，全部完成后再提交任务' }}</p>
      </div>
      <el-tag type="warning" effect="plain">待上传原图</el-tag>
    </div>

    <div v-if="existingFiles.length" class="original-file-list">
      <article v-for="file in existingFiles" :key="file.id" class="original-file-item" draggable="true" @dragstart="setupFileDrag($event, file)">
        <el-image
          v-if="file.file_type === 'image'"
          class="original-file-thumb"
          :src="file._previewSrc || getFileUrl(file)"
          :preview-src-list="existingImages"
          :initial-index="existingImageIndex(file)"
          preview-teleported
          fit="contain"
        />
        <el-icon v-else class="original-file-icon" :size="24"><Document /></el-icon>
        <div class="original-file-meta">
          <span :title="file.file_name">{{ file.file_name || '未命名文件' }}</span>
          <small>{{ formatFileSize(file.file_size) }}</small>
        </div>
        <el-button link type="primary" size="small" @click="saveFileToDisk(file)">下载</el-button>
      </article>
    </div>

    <el-upload
      v-model:file-list="selectedFiles"
      class="original-upload"
      drag
      multiple
      :auto-upload="false"
      :limit="maxFileCount"
      accept="image/*,.psd,.ai,.zip,.rar,.7z"
      @change="handleChange"
      @remove="handleRemove"
    >
      <el-icon class="el-icon--upload" :size="42"><UploadFilled /></el-icon>
      <div class="el-upload__text">拖拽原图或源文件到此处，或<em>点击选择</em></div>
      <template #tip>
        <div class="el-upload__tip">支持图片、PSD、AI、ZIP 等文件，可保留原始文件名</div>
      </template>
    </el-upload>

    <div v-if="selectedFiles.length" class="original-selected-list">
      <div v-for="item in selectedFiles" :key="item.uid" class="original-selected-item">
        <el-icon><Document /></el-icon>
        <span :title="item.name">{{ item.name }}</span>
        <el-button circle text aria-label="移除文件" @click="removeSelected(item)">×</el-button>
      </div>
    </div>

    <el-progress v-if="uploading" :percentage="progress" :status="progress === 100 ? 'success' : undefined" />
    <div class="original-upload-actions">
      <el-button v-if="!autoComplete" type="primary" :loading="uploading" :disabled="!rawFiles.length" @click="uploadSelected">上传所选原图</el-button>
      <el-button type="success" :loading="completing" :disabled="!canComplete" @click="completeUpload">完成上传</el-button>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Document, UploadFilled } from '@element-plus/icons-vue'
import { completeOriginalUploadApi, getFileUrl, saveFileToDisk, setupFileDrag, uploadOriginalFilesApi } from '@/api'
import { formatFileSize } from '@/utils/format'

const props = defineProps({
  task: { type: Object, required: true },
  maxFileCount: { type: Number, default: 100 },
  maxFileSizeMB: { type: Number, default: 50 },
  autoComplete: { type: Boolean, default: false }
})
const emit = defineEmits(['completed', 'uploaded'])

const selectedFiles = ref([])
const uploading = ref(false)
const completing = ref(false)
const progress = ref(0)
const hasUploadedBatch = ref(false)

const existingFiles = computed(() => (props.task.files || []).filter(file => file.file_category === 'original'))
const existingImages = computed(() => existingFiles.value.filter(file => file.file_type === 'image').map(file => file._previewSrc || getFileUrl(file)))
const rawFiles = computed(() => selectedFiles.value.map(item => item.raw).filter(Boolean))
const canComplete = computed(() => {
  const hasPersistedFiles = existingFiles.value.length > 0 || hasUploadedBatch.value
  return props.autoComplete ? hasPersistedFiles || rawFiles.value.length > 0 : hasPersistedFiles
})

watch(() => props.task.id, () => {
  selectedFiles.value = []
  hasUploadedBatch.value = existingFiles.value.length > 0
  progress.value = 0
}, { immediate: true })

function existingImageIndex(file) {
  return existingFiles.value.filter(item => item.file_type === 'image').findIndex(item => Number(item.id) === Number(file.id))
}

function handleChange(uploadFile, uploadFiles) {
  if (uploadFile?.raw && props.maxFileSizeMB > 0 && uploadFile.raw.size > props.maxFileSizeMB * 1024 * 1024) {
    ElMessage.warning(`文件“${uploadFile.name}”超过${props.maxFileSizeMB}MB限制`)
    selectedFiles.value = uploadFiles.filter(item => item.uid !== uploadFile.uid)
    return
  }
  selectedFiles.value = uploadFiles
}

function handleRemove(_uploadFile, uploadFiles) {
  selectedFiles.value = uploadFiles
}

function removeSelected(item) {
  selectedFiles.value = selectedFiles.value.filter(file => file.uid !== item.uid)
}

async function uploadFilesInternal({ notify = true } = {}) {
  if (!rawFiles.value.length || uploading.value) return
  uploading.value = true
  progress.value = 0
  try {
    const response = await uploadOriginalFilesApi(props.task.id, rawFiles.value, {
      onUploadProgress: event => {
        if (event.total) progress.value = Math.min(99, Math.round(event.loaded * 100 / event.total))
      }
    })
    if (response.code !== 0) throw new Error(response.msg || '原图上传失败')
    progress.value = 100
    hasUploadedBatch.value = true
    selectedFiles.value = []
    if (notify) ElMessage.success(response.msg || '原图上传成功')
    emit('uploaded', props.task.id)
    return true
  } catch (error) {
    ElMessage.error(error.response?.data?.msg || error.message || '原图上传失败')
    return false
  } finally {
    uploading.value = false
    setTimeout(() => { progress.value = 0 }, 500)
  }
}

async function uploadSelected() {
  await uploadFilesInternal()
}

async function completeUpload() {
  if (completing.value || uploading.value || !canComplete.value) return
  completing.value = true
  try {
    if (props.autoComplete && rawFiles.value.length) {
      const uploaded = await uploadFilesInternal({ notify: false })
      if (!uploaded) return
    }
    const response = await completeOriginalUploadApi(props.task.id)
    if (response.code !== 0) throw new Error(response.msg || '完成原图上传失败')
    ElMessage.success(response.msg || '原图上传已完成')
    emit('completed', props.task.id)
  } catch (error) {
    ElMessage.error(error.response?.data?.msg || error.message || '完成原图上传失败')
  } finally {
    completing.value = false
  }
}
</script>

<style scoped>
.original-upload-panel { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--dd-border-light, #e4e7ed); }
.original-upload-head, .original-upload-actions, .original-file-item, .original-selected-item { display: flex; align-items: center; }
.original-upload-head { justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.original-upload-head h3 { margin: 0; font-size: 15px; }
.original-upload-head p { margin: 4px 0 0; color: var(--dd-text-muted, #909399); font-size: 12px; }
.original-file-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; margin-bottom: 12px; }
.original-file-item { min-width: 0; gap: 8px; padding: 7px 9px; border: 1px solid var(--dd-border-light, #e4e7ed); border-radius: 5px; }
.original-file-thumb { width: 42px; height: 42px; flex: 0 0 auto; border-radius: 4px; }
.original-file-icon { flex: 0 0 42px; color: var(--dd-text-muted, #909399); }
.original-file-meta { display: flex; flex: 1; min-width: 0; flex-direction: column; gap: 2px; }
.original-file-meta span, .original-selected-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.original-file-meta small { color: var(--dd-text-muted, #909399); font-size: 11px; }
.original-upload :deep(.el-upload), .original-upload :deep(.el-upload-dragger) { width: 100%; }
.original-upload :deep(.el-upload-dragger) { padding: 18px 12px; }
.original-selected-list { margin-top: 10px; border: 1px solid var(--dd-border-light, #e4e7ed); border-radius: 5px; }
.original-selected-item { gap: 7px; min-height: 34px; padding: 0 8px; border-bottom: 1px solid var(--dd-border-light, #e4e7ed); }
.original-selected-item:last-child { border-bottom: 0; }
.original-selected-item span { flex: 1; min-width: 0; font-size: 12px; }
.original-upload-actions { justify-content: flex-end; gap: 10px; margin-top: 14px; }
.original-upload-panel :deep(.el-progress) { margin-top: 12px; }
</style>
