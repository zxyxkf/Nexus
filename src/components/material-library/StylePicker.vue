<template>
  <div class="style-picker">
    <el-select v-model="selectedId" filterable clearable remote reserve-keyword :remote-method="search" :loading="loading" placeholder="搜索并选择款式（可选）" style="width:100%" @change="selectStyle">
      <el-option v-for="item in options" :key="item.id" :label="item.product_name ? `${item.product_name} / ${item.name}` : item.name" :value="item.id" />
      <el-option v-if="hasMore" disabled label="结果较多，请继续输入缩小范围" value="__more_styles__" />
    </el-select>
    <div v-if="selectedId && showImages" class="style-images-panel">
      <div class="style-images-toolbar"><span>款式素材（已选 {{ selectedIds.length }} 张）</span><el-select v-if="colors.length" v-model="color" clearable placeholder="指定颜色" size="small" style="width:120px"><el-option v-for="item in colors" :key="item" :label="item" :value="item" /></el-select></div>
      <div class="style-image-grid"><button v-for="image in visibleImages" :key="image.id" type="button" class="style-image" :class="{ selected: selectedIds.includes(image.id) }" @click="toggle(image)"><img :src="imageUrl(image)" :alt="image.display_name" loading="lazy" /><span class="checkmark" v-if="selectedIds.includes(image.id)">✓</span></button></div>
      <span v-if="!visibleImages.length" class="empty-hint">该款式暂无图片</span>
    </div>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { getMaterialImagesApi, searchMaterialLibraryApi } from '@/api'
import { getFileUrl } from '@/api/upload'
const props = defineProps({ modelValue: { type: [String, Number], default: '' }, selectedImageIds: { type: Array, default: () => [] }, color: { type: String, default: '' }, showImages: { type: Boolean, default: true } })
const showImages = computed(() => props.showImages)
const emit = defineEmits(['update:modelValue', 'update:selectedImageIds', 'update:color', 'change'])
const selectedId = ref(props.modelValue || ''); const selectedIds = ref([...(props.selectedImageIds || [])]); const options = ref([]); const images = ref([]); const colors = ref([]); const color = ref(props.color || ''); const loading = ref(false); const hasMore = ref(false)
let searchTimer = null
let searchSequence = 0
let searchController = null
const visibleImages = computed(() => color.value ? images.value.filter(item => item.color === color.value) : images.value)
function imageUrl(image) { return getFileUrl(image.previewUrl) }
watch(() => props.modelValue, value => { selectedId.value = value || '' }); watch(() => props.selectedImageIds, value => { selectedIds.value = [...(value || [])] }, { deep: true }); watch(color, value => emit('update:color', value || ''))
function search(query) {
  const keyword = query?.trim() || ''
  const sequence = ++searchSequence
  clearTimeout(searchTimer)
  searchTimer = null
  searchController?.abort()
  searchController = null

  if (!keyword) {
    options.value = []
    hasMore.value = false
    loading.value = false
    return
  }

  loading.value = true
  searchTimer = setTimeout(() => runSearch(keyword, sequence), 250)
}

async function runSearch(keyword, sequence) {
  const controller = new AbortController()
  searchController = controller
  try {
    const res = await searchMaterialLibraryApi(keyword, {
      scope: 'styles',
      limit: 50,
      signal: controller.signal
    })
    if (sequence !== searchSequence) return
    if (res.code === 0) {
      options.value = res.data?.styles || []
      hasMore.value = Boolean(res.data?.hasMore)
    }
  } catch (error) {
    if (error?.code !== 'ERR_CANCELED' && sequence === searchSequence) {
      options.value = []
      hasMore.value = false
    }
  } finally {
    if (sequence === searchSequence) loading.value = false
    if (searchController === controller) searchController = null
  }
}

onBeforeUnmount(() => {
  searchSequence += 1
  clearTimeout(searchTimer)
  searchController?.abort()
})
async function selectStyle(id) { selectedIds.value = []; images.value = []; colors.value = []; color.value = ''; emit('update:modelValue', id || ''); emit('update:selectedImageIds', []); emit('change', null); if (!id) return; const res = await getMaterialImagesApi(id); if (res.code === 0) { images.value = res.data.images || []; colors.value = res.data.colors || []; emit('change', res.data.style, images.value, colors.value) } }
function toggle(image) { if (selectedIds.value.includes(image.id)) selectedIds.value = selectedIds.value.filter(id => id !== image.id); else selectedIds.value = [...selectedIds.value, image.id]; emit('update:selectedImageIds', selectedIds.value) }
</script>
<style scoped>.style-picker { width:100%; }.style-images-panel { margin-top:10px; padding:10px; border:1px solid var(--el-border-color-lighter); border-radius:6px; }.style-images-toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; color:var(--el-text-color-secondary); font-size:12px; }.style-image-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:8px; max-height:270px; overflow:auto; }.style-image { position:relative; border:2px solid transparent; padding:0; aspect-ratio:1; overflow:hidden; border-radius:4px; cursor:pointer; background:var(--el-fill-color-light); }.style-image.selected { border-color:var(--el-color-primary); }.style-image img { width:100%; height:100%; object-fit:contain; }.checkmark { position:absolute; right:4px; top:4px; width:18px; height:18px; border-radius:50%; background:var(--el-color-primary); color:#fff; font-size:12px; line-height:18px; }.empty-hint { display:block; padding:14px; text-align:center; color:var(--el-text-color-placeholder); }</style>
