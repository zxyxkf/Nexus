<template>
  <div class="image-gallery">
    <div class="gallery-toolbar">
      <div>
        <strong>{{ label }}</strong>
        <span>{{ categoryImages.length }} 张</span>
      </div>
      <input
        ref="fileInput"
        class="file-input"
        type="file"
        accept="image/*"
        multiple
        @change="uploadFiles"
      />
    </div>

    <button
      v-if="!readonly"
      type="button"
      class="image-gallery-dropzone"
      :class="{ 'is-busy': busy }"
      :disabled="busy"
      @click="fileInput?.click()"
      @dragover.prevent
      @drop.prevent="handleDrop"
      @paste="handlePaste"
    >
      <el-icon :size="22"><Upload /></el-icon>
      <span>拖拽图片到此处、点击上传，或点击后粘贴截图</span>
      <small>支持 JPG、PNG、WEBP 等图片格式</small>
    </button>

    <div v-if="categoryImages.length" class="image-grid">
      <figure
        v-for="(image, index) in categoryImages"
        :key="image.id"
        class="image-item"
        :draggable="Boolean(sourceTaskFile(image))"
        @dragstart="dragSourceTaskImage($event, image)"
      >
        <el-image
          class="gallery-image"
          :src="previewUrls[index]"
          :preview-src-list="previewUrls"
          :initial-index="index"
          fit="cover"
          preview-teleported
        />
        <figcaption>
          <span v-if="category === 'product_main' && index === 0" class="cover-label">封面</span>
          <span class="image-name" :title="image.originalName">{{ image.originalName || `图片 ${index + 1}` }}</span>
        </figcaption>
        <div v-if="!readonly" class="image-actions">
          <el-tooltip content="向前移动" placement="top">
            <el-button
              circle
              size="small"
              :icon="ArrowLeft"
              :disabled="busy || index === 0"
              aria-label="向前移动"
              @click="moveImage(index, -1)"
            />
          </el-tooltip>
          <el-tooltip content="向后移动" placement="top">
            <el-button
              circle
              size="small"
              :icon="ArrowRight"
              :disabled="busy || index === categoryImages.length - 1"
              aria-label="向后移动"
              @click="moveImage(index, 1)"
            />
          </el-tooltip>
          <el-tooltip content="删除图片" placement="top">
            <el-button
              circle
              size="small"
              type="danger"
              plain
              :icon="Delete"
              :disabled="busy"
              aria-label="删除图片"
              @click="removeImage(image)"
            />
          </el-tooltip>
        </div>
      </figure>
    </div>
    <div v-else class="image-empty">暂无图片</div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ArrowLeft, ArrowRight, Delete, Upload } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  deletePaymentImageApi,
  getPaymentImageUrl,
  registerFileDragUrl,
  setupFileDrag,
  sortPaymentImagesApi,
  uploadPaymentImagesApi
} from '@/api'

const props = defineProps({
  recordId: { type: [Number, String], required: true },
  version: { type: Number, required: true },
  images: { type: Array, default: () => [] },
  category: { type: String, required: true },
  label: { type: String, required: true },
  ownerId: { type: [Number, String], default: null },
  beforeUpload: { type: Function, default: null },
  readonly: Boolean
})

const emit = defineEmits(['record-updated', 'reload-requested'])
const fileInput = ref(null)
const busy = ref(false)
const CLIPBOARD_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
}
const categoryImages = computed(() => props.images
  .filter(image => {
    if (image.category !== props.category) return false
    if (props.category !== 'adjustment_feedback') return true
    if (props.ownerId === null || props.ownerId === undefined || props.ownerId === '') return false
    return Number(image.adjustmentId) === Number(props.ownerId)
  })
  .sort((a, b) => (a.sortOrder - b.sortOrder) || (a.id - b.id)))
const previewUrls = computed(() => categoryImages.value.map(image => {
  const url = getPaymentImageUrl(image)
  const file = sourceTaskFile(image)
  return file ? registerFileDragUrl(url, file) : url
}))

function sourceTaskFile(image) {
  if (!image?.sourceTaskFileId || !image?.originalName) return null
  return { id: image.sourceTaskFileId, file_name: image.originalName }
}

function dragSourceTaskImage(event, image) {
  const file = sourceTaskFile(image)
  if (file) setupFileDrag(event, file)
}

function handleVersionConflict(response) {
  if (Number(response?.code) !== 409) return false
  ElMessage.warning(response.msg || '记录已被其他人更新，请刷新后重试')
  emit('reload-requested')
  return true
}

async function uploadFiles(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  await uploadFileList(files)
}

async function handleDrop(event) {
  await uploadFileList(Array.from(event.dataTransfer?.files || []))
}

function nameClipboardFile(file, timestamp, index) {
  if (String(file.name || '').trim()) return file
  const mimeType = String(file.type || 'image/png').toLowerCase()
  const extension = CLIPBOARD_EXTENSIONS[mimeType] || 'png'
  return new File(
    [file],
    `clipboard-${timestamp}-${index + 1}.${extension}`,
    { type: mimeType, lastModified: file.lastModified || timestamp }
  )
}

async function handlePaste(event) {
  if (busy.value) return
  const timestamp = Date.now()
  const files = Array.from(event.clipboardData?.items || [])
    .filter(item => item.kind === 'file' && String(item.type || '').toLowerCase().startsWith('image/'))
    .map(item => item.getAsFile())
    .filter(Boolean)
    .map((file, index) => nameClipboardFile(file, timestamp, index))

  if (!files.length) {
    ElMessage.warning('剪贴板中没有图片')
    return
  }
  event.preventDefault()
  await uploadFileList(files)
}

async function uploadFileList(files) {
  if (!files.length) return
  busy.value = true
  try {
    let version = props.version
    let ownerId = props.ownerId
    if (props.beforeUpload) {
      const prepared = await props.beforeUpload()
      if (!prepared) return
      version = prepared.version
      ownerId = prepared.ownerId ?? ownerId
    }
    const response = await uploadPaymentImagesApi(
      props.recordId,
      props.category,
      files,
      version,
      ownerId
    )
    if (handleVersionConflict(response)) return
    if (response.code === 0) {
      emit('record-updated', response.data)
      ElMessage.success(`已上传 ${files.length} 张图片`)
    }
  } finally {
    busy.value = false
  }
}

async function moveImage(index, offset) {
  const nextIndex = index + offset
  if (nextIndex < 0 || nextIndex >= categoryImages.value.length) return
  const ordered = [...categoryImages.value]
  ;[ordered[index], ordered[nextIndex]] = [ordered[nextIndex], ordered[index]]
  busy.value = true
  try {
    const response = await sortPaymentImagesApi(props.recordId, ordered.map(image => image.id), props.version)
    if (handleVersionConflict(response)) return
    if (response.code === 0) emit('record-updated', response.data)
  } finally {
    busy.value = false
  }
}

async function removeImage(image) {
  try {
    await ElMessageBox.confirm('确认删除这张图片？', '删除图片', {
      confirmButtonText: '确认删除',
      type: 'warning'
    })
    busy.value = true
    const response = await deletePaymentImageApi(props.recordId, image.id, props.version)
    if (handleVersionConflict(response)) return
    if (response.code === 0) {
      emit('record-updated', response.data)
      ElMessage.success('图片已删除')
    }
  } catch {
    // 用户取消时保持当前图片列表。
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.image-gallery {
  min-width: 0;
}

.gallery-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.gallery-toolbar > div {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.gallery-toolbar strong {
  font-size: 14px;
}

.gallery-toolbar span,
.image-empty {
  color: var(--dd-text-secondary, #909399);
  font-size: 12px;
}

.file-input {
  display: none;
}

.image-gallery-dropzone {
  display: flex;
  width: 100%;
  min-height: 86px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  margin-bottom: 12px;
  padding: 14px 16px;
  border: 1px dashed #b9c3d2;
  border-radius: 6px;
  background: #f8fafc;
  color: #526174;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.image-gallery-dropzone:hover:not(:disabled),
.image-gallery-dropzone:focus-visible:not(:disabled) {
  border-color: #409eff;
  background: #f0f7ff;
  outline: none;
}

.image-gallery-dropzone span {
  font-size: 13px;
  font-weight: 600;
}

.image-gallery-dropzone small {
  color: #909399;
  font-size: 12px;
}

.image-gallery-dropzone.is-busy {
  cursor: wait;
  opacity: 0.7;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(124px, 1fr));
  gap: 10px;
}

.image-item {
  min-width: 0;
  margin: 0;
  padding: 7px;
  border: 1px solid var(--dd-border-light, #e4e7ed);
  border-radius: 6px;
  background: var(--dd-bg-card, #fff);
}

.gallery-image {
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: 4px;
  cursor: zoom-in;
}

.image-item figcaption {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 27px;
  min-width: 0;
  font-size: 12px;
}

.cover-label {
  color: #237a4b;
  font-weight: 600;
  white-space: nowrap;
}

.image-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.image-actions {
  display: flex;
  justify-content: center;
  gap: 5px;
  min-height: 24px;
}

.image-actions :deep(.el-button + .el-button) {
  margin-left: 0;
}

.image-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72px;
  border: 1px dashed var(--dd-border, #dcdfe6);
  border-radius: 6px;
  background: var(--dd-bg-secondary, #f5f7fa);
}
</style>
