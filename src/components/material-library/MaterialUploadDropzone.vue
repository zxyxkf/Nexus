<template>
  <div class="material-dropzone" :class="{ hovered }" @click="inputRef?.click()" @dragenter.prevent="hovered = true" @dragover.prevent="hovered = true" @dragleave.prevent="hovered = false" @drop.prevent="onDrop">
    <input ref="inputRef" type="file" multiple accept="image/*" hidden @change="onInput" />
    <el-icon :size="30"><UploadFilled /></el-icon>
    <strong>拖拽图片到这里，或点击选择</strong>
    <span>支持多张图片上传</span>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { UploadFilled } from '@element-plus/icons-vue'
const emit = defineEmits(['files'])
const inputRef = ref(null)
const hovered = ref(false)
function emitFiles(files) { const list = Array.from(files || []).filter(file => file.type.startsWith('image/')); if (list.length) emit('files', list) }
function onInput(e) { emitFiles(e.target.files); e.target.value = '' }
function onDrop(e) { hovered.value = false; emitFiles(e.dataTransfer.files) }
</script>

<style scoped>
.material-dropzone { border: 1px dashed var(--el-border-color); border-radius: 8px; min-height: 130px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; color: var(--el-text-color-secondary); cursor: pointer; transition: .2s; }
.material-dropzone:hover, .material-dropzone.hovered { border-color: var(--el-color-primary); background: var(--el-color-primary-light-9); color: var(--el-color-primary); }
.material-dropzone span { font-size: 12px; }
</style>
