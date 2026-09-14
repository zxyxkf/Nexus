<template>
  <div v-if="previewItems.length" class="selected-file-preview">
    <div v-if="imageItems.length" class="selected-file-preview__grid">
      <article v-for="(item, index) in imageItems" :key="item.key" class="selected-file-preview__image-item">
        <el-image
          class="selected-file-preview__image"
          :src="item.url"
          :preview-src-list="imagePreviewUrls"
          :initial-index="index"
          preview-teleported
          fit="contain"
        />
        <el-button
          class="selected-file-preview__remove selected-file-preview__remove--image"
          circle
          type="danger"
          size="small"
          aria-label="移除文件"
          @click.stop="emit('remove', item.file)"
        >
          <el-icon><Close /></el-icon>
        </el-button>
        <span :title="item.name">{{ item.name }}</span>
      </article>
    </div>

    <div v-if="attachmentItems.length" class="selected-file-preview__attachments">
      <div v-for="item in attachmentItems" :key="item.key" class="selected-file-preview__attachment">
        <el-icon :size="20"><Document /></el-icon>
        <div class="selected-file-preview__meta">
          <span :title="item.name">{{ item.name }}</span>
          <small>{{ formatFileSize(item.size) }}</small>
        </div>
        <el-button
          class="selected-file-preview__remove"
          circle
          text
          aria-label="移除文件"
          @click="emit('remove', item.file)"
        >
          <el-icon><Close /></el-icon>
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Close, Document } from '@element-plus/icons-vue'
import { formatFileSize } from '@/utils/format'

const props = defineProps({
  files: { type: Array, default: () => [] }
})

const emit = defineEmits(['remove'])
const previewItems = ref([])
const objectUrls = new Map()

const imageItems = computed(() => previewItems.value.filter(item => item.isImage))
const attachmentItems = computed(() => previewItems.value.filter(item => !item.isImage))
const imagePreviewUrls = computed(() => imageItems.value.map(item => item.url))

watch(
  () => props.files,
  files => syncPreviewItems(files || []),
  { immediate: true, deep: true }
)

onBeforeUnmount(revokeAllObjectUrls)

function isPreviewableImage(file, raw) {
  const name = String(file?.name || raw?.name || '')
  const type = String(raw?.type || file?.raw?.type || '').toLowerCase()
  return /\.(jpe?g|png|gif|webp|bmp|svg|avif)$/i.test(name)
    || /^image\/(jpeg|png|gif|webp|bmp|svg\+xml|avif)$/.test(type)
}

function syncPreviewItems(files) {
  const activeKeys = new Set()
  const nextItems = files.map((file, index) => {
    const raw = file?.raw || file
    const key = file?.uid ?? `${index}:${file?.name || raw?.name || ''}`
    const isImage = isPreviewableImage(file, raw)
    let url = ''

    if (isImage && typeof file?.url === 'string' && file.url) {
      url = file.url
    } else if (isImage && typeof Blob !== 'undefined' && raw instanceof Blob) {
      activeKeys.add(key)
      const cached = objectUrls.get(key)
      if (cached?.raw === raw) {
        url = cached.url
      } else {
        if (cached?.url) URL.revokeObjectURL(cached.url)
        url = URL.createObjectURL(raw)
        objectUrls.set(key, { raw, url })
      }
    }

    return {
      key,
      file,
      isImage: isImage && Boolean(url),
      url,
      name: file?.name || raw?.name || '未命名文件',
      size: raw?.size || file?.size || 0
    }
  })

  for (const [key, cached] of objectUrls) {
    if (!activeKeys.has(key)) {
      URL.revokeObjectURL(cached.url)
      objectUrls.delete(key)
    }
  }

  previewItems.value = nextItems
}

function revokeAllObjectUrls() {
  for (const cached of objectUrls.values()) URL.revokeObjectURL(cached.url)
  objectUrls.clear()
}
</script>

<style scoped>
.selected-file-preview { margin-top: 12px; }
.selected-file-preview__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 10px;
}
.selected-file-preview__image-item {
  position: relative;
  min-width: 0;
  margin: 0;
}
.selected-file-preview__image {
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid var(--dd-border-light, #e4e7ed);
  border-radius: 6px;
  background: var(--dd-bg-secondary, #f5f7fa);
  cursor: zoom-in;
}
.selected-file-preview__image-item > span {
  display: block;
  margin-top: 4px;
  overflow: hidden;
  color: var(--dd-text-secondary, #606266);
  font-size: 11px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-file-preview__remove--image {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 24px;
  height: 24px;
  opacity: 0.88;
  transition: opacity 0.15s ease;
}
.selected-file-preview__image-item:hover .selected-file-preview__remove--image,
.selected-file-preview__remove--image:focus-visible { opacity: 1; }
.selected-file-preview__attachments {
  margin-top: 10px;
  overflow: hidden;
  border: 1px solid var(--dd-border-light, #e4e7ed);
  border-radius: 6px;
}
.selected-file-preview__attachment {
  display: flex;
  min-height: 42px;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-bottom: 1px solid var(--dd-border-light, #e4e7ed);
}
.selected-file-preview__attachment:last-child { border-bottom: 0; }
.selected-file-preview__meta {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}
.selected-file-preview__meta span {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.selected-file-preview__meta small {
  color: var(--dd-text-muted, #909399);
  font-size: 11px;
}
.selected-file-preview__remove { flex: 0 0 auto; }
</style>
