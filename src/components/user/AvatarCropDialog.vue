<template>
  <input
    ref="fileInput"
    data-testid="avatar-file-input"
    class="avatar-file-input"
    type="file"
    accept="image/jpeg,image/png,image/webp"
    @change="handleFile"
  />

  <el-dialog
    v-model="visible"
    title="裁剪头像"
    width="680px"
    append-to-body
    :close-on-click-modal="false"
    :destroy-on-close="true"
    @closed="resetCrop"
  >
    <div class="avatar-crop-layout">
      <div class="avatar-crop-editor">
        <img
          v-if="sourceUrl"
          ref="imageRef"
          :src="sourceUrl"
          alt="待裁剪头像"
          @load="initializeCropper"
        />
      </div>

      <aside class="avatar-crop-sidebar">
        <span class="avatar-crop-label">预览</span>
        <div class="avatar-crop-preview"></div>
        <div class="avatar-zoom-controls">
          <el-tooltip content="缩小" placement="bottom">
            <el-button circle aria-label="缩小头像" @click="zoom(-0.1)">
              <el-icon><ZoomOut /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip content="放大" placement="bottom">
            <el-button circle aria-label="放大头像" @click="zoom(0.1)">
              <el-icon><ZoomIn /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </aside>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="saveAvatar">保存头像</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ZoomIn, ZoomOut } from '@element-plus/icons-vue'
import Cropper from 'cropperjs'
import 'cropperjs/dist/cropper.css'
import { uploadMyAvatarApi } from '@/api'
import { useUserStore } from '@/store'

const emit = defineEmits(['saved'])
const userStore = useUserStore()
const fileInput = ref(null)
const imageRef = ref(null)
const sourceUrl = ref('')
const visible = ref(false)
const saving = ref(false)
let cropper = null

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SOURCE_SIZE = 20 * 1024 * 1024
const MAX_SOURCE_DIMENSION = 12000

function selectFile() {
  if (!fileInput.value) return
  fileInput.value.value = ''
  fileInput.value.click()
}

function releaseSource() {
  if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value)
  sourceUrl.value = ''
}

function destroyCropper() {
  if (!cropper) return
  cropper.destroy()
  cropper = null
}

function resetCrop() {
  destroyCropper()
  releaseSource()
  saving.value = false
  if (fileInput.value) fileInput.value.value = ''
}

function readDimensions(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('图片无法读取'))
    image.src = url
  })
}

async function handleFile(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!ACCEPTED_TYPES.includes(file.type)) {
    ElMessage.error('只允许选择 JPG、PNG 或 WebP 图片')
    event.target.value = ''
    return
  }
  if (file.size > MAX_SOURCE_SIZE) {
    ElMessage.error('头像原图不能超过 20 MB')
    event.target.value = ''
    return
  }

  destroyCropper()
  releaseSource()
  const nextUrl = URL.createObjectURL(file)
  try {
    const dimensions = await readDimensions(nextUrl)
    if (dimensions.width > MAX_SOURCE_DIMENSION || dimensions.height > MAX_SOURCE_DIMENSION) {
      throw new Error('头像像素尺寸不能超过 12000 x 12000')
    }
    sourceUrl.value = nextUrl
    visible.value = true
    await nextTick()
  } catch (error) {
    URL.revokeObjectURL(nextUrl)
    ElMessage.error(error.message || '图片无法读取')
    event.target.value = ''
  }
}

function initializeCropper() {
  destroyCropper()
  if (!imageRef.value) return
  cropper = new Cropper(imageRef.value, {
    aspectRatio: 1,
    viewMode: 1,
    dragMode: 'move',
    autoCropArea: 1,
    background: false,
    guides: false,
    center: false,
    movable: true,
    zoomable: true,
    zoomOnWheel: true,
    scalable: false,
    rotatable: false,
    preview: '.avatar-crop-preview'
  })
}

function zoom(amount) {
  cropper?.zoom(amount)
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      value => value ? resolve(value) : reject(new Error('头像裁剪失败')),
      'image/webp',
      0.9
    )
  })
}

async function saveAvatar() {
  if (!cropper || saving.value) return
  saving.value = true
  try {
    const canvas = cropper.getCroppedCanvas({
      width: 512,
      height: 512,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high'
    })
    if (!canvas) throw new Error('头像裁剪失败')
    const blob = await canvasToBlob(canvas)
    const file = new File([blob], 'avatar.webp', { type: 'image/webp' })
    const res = await uploadMyAvatarApi(file)
    if (res.code !== 0) throw new Error(res.msg || '头像上传失败')
    await userStore.loadAvatar(true)
    visible.value = false
    emit('saved')
  } catch (error) {
    ElMessage.error(error.message || '头像上传失败')
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(resetCrop)

defineExpose({ selectFile })
</script>

<style scoped>
.avatar-file-input {
  display: none;
}

.avatar-crop-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 150px;
  gap: 24px;
  min-height: 390px;
}

.avatar-crop-editor {
  width: 100%;
  height: 390px;
  overflow: hidden;
  background: #151922;
  border: 1px solid var(--dd-border);
  border-radius: 6px;
}

.avatar-crop-editor img {
  display: block;
  max-width: 100%;
}

.avatar-crop-sidebar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding-top: 8px;
}

.avatar-crop-label {
  color: var(--dd-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.avatar-crop-preview {
  width: 128px;
  height: 128px;
  overflow: hidden;
  border: 3px solid var(--dd-bg-card);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--dd-border), 0 8px 20px rgba(15, 23, 42, 0.16);
}

.avatar-zoom-controls {
  display: flex;
  gap: 10px;
}

:deep(.cropper-view-box),
:deep(.cropper-face) {
  border-radius: 50%;
}

:deep(.cropper-view-box) {
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8);
  outline: 0;
}

@media (max-width: 720px) {
  .avatar-crop-layout {
    grid-template-columns: 1fr;
  }

  .avatar-crop-editor {
    height: 320px;
  }

  .avatar-crop-sidebar {
    flex-direction: row;
    justify-content: center;
    padding-top: 0;
  }
}
</style>
