<template>
  <div class="page-container-narrow">
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

        <!-- 共享字段：款号 + 指定颜色 -->
        <el-form-item label="款号">
          <el-input v-model="form.styleNumber" placeholder="款号（可选）" />
        </el-form-item>
        <el-form-item label="指定颜色">
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

        <el-form-item label="参考图">
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Plus, Delete, Document } from '@element-plus/icons-vue'
import PersonSelect from '@/components/PersonSelect.vue'
import { createTaskApi, uploadFilesApi, getScoreItemsApi, getDesignerListApi, getBasicDesignerListApi, getOperatorAssistantListApi } from '@/api'
import { useConfig } from '@/composables/useConfig'
import { appendClipboardImages, syncRawFiles } from '@/utils/clipboard-upload'

const route = useRoute()
const taskGroup = computed(() => route.meta.taskGroup || (route.meta.role === 'cs_agent' ? 'cs' : 'design'))
const isCsAgent = computed(() => taskGroup.value === 'cs')
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
const refImages = ref([])
const refRawFiles = ref([])

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

watch(() => form.scoreItemId, () => { hasUnsavedData.value = true })
watch(() => form.description, () => { hasUnsavedData.value = true })
watch(() => form.deadline, () => { hasUnsavedData.value = true })
watch(() => refImages.value, () => { hasUnsavedData.value = true }, { deep: true })
watch(taskGroup, async () => {
  resetForm()
  scoreItems.value = []
  designers.value = []
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
})

async function loadScoreItems() {
  try {
    const params = taskGroup.value ? { taskGroup: taskGroup.value } : {}
    const res = await getScoreItemsApi(params)
    if (res.code === 0) scoreItems.value = res.data || []
  } catch (e) {
    console.error('[Publish] 加载积分项目失败:', e)
  }
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

    const res = await createTaskApi(payload)

    if (res.code === 0) {
      const taskId = res.data?.id
      if (taskId && refImages.value.length) {
        try {
          const rawFiles = refRawFiles.value.length ? refRawFiles.value : refImages.value.map(f => f.raw).filter(Boolean)
          if (rawFiles.length) {
            const uploadRes = await uploadFilesApi(taskId, rawFiles, 'reference')
            if (uploadRes.code !== 0) {
              ElMessage.error('参考图上传失败: ' + (uploadRes.msg || '未知错误'))
            }
          }
        } catch (e) {
          console.error('[Publish] 参考图上传失败:', e)
          ElMessage.error('参考图上传失败: ' + (e.response?.data?.msg || e.message || '网络异常'))
        }
      }
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
  form.title = ''
  form.description = ''
  form.deadline = null
  form.wangwangId = ''
  form.styleNumber = ''
  form.specifiedColor = ''
  form.designerId = null
  hasUnsavedData.value = false
  refImages.value = []
  formRef.value?.resetFields()
}
</script>

<style scoped>
.form-hint { font-size: 12px; color: var(--dd-text-muted); margin: 4px 0 0; }
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
</style>
