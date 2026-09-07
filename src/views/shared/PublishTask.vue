<template>
  <div :class="isCsAgent ? 'page-container cs-publish-page' : 'page-container-narrow'">
    <div :class="isCsAgent ? 'cs-publish-grid' : ''">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">发布新任务</span>
        </div>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" style="max-width:700px;">
        <el-form-item label="工作项目" prop="scoreItemId">
          <el-select v-model="form.scoreItemId" placeholder="请选择工作项目" filterable @change="onScoreItemChange" style="width:100%;">
            <el-option v-for="item in scoreItems" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="分值">
          <el-input :model-value="form.score" disabled placeholder="选择工作项目后自动填充" />
        </el-form-item>

        <!-- 共享字段：款号 + 指定颜色；客服任务使用素材库款式选择器 -->
        <el-form-item label="款号">
          <StylePicker v-if="isCsAgent" v-model="materialStyleId" v-model:color="form.specifiedColor" v-model:selected-image-ids="selectedMaterialImageIds" :show-images="false" @change="onMaterialStyleChange" />
          <el-input v-else v-model="form.styleNumber" placeholder="款号（可选）" />
        </el-form-item>
        <el-form-item v-if="!isCsAgent" label="指定颜色">
          <el-input v-model="form.specifiedColor" placeholder="指定颜色（可选）" />
        </el-form-item>

        <!-- cs_agent 独有字段 -->
        <template v-if="isCsAgent">
          <el-form-item label="旺旺ID">
            <el-input v-model="form.wangwangId" />
          </el-form-item>
        </template>

        <!-- operator 独有字段 -->
        <template v-else>
          <el-form-item label="参考路径">
            <el-input v-model="form.refPath" type="textarea" :rows="3" placeholder="参考文件路径或链接（可选）" />
          </el-form-item>
        </template>

        <el-form-item label="任务描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="6"
            maxlength="2000"
            show-word-limit
            placeholder="请详细描述作图需求，包括风格、尺寸、元素要求等"
          />
          <p class="form-hint">详细的需求描述有助于美工更准确地完成任务</p>
        </el-form-item>

        <el-form-item v-if="!isCsAgent" label="参考图">
          <el-upload
            ref="uploadRef"
            v-model:file-list="refImages"
            list-type="picture-card"
            multiple
            drag
            :limit="maxRefImageCount"
            :auto-upload="false"
            @change="onRefFileChange"
            @paste="handleRefPaste"
          >
            <template #default>
              <el-icon :size="28"><Plus /></el-icon>
            </template>
            <template #file="{ file }">
              <img v-if="isPreviewImage(file)" class="el-upload-list__item-thumbnail" :src="file.url" />
              <div v-else class="el-upload-list__item-thumbnail upload-non-image">
                <el-icon :size="28"><Document /></el-icon>
                <span class="upload-non-image-name">{{ file.name }}</span>
              </div>
              <span class="el-upload-list__item-actions">
                <span class="el-upload-list__item-delete" @click.stop="handleRemoveFile(file)">
                  <el-icon><Delete /></el-icon>
                </span>
              </span>
            </template>
          </el-upload>
          <p class="form-hint">拖拽文件到框内或点击上传，支持所有文件格式，单个最大{{ maxFileSizeMB }}MB，最多{{ maxRefImageCount }}个</p>
        </el-form-item>

        <el-form-item v-if="isCsAgent" label="图片">
          <div class="cs-image-fields">
            <div class="cs-reference-field">
              <div class="cs-sub-label">参考图</div>
              <el-upload
                ref="uploadRef"
                v-model:file-list="refImages"
                list-type="picture-card"
                multiple
                drag
                :limit="maxRefImageCount"
                :auto-upload="false"
                @change="onRefFileChange"
                @paste="handleRefPaste"
              >
                <template #default><el-icon :size="28"><Plus /></el-icon></template>
                <template #file="{ file }">
                  <img v-if="isPreviewImage(file)" class="el-upload-list__item-thumbnail" :src="file.url" />
                  <div v-else class="el-upload-list__item-thumbnail upload-non-image"><el-icon :size="28"><Document /></el-icon><span class="upload-non-image-name">{{ file.name }}</span></div>
                  <span class="el-upload-list__item-actions"><span class="el-upload-list__item-delete" @click.stop="handleRemoveFile(file)"><el-icon><Delete /></el-icon></span></span>
                </template>
              </el-upload>
              <p class="form-hint">拖拽文件到框内或点击上传，最多{{ maxRefImageCount }}个</p>
            </div>
            <div class="cs-style-field">
              <div class="cs-sub-label">款式图<span v-if="selectedMaterialImages.length" class="cs-image-count">{{ selectedMaterialImages.length }}张</span></div>
              <div v-if="selectedMaterialImages.length" class="cs-selected-image-grid">
                <div
                  v-for="image in selectedMaterialImages"
                  :key="image.id"
                  class="cs-selected-image"
                  draggable="true"
                  @dblclick.stop="openMaterialPreview(image)"
                  @mousedown.left="preloadMaterialImage(image)"
                  @mouseenter="preloadMaterialImage(image)"
                  @dragstart="dragMaterialImage($event, image)"
                >
                  <img :src="displayMaterialImageUrl(image)" :alt="image.display_name || image.original_name" loading="lazy" />
                  <span v-if="editedMaterialImages.has(image.id)" class="cs-edited-badge">已编辑</span>
                </div>
              </div>
              <div v-else class="cs-empty-image">请在右侧款式素材预览中选择图片</div>
            </div>
          </div>
        </el-form-item>

        <!-- operator 独有字段 -->
        <template v-if="!isCsAgent">
          <el-form-item label="截止时间">
            <el-date-picker
              v-model="form.deadline"
              type="datetime"
              placeholder="选择截止时间（可选）"
              :disabled-date="disabledDate"
              value-format="YYYY-MM-DD HH:mm:ss"
              :shortcuts="deadlineShortcuts"
            />
          </el-form-item>
        </template>

        <el-form-item :label="designerLabel">
          <PersonSelect
            v-model="form.designerId"
            :items="designers"
            :placeholder="designerPlaceholder"
            filterable
            clearable
            @refresh="loadDesigners"
          />
          <p class="form-hint">{{ designerHint }}</p>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" size="large" @click="handlePublish" :loading="publishing">
            发布任务
          </el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    <el-card v-if="isCsAgent" shadow="never" class="page-card cs-style-preview-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">款式素材预览</span>
          <span v-if="materialImages.length" class="cs-image-count">{{ selectedMaterialImageIds.length }}/{{ filteredMaterialImages.length }} 已选择</span>
        </div>
      </template>
      <div v-if="materialStyleId" class="cs-style-preview-body">
        <div class="cs-style-preview-toolbar">
          <span>{{ selectedMaterialStyleName || form.styleNumber }}</span>
          <el-select v-if="materialColors.length" v-model="form.specifiedColor" clearable placeholder="指定颜色" size="small" style="width:130px">
            <el-option v-for="item in materialColors" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div v-if="filteredMaterialImages.length" class="cs-material-grid">
          <button v-for="image in filteredMaterialImages" :key="image.id" type="button" class="cs-material-image" :class="{ selected: selectedMaterialImageIds.includes(image.id) }" @click="toggleMaterialImage(image)">
            <img :src="displayMaterialImageUrl(image)" :alt="image.display_name || image.original_name" loading="lazy" />
            <span v-if="selectedMaterialImageIds.includes(image.id)" class="cs-material-check">✓</span>
            <span v-if="editedMaterialImages.has(image.id)" class="cs-edited-badge">已编辑</span>
          </button>
        </div>
        <div v-else class="cs-empty-image">当前款式暂无素材图片</div>
      </div>
      <div v-else class="cs-empty-image cs-style-preview-empty">先在左侧选择款式，右侧会显示该款式的素材图片</div>
    </el-card>
    </div>
  </div>
  <StyleImageEditor
    v-model="materialViewerVisible"
    :image="editorImage"
    :saved-scene="currentEditedMaterialImage?.scene"
    @save="onEditorSave"
  />
</template>

<script setup>
import { ref, reactive, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Delete, Document } from '@element-plus/icons-vue'
import PersonSelect from '@/components/PersonSelect.vue'
import { publishTaskApi, getScoreItemsApi, getDesignerListApi, getBasicDesignerListApi, getOperatorAssistantListApi } from '@/api'
import { useConfig } from '@/composables/useConfig'
import { appendClipboardImages, syncRawFiles } from '@/utils/clipboard-upload'
import StylePicker from '@/components/material-library/StylePicker.vue'
import StyleImageEditor from '@/components/task/StyleImageEditor.vue'
import { getFileUrl, preloadFilesForDrag, setupFileDrag } from '@/api/upload'

const route = useRoute()
const taskGroup = computed(() => route.meta.taskGroup || (route.meta.role === 'cs_agent' || route.path.startsWith('/cs/') ? 'cs' : 'design'))
const isCsAgent = computed(() => taskGroup.value === 'cs' || route.path.startsWith('/cs/'))
const isOperatorTask = computed(() => taskGroup.value === 'operator')
const designerLabel = computed(() => isCsAgent.value ? '指定基础美工' : isOperatorTask.value ? '指定运营助理' : '指定美工')
const designerPlaceholder = computed(() => isCsAgent.value ? '不选择则发布到基础任务大厅' : isOperatorTask.value ? '不选择则发布到运营任务大厅' : '不选择则发布到任务大厅')
const designerHint = computed(() => isCsAgent.value ? '选择基础美工后任务将直接分配给该人员' : isOperatorTask.value ? '选择运营助理后任务将直接分配给该人员' : '选择美工后任务将直接分配给该人员')

const { getInt } = useConfig()
const maxRefImageCount = computed(() => getInt('upload.max_file_count', 10))
const maxFileSizeMB = computed(() => getInt('upload.max_file_size_mb', 50))

const formRef = ref(null)
const uploadRef = ref(null)
const publishing = ref(false)
const hasUnsavedData = ref(false)
const suppressDirty = ref(false)
const refImages = ref([])
const refRawFiles = ref([])
const materialStyleId = ref('')
const selectedMaterialImageIds = ref([])
const materialImages = ref([])
const materialColors = ref([])
const selectedMaterialStyleName = ref('')
const materialViewerVisible = ref(false)
const materialViewerImage = ref(null)
const editedMaterialImages = reactive(new Map())
const filteredMaterialImages = computed(() => form.specifiedColor ? materialImages.value.filter(image => image.color === form.specifiedColor) : materialImages.value)
const selectedMaterialImages = computed(() => materialImages.value.filter(image => selectedMaterialImageIds.value.includes(image.id)))
const currentEditedMaterialImage = computed(() => editedMaterialImages.get(materialViewerImage.value?.id))
const editorImage = computed(() => materialViewerImage.value
  ? { ...materialViewerImage.value, editorUrl: materialImageUrl(materialViewerImage.value) }
  : null)

const form = reactive({
  title: '',
  description: '',
  scoreItemId: '',
  score: 0,
  refPath: '',
  deadline: null,
  wangwangId: '',
  styleNumber: '',
  specifiedColor: '',
  designerId: null
})

function materialImageUrl(image) { return getFileUrl(image.previewUrl) }
function displayMaterialImageUrl(image) { return editedMaterialImages.get(image.id)?.previewUrl || materialImageUrl(image) }

function clearEditedMaterialImages() {
  editedMaterialImages.forEach(result => {
    if (result?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(result.previewUrl)
  })
  editedMaterialImages.clear()
}

function onEditorSave(result) {
  const previous = editedMaterialImages.get(result.materialImageId)
  if (previous?.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previous.previewUrl)
  editedMaterialImages.set(result.materialImageId, result)
  markUnsaved()
}

function openMaterialPreview(image) {
  materialViewerImage.value = image
  materialViewerVisible.value = true
}

function materialDragFile(image) {
  if (!image?.id) return null
  const fallback = `material-${image.id}`
  const rawName = String(image.display_name || image.original_name || fallback)
  const fileName = rawName
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/[. ]+$/g, '') || fallback
  return {
    id: `material:${image.id}`,
    file_name: fileName,
    mime_type: image.mime_type || 'application/octet-stream',
    downloadUrl: image.downloadUrl || `/api/material-library/images/${image.id}/download`
  }
}

function preloadMaterialImage(image) {
  const file = materialDragFile(image)
  if (file) preloadFilesForDrag([file])
}

function dragMaterialImage(event, image) {
  const file = materialDragFile(image)
  if (file) setupFileDrag(event, file)
}

function toggleMaterialImage(image) {
  selectedMaterialImageIds.value = selectedMaterialImageIds.value.includes(image.id)
    ? selectedMaterialImageIds.value.filter(id => id !== image.id)
    : [...selectedMaterialImageIds.value, image.id]
}

function onMaterialStyleChange(style, images = [], colors = []) {
  clearEditedMaterialImages()
  materialStyleId.value = style?.id || ''
  form.styleNumber = style?.name || ''
  selectedMaterialStyleName.value = style?.name || ''
  materialImages.value = images
  materialColors.value = colors
}

const IMG_EXTS = ['.jpg','.jpeg','.png','.gif','.webp','.bmp','.svg','.tiff','.tif','.ico','.avif','.heic']

function isPreviewImage(file) {
  if (!file || !file.name) return false
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase()
  return IMG_EXTS.includes(ext)
}

function onRefFileChange(uploadFile, uploadFiles) {
  refRawFiles.value = syncRawFiles(uploadFiles)
}

function handleRefPaste(event) {
  appendClipboardImages(event, refImages, refRawFiles, {
    prefix: 'reference',
    maxCount: maxRefImageCount.value,
    maxSizeMB: maxFileSizeMB.value
  })
}

function handleRemoveFile(file) {
  const idx = refImages.value.findIndex(f => f.uid === file.uid)
  if (idx > -1) {
    refImages.value.splice(idx, 1)
    refRawFiles.value = refImages.value.map(f => f.raw).filter(Boolean)
  }
}

function markUnsaved() {
  if (!suppressDirty.value) hasUnsavedData.value = true
}

watch(() => form.scoreItemId, markUnsaved)
watch(() => form.description, markUnsaved)
watch(() => form.deadline, markUnsaved)
watch(() => refImages.value, markUnsaved, { deep: true })
watch(taskGroup, async () => {
  scoreItems.value = []
  designers.value = []
  resetForm()
  await Promise.all([loadScoreItems(), loadDesigners()])
})

function beforeUnload(e) {
  if (hasUnsavedData.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  window.addEventListener('paste', handleRefPaste)
  window.addEventListener('keydown', handleKeydown)
  loadScoreItems()
  loadDesigners()
})
onUnmounted(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  window.removeEventListener('paste', handleRefPaste)
  window.removeEventListener('keydown', handleKeydown)
  clearEditedMaterialImages()
})

async function loadScoreItems() {
  try {
    const params = taskGroup.value ? { taskGroup: taskGroup.value } : {}
    const res = await getScoreItemsApi(params)
    if (res.code === 0) {
      scoreItems.value = res.data || []
      applyDefaultCsScoreItem()
    }
  } catch (e) {
    console.error('[Publish] 加载积分项目失败:', e)
  }
}

function applyDefaultCsScoreItem() {
  if (!isCsAgent.value || form.scoreItemId || !scoreItems.value.length) return
  const defaultItem = scoreItems.value.find(item => item.name === '默认1分') || scoreItems.value.find(item => Number(item.score) === 1) || scoreItems.value[0]
  if (!defaultItem) return
  const wasDirty = hasUnsavedData.value
  suppressDirty.value = true
  form.scoreItemId = defaultItem.id
  onScoreItemChange(defaultItem.id)
  nextTick(() => {
    suppressDirty.value = false
    hasUnsavedData.value = wasDirty
  })
}

async function loadDesigners() {
  try {
    let api, label
    if (isCsAgent.value) {
      api = getBasicDesignerListApi
      label = '基础美工'
    } else if (isOperatorTask.value) {
      api = getOperatorAssistantListApi
      label = '运营助理'
    } else {
      api = getDesignerListApi
      label = '美工'
    }
    const res = await api()
    if (res.code === 0) {
      const list = res.data || []
      list.forEach(d => {
        try {
          d._activeTasks = typeof d.active_tasks === 'string' ? JSON.parse(d.active_tasks) : (d.active_tasks || [])
        } catch (_) { d._activeTasks = [] }
      })
      designers.value = list
      console.log('[Publish] 人员列表:', list.map(d => ({ name: d.real_name || d.username, tasks: d._activeTasks })))
      if (!designers.value.length) {
        console.warn(`[Publish] 没有可用的${label}账号`)
      }
    } else {
      console.error(`[Publish] 获取${label}列表失败:`, res.msg)
    }
  } catch (e) {
    console.error(`[Publish] 获取列表异常:`, e.message || e)
  }
}

function onScoreItemChange(val) {
  const item = scoreItems.value.find(s => s.id === val)
  if (item) {
    form.title = item.name
    form.score = item.score
  }
}

function handleKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    handlePublish()
  }
}

const deadlineShortcuts = [
  { text: '明天', value: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return d } },
  { text: '3天后', value: () => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(18, 0, 0, 0); return d } },
  { text: '1周后', value: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(18, 0, 0, 0); return d } }
]

const scoreItems = ref([])
const designers = ref([])

const rules = {
  scoreItemId: [
    { required: true, message: '请选择工作项目', trigger: 'change' }
  ]
}

function disabledDate(time) {
  return time.getTime() < Date.now() - 86400000
}

async function handlePublish() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  publishing.value = true
  try {
    const payload = isCsAgent.value
      ? {
          title: form.title,
          description: form.description,
          score: form.score,
          scoreItemId: form.scoreItemId,
          wangwangId: form.wangwangId,
          styleNumber: form.styleNumber,
          specifiedColor: form.specifiedColor,
          designerId: form.designerId || undefined,
          taskGroup: taskGroup.value
        }
      : {
          title: form.title,
          description: form.description,
          deadline: form.deadline,
          score: form.score,
          scoreItemId: form.scoreItemId,
          refPath: form.refPath,
          styleNumber: form.styleNumber,
          specifiedColor: form.specifiedColor,
          designerId: form.designerId || undefined,
          taskGroup: taskGroup.value
        }

    const rawFiles = refRawFiles.value.length
      ? refRawFiles.value
      : refImages.value.map(file => file.raw).filter(Boolean)
    const styleImages = isCsAgent.value && materialStyleId.value
      ? selectedMaterialImages.value.map((image, position) => ({
          image,
          position,
          edited: editedMaterialImages.get(image.id)
        }))
      : []
    const res = await publishTaskApi({
      task: payload,
      referenceFiles: rawFiles,
      materialStyleId: materialStyleId.value,
      images: styleImages
    })

    if (res.code === 0) {
      ElMessage.success(res.msg || '任务发布成功')
      hasUnsavedData.value = false
      resetForm()
    } else {
      ElMessage.error(res.msg)
    }
  } finally {
    publishing.value = false
  }
}

function resetForm() {
  suppressDirty.value = true
  form.title = ''
  form.description = ''
  form.deadline = null
  form.wangwangId = ''
  form.styleNumber = ''
  form.specifiedColor = ''
  materialStyleId.value = ''
  selectedMaterialImageIds.value = []
  materialImages.value = []
  materialColors.value = []
  selectedMaterialStyleName.value = ''
  materialViewerVisible.value = false
  materialViewerImage.value = null
  clearEditedMaterialImages()
  form.designerId = null
  hasUnsavedData.value = false
  refImages.value = []
  formRef.value?.resetFields()
  applyDefaultCsScoreItem()
  nextTick(() => {
    suppressDirty.value = false
    hasUnsavedData.value = false
  })
}
</script>

<style scoped>
.form-hint { font-size: 12px; color: var(--dd-text-muted); margin: 4px 0 0; }
.cs-publish-page { max-width: 1500px; margin: 0 auto; }
.cs-publish-grid { display: grid; grid-template-columns: minmax(520px, 0.95fr) minmax(420px, 1.05fr); gap: 16px; align-items: start; }
.cs-publish-form-card :deep(.el-form) { max-width: none !important; }
.cs-style-preview-card { min-height: 420px; position: sticky; top: 16px; }
.cs-style-preview-card :deep(.el-card__body) { padding: 16px; }
.cs-style-preview-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; font-weight: 600; color: var(--dd-text-primary); }
.cs-material-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; max-height: calc(100vh - 210px); overflow-y: auto; padding-right: 3px; }
.cs-material-image { position: relative; aspect-ratio: 1; padding: 0; overflow: hidden; border: 2px solid transparent; border-radius: 6px; cursor: pointer; background: var(--el-fill-color-light); }
.cs-material-image.selected { border-color: var(--el-color-primary); }
.cs-material-image img { width: 100%; height: 100%; object-fit: contain; display: block; }
.cs-material-check { position: absolute; right: 4px; top: 4px; width: 20px; height: 20px; border-radius: 50%; background: var(--el-color-primary); color: #fff; text-align: center; line-height: 20px; font-size: 12px; }
.cs-image-fields { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 14px; width: 100%; }
.cs-sub-label { margin-bottom: 8px; font-size: 13px; color: var(--dd-text-secondary); font-weight: 600; }
.cs-reference-field :deep(.el-upload), .cs-reference-field :deep(.el-upload-list) { max-width: 100%; }
.cs-style-field { min-width: 0; }
.cs-selected-image-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; max-height: 180px; overflow-y: auto; }
.cs-selected-image { min-width: 0; aspect-ratio: 1; overflow: hidden; border: 1px solid var(--el-border-color-lighter); border-radius: 4px; cursor: zoom-in; }
.cs-selected-image img { display: block; width: 100%; height: 100%; object-fit: contain; }
.cs-selected-image { position: relative; }
.cs-edited-badge { position: absolute; left: 4px; bottom: 4px; padding: 2px 5px; border-radius: 3px; background: rgba(48, 49, 51, 0.82); color: #fff; font-size: 10px; line-height: 1.3; }
.cs-image-count { color: var(--el-color-primary); font-size: 12px; font-weight: 500; }
.cs-empty-image { min-height: 92px; display: flex; align-items: center; justify-content: center; padding: 14px; border: 1px dashed var(--el-border-color); border-radius: 6px; color: var(--dd-text-muted); font-size: 12px; text-align: center; }
.cs-style-preview-empty { min-height: 320px; }
.upload-non-image {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; background: #f5f7fa; color: #909399; padding: 8px;
}
.upload-non-image-name {
  font-size: 10px; text-align: center; word-break: break-all;
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box;
  -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.2;
  max-width: 100%;
}
@media (max-width: 1050px) {
  .cs-publish-grid { grid-template-columns: 1fr; }
  .cs-style-preview-card { position: static; }
  .cs-material-grid { max-height: 520px; }
}
@media (max-width: 640px) {
  .cs-image-fields { grid-template-columns: 1fr; }
  .cs-material-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>
