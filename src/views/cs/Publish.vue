<template>
  <div class="page-container-narrow">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">发布新任务</span>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="80px"
        style="max-width:700px;"
      >
        <el-form-item label="工作项目" prop="scoreItemId">
          <el-select v-model="form.scoreItemId" placeholder="请选择工作项目" filterable @change="onScoreItemChange" style="width:100%;">
            <el-option v-for="item in scoreItems" :key="item.id" :label="item.name" :value="item.id" />
          </el-select>
        </el-form-item>

        <el-form-item label="分值">
          <el-input :model-value="form.score" disabled placeholder="选择工作项目后自动填充" />
        </el-form-item>

        <el-form-item label="旺旺ID">
          <el-input v-model="form.wangwangId" />
        </el-form-item>

        <el-form-item label="款号">
          <el-input v-model="form.styleNumber" />
        </el-form-item>

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
            :limit="10"
            accept="image/*"
            :auto-upload="false"
            @change="onRefFileChange"
            @paste="handleRefPaste"
          >
            <el-icon :size="28"><Plus /></el-icon>
          </el-upload>
          <p class="form-hint">支持上传参考图片，单个文件最大50MB，最多10张</p>
        </el-form-item>

        <el-form-item label="指定基础美工">
          <PersonSelect
            v-model="form.designerId"
            :items="designers"
            placeholder="不选择则发布到基础任务大厅"
            clearable
            filterable
            @refresh="loadDesigners"
          />
          <p class="form-hint">选择基础美工后任务将直接分配给该人员，不经过任务大厅</p>
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
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { createTaskApi, uploadFilesApi, getScoreItemsApi, getBasicDesignerListApi } from '@/api'
import PersonSelect from '@/components/PersonSelect.vue'
import { appendClipboardImages, syncRawFiles } from '@/utils/clipboard-upload'

const formRef = ref(null)
const uploadRef = ref(null)
const publishing = ref(false)
const hasUnsavedData = ref(false)
const refImages = ref([])
const refRawFiles = ref([])

function onRefFileChange(uploadFile, uploadFiles) {
  refRawFiles.value = syncRawFiles(uploadFiles)
}

function handleRefPaste(event) {
  appendClipboardImages(event, refImages, refRawFiles, {
    prefix: 'cs-reference',
    maxCount: 10,
    maxSizeMB: 50
  })
}

// 监听表单变化
watch(() => form.scoreItemId, () => { hasUnsavedData.value = true })
watch(() => form.description, () => { hasUnsavedData.value = true })
watch(() => refImages.value, () => { hasUnsavedData.value = true }, { deep: true })

// 离开页面前提示
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
    const res = await getScoreItemsApi()
    if (res.code === 0) scoreItems.value = res.data || []
  } catch (e) {}
}

async function loadDesigners() {
  try {
    const res = await getBasicDesignerListApi()
    if (res.code === 0) {
      designers.value = res.data || []
      if (!designers.value.length) {
        console.warn('[Publish] 没有可用的基础美工账号')
      }
    } else {
      console.error('[Publish] 获取美工列表失败:', res.msg)
    }
  } catch (e) {
    console.error('[Publish] 获取美工列表异常:', e.message || e)
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

const form = reactive({
  title: '',
  description: '',
  scoreItemId: '',
  score: 0,
  wangwangId: '',
  styleNumber: '',
  designerId: null
})

const scoreItems = ref([])
const designers = ref([])

const rules = {
  scoreItemId: [
    { required: true, message: '请选择工作项目', trigger: 'change' }
  ]
}

async function handlePublish() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return

  publishing.value = true
  try {
    const res = await createTaskApi({
      title: form.title,
      description: form.description,
      score: form.score,
      scoreItemId: form.scoreItemId,
      wangwangId: form.wangwangId,
      styleNumber: form.styleNumber,
      designerId: form.designerId || undefined
    })

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
  form.wangwangId = ''
  form.styleNumber = ''
  form.designerId = null
  hasUnsavedData.value = false
  refImages.value = []
  formRef.value?.resetFields()
}
</script>

<style scoped>
.form-hint { font-size: 12px; color: var(--dd-text-muted); margin: 4px 0 0; }
</style>
