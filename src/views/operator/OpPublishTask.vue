<template>
  <div class="page-container-narrow">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">发布运营任务</span>
        </div>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" style="max-width:700px;">
        <el-form-item label="工作项目" prop="scoreItemId">
          <el-select v-model="form.scoreItemId" placeholder="请选择工作项目" filterable @change="onScoreItemChange" style="width:100%;">
            <el-option v-for="item in scoreItems" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="分值">
          <el-input :model-value="form.score" disabled placeholder="选择工作项目后自动填充" />
        </el-form-item>

        <el-form-item label="任务数量">
          <el-input-number v-model="form.quantity" :min="1" :max="9999" style="width:100%;" />
        </el-form-item>

        <el-form-item label="任务文件地址">
          <el-input
            v-model="form.taskFilePath"
            type="textarea"
            :rows="3"
            maxlength="2000"
            show-word-limit
            placeholder="任务文件路径或链接（可选）"
          />
        </el-form-item>

        <el-form-item label="任务描述" prop="description">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="6"
            maxlength="2000"
            show-word-limit
            placeholder="请详细描述任务要求"
          />
        </el-form-item>

        <el-form-item label="任务参考">
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
          <p class="form-hint">拖拽文件到框内或点击上传，最多{{ maxRefImageCount }}个</p>
        </el-form-item>

        <el-form-item label="指定运营助理">
          <PersonSelect
            v-model="form.designerId"
            :items="designers"
            placeholder="不选择则发布到运营任务大厅"
            filterable
            clearable
            @refresh="loadDesigners"
          />
          <p class="form-hint">选择运营助理后任务将直接分配给该人员</p>
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
import { ElMessage } from 'element-plus'
import { Plus, Delete, Document } from '@element-plus/icons-vue'
import PersonSelect from '@/components/PersonSelect.vue'
import { createTaskApi, uploadFilesApi, getScoreItemsApi, getOperatorAssistantListApi } from '@/api'
import { useConfig } from '@/composables/useConfig'
import { getUser } from '@/utils/auth'
import { appendClipboardImages, syncRawFiles } from '@/utils/clipboard-upload'

const { getInt } = useConfig()
const maxRefImageCount = computed(() => getInt('upload.max_file_count', 10))

const formRef = ref(null)
const publishing = ref(false)
const hasUnsavedData = ref(false)
const refImages = ref([])
const refRawFiles = ref([])

const form = reactive({
  title: '',
  description: '',
  scoreItemId: '',
  score: 0,
  quantity: 1,
  taskFilePath: '',
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
    prefix: 'operator-reference',
    maxCount: maxRefImageCount.value
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
watch(() => refImages.value, () => { hasUnsavedData.value = true }, { deep: true })

function beforeUnload(e) {
  if (hasUnsavedData.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', beforeUnload)
  window.addEventListener('paste', handleRefPaste)
  loadScoreItems()
  loadDesigners()
})
onUnmounted(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  window.removeEventListener('paste', handleRefPaste)
})

async function loadScoreItems() {
  try {
    const res = await getScoreItemsApi({ taskGroup: 'operator' })
    if (res.code === 0) scoreItems.value = res.data || []
  } catch (e) {
    console.error('[OpPublish] 加载积分项目失败:', e)
  }
}

async function loadDesigners() {
  try {
    const res = await getOperatorAssistantListApi()
    if (res.code === 0) {
      const list = res.data || []
      list.forEach(d => {
        try {
          d._activeTasks = typeof d.active_tasks === 'string' ? JSON.parse(d.active_tasks) : (d.active_tasks || [])
        } catch (_) { d._activeTasks = [] }
      })
      designers.value = list
    }
  } catch (e) {
    console.error('[OpPublish] 加载运营助理列表失败:', e)
  }
}

function onScoreItemChange(val) {
  const item = scoreItems.value.find(s => s.id === val)
  if (item) {
    form.title = item.name
    form.score = item.score
  }
}

const scoreItems = ref([])
const designers = ref([])

const rules = {
  scoreItemId: [{ required: true, message: '请选择工作项目', trigger: 'change' }]
}

async function handlePublish() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  publishing.value = true
  try {
    const payload = {
      title: form.title,
      description: form.description,
      score: form.score,
      scoreItemId: form.scoreItemId,
      shopName: getUser()?.store || '',
      quantity: form.quantity,
      taskFilePath: form.taskFilePath,
      designerId: form.designerId || undefined,
      taskGroup: 'operator'
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
  form.quantity = 1
  form.taskFilePath = ''
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
