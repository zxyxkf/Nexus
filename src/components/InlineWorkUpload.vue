<template>
  <div
    ref="rootEl"
    class="inline-work-upload"
    :class="{ 'is-drag-over': dragOver, 'is-disabled': disabled, 'is-uploading': uploading }"
    tabindex="0"
    @click="focusSelf"
    @paste="handlePaste"
    @dragenter.prevent="onDragEnter"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="handleDrop"
    @dblclick="openPicker"
  >
    <input ref="fileInput" type="file" class="inline-work-upload__input" multiple @change="handleFileInput" />
    <template v-if="uploading">
      <span class="inline-work-upload__text">上传中...</span>
    </template>
    <template v-else-if="fileCount > 0">
      <div
        v-if="imageFile"
        class="inline-work-upload__preview"
        draggable="true"
        @mousedown.left="preloadFilesForDrag([imageFile])"
        @mouseenter="preloadFilesForDrag([imageFile])"
        @dragstart.stop="setupFileDrag($event, imageFile)"
      >
        <el-image
          :src="getFileUrl(imageFile)"
          fit="cover"
        />
        <span v-if="fileCount > 1" class="inline-work-upload__count">{{ fileCount }}</span>
      </div>
      <span
        v-else
        class="inline-work-upload__text"
        draggable="true"
        @mousedown.left="preloadFilesForDrag(workFiles)"
        @mouseenter="preloadFilesForDrag(workFiles)"
        @dragstart.stop="setupFileDrag($event, workFiles[0])"
      >{{ fileCount }}个附件</span>
    </template>
    <template v-else>
      <span class="inline-work-upload__text">{{ placeholder }}</span>
    </template>
  </div>
  <teleport to="body">
    <div
      v-if="viewerVisible"
      class="inline-work-preview"
      :style="viewerOverlayStyle"
      tabindex="-1"
      @click.self="closeViewer"
      @keydown.esc="closeViewer"
    >
      <button class="inline-work-preview__close" :style="viewerCloseStyle" type="button" @click="closeViewer">×</button>
      <img
        v-if="viewerFile"
        class="inline-work-preview__image"
        :style="viewerImageStyle"
        :src="getFileUrl(viewerFile)"
        :alt="viewerFile?.file_name || '作品预览'"
        draggable="true"
        @click.stop
        @mousedown.left="preloadFilesForDrag([viewerFile])"
        @dragstart="setupFileDrag($event, viewerFile)"
      />
    </div>
  </teleport>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getFileUrl, setupFileDrag, preloadFilesForDrag } from '@/api'

const props = defineProps({
  files: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  uploading: { type: Boolean, default: false },
  placeholder: { type: String, default: '粘贴/拖入' },
  maxCount: { type: Number, default: 10 },
  maxSizeMB: { type: Number, default: 50 },
  pastePrefix: { type: String, default: 'work' }
})

const emit = defineEmits(['upload'])

const rootEl = ref(null)
const fileInput = ref(null)
const dragOver = ref(false)
const viewerVisible = ref(false)

const workFiles = computed(() => (props.files || []).filter(file => file.file_category !== 'reference' && file.file_category !== 'reject'))
const imageFile = computed(() => workFiles.value.find(file => file.file_type === 'image') || null)
const imagePreviewList = computed(() => workFiles.value.filter(file => file.file_type === 'image').map(file => getFileUrl(file)))
const viewerFile = computed(() => imageFile.value || null)
const fileCount = computed(() => workFiles.value.length)
const viewerOverlayStyle = {
  position: 'fixed',
  inset: '0',
  zIndex: 2200,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  padding: '48px',
  background: 'rgba(0, 0, 0, 0.72)',
  outline: 'none'
}
const viewerImageStyle = {
  maxWidth: 'min(92vw, 1400px)',
  maxHeight: '88vh',
  objectFit: 'contain',
  cursor: 'grab',
  userSelect: 'none',
  borderRadius: '4px',
  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.35)'
}
const viewerCloseStyle = {
  position: 'fixed',
  top: '20px',
  right: '24px',
  width: '40px',
  height: '40px',
  border: '0',
  borderRadius: '50%',
  background: 'rgba(0, 0, 0, 0.38)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '30px',
  lineHeight: '36px',
  textAlign: 'center'
}

function createPastedFile(blob) {
  const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type?.split('/')[1] || 'png'
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)
  return new File([blob], `${props.pastePrefix}-${stamp}.${ext}`, {
    type: blob.type || 'image/png',
    lastModified: Date.now()
  })
}

function validFiles(files) {
  const maxSize = Number(props.maxSizeMB || 0) * 1024 * 1024
  const accepted = files.filter(file => {
    if (maxSize > 0 && file.size > maxSize) {
      ElMessage.warning(`文件"${file.name}"超过${props.maxSizeMB}MB限制`)
      return false
    }
    return true
  })
  if (props.maxCount > 0 && accepted.length > props.maxCount) {
    ElMessage.warning(`一次最多上传${props.maxCount}个文件`)
    return accepted.slice(0, props.maxCount)
  }
  return accepted
}

function submitFiles(files) {
  if (props.disabled || props.uploading) return
  const accepted = validFiles(Array.from(files || []))
  if (!accepted.length) return
  emit('upload', accepted)
}

function handlePaste(event) {
  if (props.disabled || props.uploading) return
  const files = Array.from(event.clipboardData?.items || [])
    .filter(item => item.kind === 'file' && item.type?.startsWith('image/'))
    .map(item => item.getAsFile())
    .filter(Boolean)
    .map(createPastedFile)
  if (!files.length) return
  event.preventDefault()
  submitFiles(files)
}

function onDragEnter() {
  if (!props.disabled && !props.uploading) dragOver.value = true
}

function onDragOver() {
  if (!props.disabled && !props.uploading) dragOver.value = true
}

function onDragLeave(event) {
  if (!event.currentTarget?.contains(event.relatedTarget)) dragOver.value = false
}

function handleDrop(event) {
  dragOver.value = false
  if (props.disabled || props.uploading) return
  submitFiles(event.dataTransfer?.files)
}

function openPicker() {
  if (props.uploading) return
  if (fileCount.value > 0) {
    if (imagePreviewList.value.length) openViewer()
    return
  }
  if (props.disabled) return
  fileInput.value?.click()
}

async function openViewer() {
  viewerVisible.value = true
  await nextTick()
  document.querySelector('.inline-work-preview')?.focus()
}

function closeViewer() {
  viewerVisible.value = false
}

function focusSelf() {
  if (props.disabled || props.uploading) return
  rootEl.value?.focus()
}

function handleFileInput(event) {
  submitFiles(event.target.files)
  event.target.value = ''
}
</script>
