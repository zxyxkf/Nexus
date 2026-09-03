<template>
  <el-popover
    v-model:visible="state.visible"
    placement="bottom-end"
    :width="760"
    trigger="click"
    popper-class="batch-work-submit-popper"
  >
    <template #reference>
      <el-button class="batch-submit-trigger" :icon="UploadFilled" size="small" type="primary" plain>
        批量提交
      </el-button>
    </template>

    <div class="batch-work-submit">
      <div class="batch-panel-header">
        <div>
          <h2>批量提交作品</h2>
          <span>{{ state.files.length }} 个文件，{{ state.groups.length }} 条匹配任务</span>
        </div>
        <el-button v-if="state.files.length" link type="primary" :disabled="state.submitting" @click="clearAll">清空</el-button>
      </div>

      <el-upload
        ref="uploadRef"
        class="batch-upload"
        drag
        multiple
        accept="image/*"
        :auto-upload="false"
        :show-file-list="false"
        :disabled="state.submitting"
        @change="handleFileChange"
      >
        <el-icon class="batch-upload-icon"><UploadFilled /></el-icon>
        <div class="batch-upload-title">拖入图片，或点击选择文件</div>
      </el-upload>

      <div v-if="state.resolving" class="batch-resolving">
        <el-icon class="is-loading"><Loading /></el-icon>
        正在匹配任务
      </div>

      <el-scrollbar v-else-if="state.files.length" max-height="430px" class="batch-results-scroll">
        <section v-if="state.groups.length" class="batch-section">
          <h3>已匹配</h3>
          <article v-for="group in state.groups" :key="group.taskId" class="batch-task-group">
            <div class="batch-task-head">
              <div class="batch-task-title">
                <strong>{{ group.taskNo }}</strong>
                <span>{{ group.title || group.wangwangId || '客服任务' }}</span>
              </div>
              <label class="batch-score-field">
                <span>申请分值</span>
                <el-input-number
                  :model-value="scoreFor(group.taskId)"
                  :min="0.1"
                  :max="9999"
                  :precision="1"
                  :step="0.5"
                  controls-position="right"
                  @change="value => setScore(group.taskId, value)"
                />
              </label>
            </div>
            <div class="batch-file-list">
              <div v-for="file in group.files" :key="file.clientId" class="batch-file-row">
                <div class="batch-file-main">
                  <el-icon><Picture /></el-icon>
                  <span class="batch-file-name" :title="file.name">{{ file.name }}</span>
                  <el-tag size="small" effect="plain">{{ file.matchedBy === 'task_no' ? '任务编号' : '旺旺ID' }}</el-tag>
                </div>
                <el-button :icon="Delete" link type="danger" aria-label="移除文件" :disabled="state.submitting" @click="removeFile(file.clientId)" />
              </div>
            </div>
            <p v-if="group.files.length > maxFileCount" class="batch-group-error">
              该任务共 {{ group.files.length }} 个文件，超过单任务 {{ maxFileCount }} 个的上限
            </p>
          </article>
        </section>

        <section v-if="state.unresolved.length" class="batch-section batch-unresolved">
          <h3>未匹配或冲突</h3>
          <div v-for="file in state.unresolved" :key="file.clientId" class="batch-file-row">
            <div class="batch-file-main">
              <el-icon><Warning /></el-icon>
              <span class="batch-file-name" :title="file.name">{{ file.name }}</span>
              <el-tag size="small" type="warning" effect="plain">{{ reasonLabel(file.reason) }}</el-tag>
            </div>
            <el-button :icon="Delete" link type="danger" aria-label="移除文件" :disabled="state.submitting" @click="removeFile(file.clientId)" />
          </div>
        </section>

        <section v-if="state.results.length" class="batch-section batch-submit-results">
          <h3>提交结果</h3>
          <div v-for="result in state.results" :key="result.taskId" class="batch-result-row" :class="{ failed: !result.success }">
            <el-icon><CircleCheck v-if="result.success" /><CircleClose v-else /></el-icon>
            <strong>{{ result.taskNo }}</strong>
            <span>{{ result.message }}</span>
          </div>
        </section>
      </el-scrollbar>

      <div v-else class="batch-empty">暂无待提交图片</div>

      <div class="batch-panel-footer">
        <span>{{ submittableGroups.length }} 条任务可提交</span>
        <el-button
          type="primary"
          :loading="state.submitting"
          :disabled="state.resolving || submittableGroups.length === 0"
          @click="submitAll"
        >确认提交</el-button>
      </div>
    </div>
  </el-popover>
</template>

<script setup>
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CircleCheck, CircleClose, Delete, Loading, Picture, UploadFilled, Warning } from '@element-plus/icons-vue'
import { resolveBatchSubmitApi, uploadFilesApi } from '@/api'
import { useConfig } from '@/composables/useConfig'

const emit = defineEmits(['submitted'])
const { ensureLoaded, getInt } = useConfig()
const uploadRef = ref(null)
const fileByClientId = new Map()
const scoreByTaskId = new Map()
let resolveTimer = null
let resolveVersion = 0

const state = reactive({
  visible: false,
  files: [],
  groups: [],
  unresolved: [],
  results: [],
  resolving: false,
  submitting: false
})

const maxFileCount = computed(() => getInt('upload.max_file_count', 10))
const maxFileSizeMB = computed(() => getInt('upload.max_file_size_mb', 50))
const submittableGroups = computed(() => state.groups.filter(group =>
  group.files.length > 0 && group.files.length <= maxFileCount.value
))

function descriptorFor(rawFile, clientId) {
  return {
    clientId,
    name: rawFile.name,
    size: rawFile.size,
    type: rawFile.type
  }
}

async function handleFileChange(uploadFile) {
  const rawFile = uploadFile?.raw
  if (!rawFile) return
  await ensureLoaded()
  if (!rawFile.type?.startsWith('image/')) {
    ElMessage.warning(`“${rawFile.name}”不是图片文件`)
    return
  }
  if (rawFile.size > maxFileSizeMB.value * 1024 * 1024) {
    ElMessage.warning(`“${rawFile.name}”超过${maxFileSizeMB.value}MB限制`)
    return
  }
  if (state.files.length >= 500) {
    ElMessage.warning('单次最多匹配500个文件')
    return
  }

  const clientId = String(uploadFile.uid || `${Date.now()}-${Math.random()}`)
  if (fileByClientId.has(clientId)) return
  fileByClientId.set(clientId, rawFile)
  state.files.push(descriptorFor(rawFile, clientId))
  scheduleResolve()
}

function scheduleResolve() {
  clearTimeout(resolveTimer)
  resolveTimer = setTimeout(resolveFiles, 100)
}

async function resolveFiles() {
  clearTimeout(resolveTimer)
  const version = ++resolveVersion
  if (!state.files.length) {
    state.groups = []
    state.unresolved = []
    state.resolving = false
    return
  }

  state.resolving = true
  try {
    const response = await resolveBatchSubmitApi(state.files)
    if (version !== resolveVersion) return
    if (response.code !== 0) {
      ElMessage.error(response.msg || '文件匹配失败')
      return
    }
    const groups = response.data?.groups || []
    groups.forEach(group => {
      if (!scoreByTaskId.has(Number(group.taskId))) scoreByTaskId.set(Number(group.taskId), 1)
    })
    state.groups = groups
    state.unresolved = response.data?.unresolved || []
  } catch (error) {
    if (version === resolveVersion) ElMessage.error(error.message || '文件匹配失败')
  } finally {
    if (version === resolveVersion) state.resolving = false
  }
}

function scoreFor(taskId) {
  return scoreByTaskId.get(Number(taskId)) ?? 1
}

function setScore(taskId, value) {
  const score = Number(value)
  scoreByTaskId.set(Number(taskId), Number.isFinite(score) && score > 0 ? score : 1)
}

function removeFile(clientId) {
  fileByClientId.delete(String(clientId))
  state.files = state.files.filter(file => String(file.clientId) !== String(clientId))
  scheduleResolve()
}

function clearAll() {
  clearTimeout(resolveTimer)
  resolveVersion += 1
  fileByClientId.clear()
  scoreByTaskId.clear()
  uploadRef.value?.clearFiles()
  state.files = []
  state.groups = []
  state.unresolved = []
  state.results = []
  state.resolving = false
}

function reasonLabel(reason) {
  return ({
    multiple_task_numbers: '包含多个任务编号',
    duplicate_wangwang: '旺旺ID对应多条任务',
    not_found: '未找到可提交任务',
    invalid_type: '不是图片',
    invalid_descriptor: '文件信息无效'
  })[reason] || '无法匹配'
}

async function submitGroup(group) {
  const rawFiles = group.files.map(file => fileByClientId.get(String(file.clientId))).filter(Boolean)
  if (rawFiles.length !== group.files.length) throw new Error('部分本地文件已失效，请重新选择')
  const response = await uploadFilesApi(group.taskId, rawFiles, 'work', {
    appliedScore: scoreFor(group.taskId)
  })
  if (response.code !== 0) throw new Error(response.msg || '提交失败')
  return response.msg || '提交成功'
}

async function runWithConcurrency(items, limit, worker) {
  let nextIndex = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex]
      nextIndex += 1
      await worker(item)
    }
  })
  await Promise.all(runners)
}

async function submitAll() {
  const groups = [...submittableGroups.value]
  if (!groups.length || state.submitting) return
  state.submitting = true
  state.results = state.results.filter(result => !groups.some(group => Number(group.taskId) === Number(result.taskId)))
  const succeededFileIds = new Set()

  await runWithConcurrency(groups, 2, async group => {
    try {
      const message = await submitGroup(group)
      group.files.forEach(file => succeededFileIds.add(String(file.clientId)))
      state.results.push({ taskId: group.taskId, taskNo: group.taskNo, success: true, message })
    } catch (error) {
      state.results.push({ taskId: group.taskId, taskNo: group.taskNo, success: false, message: error.message || '提交失败' })
    }
  })

  if (succeededFileIds.size) {
    succeededFileIds.forEach(clientId => fileByClientId.delete(clientId))
    state.files = state.files.filter(file => !succeededFileIds.has(String(file.clientId)))
    uploadRef.value?.clearFiles()
    emit('submitted')
  }
  state.submitting = false
  await resolveFiles()
}

onBeforeUnmount(() => {
  clearTimeout(resolveTimer)
  resolveVersion += 1
  fileByClientId.clear()
})
</script>

<style scoped>
.batch-submit-trigger { flex: 0 0 auto; }
.batch-work-submit { color: var(--el-text-color-primary); }
.batch-panel-header,
.batch-panel-footer,
.batch-task-head,
.batch-file-row,
.batch-result-row {
  display: flex;
  align-items: center;
}
.batch-panel-header { justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.batch-panel-header h2 { margin: 0 0 4px; font-size: 16px; letter-spacing: 0; }
.batch-panel-header span,
.batch-panel-footer > span { color: var(--el-text-color-secondary); font-size: 12px; }
.batch-upload :deep(.el-upload),
.batch-upload :deep(.el-upload-dragger) { width: 100%; }
.batch-upload :deep(.el-upload-dragger) { padding: 18px; border-radius: 6px; }
.batch-upload-icon { font-size: 28px; color: var(--el-color-primary); }
.batch-upload-title { margin-top: 4px; color: var(--el-text-color-regular); font-size: 13px; }
.batch-resolving,
.batch-empty { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 96px; color: var(--el-text-color-secondary); font-size: 13px; }
.batch-results-scroll { margin-top: 12px; padding-right: 4px; }
.batch-section { margin-bottom: 16px; }
.batch-section h3 { margin: 0 0 8px; font-size: 13px; letter-spacing: 0; }
.batch-task-group { margin-bottom: 10px; padding: 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 6px; background: var(--el-fill-color-blank); }
.batch-task-head { justify-content: space-between; gap: 16px; margin-bottom: 8px; }
.batch-task-title { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.batch-task-title strong { font-size: 13px; }
.batch-task-title span { overflow: hidden; color: var(--el-text-color-secondary); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.batch-score-field { display: flex; align-items: center; gap: 8px; flex: 0 0 auto; color: var(--el-text-color-regular); font-size: 12px; }
.batch-score-field :deep(.el-input-number) { width: 120px; }
.batch-file-list { border-top: 1px solid var(--el-border-color-extra-light); }
.batch-file-row { justify-content: space-between; gap: 8px; min-height: 36px; border-bottom: 1px solid var(--el-border-color-extra-light); }
.batch-file-main { display: flex; align-items: center; gap: 7px; min-width: 0; flex: 1; }
.batch-file-name { min-width: 0; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.batch-group-error { margin: 8px 0 0; color: var(--el-color-danger); font-size: 12px; }
.batch-unresolved .batch-file-row { padding: 0 10px; background: var(--el-color-warning-light-9); }
.batch-submit-results { padding-top: 4px; border-top: 1px solid var(--el-border-color-lighter); }
.batch-result-row { gap: 7px; min-height: 30px; color: var(--el-color-success); font-size: 12px; }
.batch-result-row.failed { color: var(--el-color-danger); }
.batch-result-row span { color: var(--el-text-color-secondary); }
.batch-panel-footer { justify-content: space-between; gap: 16px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--el-border-color-lighter); }

@media (max-width: 900px) {
  .batch-submit-trigger { padding-inline: 8px; }
}
</style>

<style>
.batch-work-submit-popper { max-width: calc(100vw - 24px); }
</style>
