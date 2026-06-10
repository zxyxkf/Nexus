<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ pageTitle }}</span>
          <div class="header-right">
            <el-select v-if="!fixedStatus" v-model="statusFilter" placeholder="状态筛选" clearable style="width:130px;" @change="loadData">
              <el-option label="全部" value="" />
              <el-option label="已接单" value="accepted" />
              <el-option label="进行中" value="doing" />
              <el-option label="已完成" value="finished" />
              <el-option label="已驳回" value="rejected" />
            </el-select>
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD"
              clearable
              style="width:240px;"
              @change="loadData"
            />
            <el-select v-model="publisherFilter" placeholder="发布人筛选" clearable style="width:150px;" @change="loadData">
              <el-option label="全部" value="" />
              <el-option v-for="p in publisherList" :key="p.id" :label="p.real_name || p.username" :value="String(p.id)" />
            </el-select>
            <el-select v-model="shopFilter" placeholder="店铺筛选" clearable style="width:130px;" @change="loadData">
              <el-option label="全部" value="" />
              <el-option v-for="s in shopOptions" :key="s" :label="s" :value="s" />
            </el-select>
          </div>
        </div>
      </template>

      <el-table :data="list" v-loading="loading" stripe style="width:100%" empty-text="暂无接单任务" :row-class-name="tableRowClassName">
        <el-table-column prop="task_no" label="任务编号" width="95" align="center" show-overflow-tooltip />
        <el-table-column prop="shop_name" label="店铺" width="140" align="center" show-overflow-tooltip>
          <template #default="{ row }">{{ row.shop_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="publisher_name" label="发布人" width="100" align="center" show-overflow-tooltip>
          <template #default="{ row }">{{ row.publisher_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="title" label="工作项目" min-width="110" align="center" show-overflow-tooltip />
        <el-table-column label="分值" width="70" align="center">
          <template #default="{ row }">{{ row.score || '-' }}</template>
        </el-table-column>
        <el-table-column label="数量" width="70" align="center">
          <template #default="{ row }">{{ row.quantity || 1 }}</template>
        </el-table-column>
        <el-table-column label="文件地址" width="180" align="center" show-overflow-tooltip>
          <template #default="{ row }">{{ row.task_file_path || '-' }}</template>
        </el-table-column>
        <el-table-column label="参考图" width="150" align="center">
          <template #default="{ row }">
            <div
              v-if="getRefImages(row.files).length"
              draggable="true"
              @dragstart="setupFileDrag($event, getRefImages(row.files)[0])"
              style="display:inline-block;"
            >
              <el-image
                :src="getFileUrl(getRefImages(row.files)[0])"
                fit="cover"
                :preview-src-list="getRefImageSrcList(row.files)"
                preview-teleported
                style="width:48px;height:48px;border-radius:6px;cursor:pointer;border:1px solid #e4e7ed;"
              />
            </div>
            <el-tooltip
              v-else-if="getRefAttachments(row.files).length"
              :content="getRefAttachments(row.files).map(f => f.file_name).join('\n')"
              placement="top"
            >
              <div class="file-badge" draggable="true" @dragstart="setupFileDrag($event, getRefAttachments(row.files)[0])" @mouseenter="preloadFilesForDrag(getRefAttachments(row.files))">
                <el-icon :size="18"><Document /></el-icon>
                <span>{{ getRefAttachments(row.files).length }}个附件</span>
              </div>
            </el-tooltip>
            <span v-else style="color:#c0c4cc;font-size:12px;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="完成凭证" width="130" align="center">
          <template #default="{ row }">
            <InlineWorkUpload
              :files="row.files"
              :disabled="!canInlineSubmit(row)"
              :uploading="inlineUploadingId === row.id"
              :max-count="maxFileCount"
              :max-size-m-b="maxFileSizeMB"
              placeholder="粘贴/拖入"
              paste-prefix="assistant-proof"
              @upload="files => handleInlineProofUpload(row, files)"
            />
          </template>
        </el-table-column>
        <el-table-column label="完成次数" width="120" align="center">
          <template #default="{ row }">
            <el-input-number
              v-if="canInlineSubmit(row)"
              :model-value="getInlineQuantityValue(row)"
              :min="1"
              :max="999"
              size="small"
              controls-position="right"
              style="width:96px;"
              @update:model-value="value => setInlineQuantityValue(row, value)"
            />
            <span v-else>{{ row.actual_quantity || 0 }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发布时间" width="170" prop="create_time" align="center" sortable show-overflow-tooltip>
          <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">详情</el-button>
            <el-button
              v-if="row.status === 'accepted'"
              type="success"
              link size="small"
              :loading="inlineSubmitId === row.id"
              @click="submitInlineProof(row)"
            >提交</el-button>
            <el-button
              v-if="row.status === 'accepted'"
              type="warning"
              link size="small"
              @click="openUploadDialog(row)"
            >上传</el-button>
            <el-button
              v-if="row.status === 'rejected'"
              type="warning"
              link size="small"
              @click="openUploadDialog(row)"
            >重新上传</el-button>
            <el-button
              v-if="row.status === 'doing'"
              type="warning"
              link size="small"
              @click="handleUndoSubmit(row)"
            >撤回</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <Pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 15, 20]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadData"
          @size-change="loadData"
        />
      </div>

      <!-- 任务详情 —— 内联覆盖层 -->
      <transition name="overlay-fade">
        <div v-if="detailVisible" class="inline-detail-overlay">
          <div class="inline-detail-header">
            <div class="detail-header-left">
              <span class="detail-project-title" :title="currentTask.title || '-'">{{ currentTask.title || '-' }}</span>
              <span style="font-size:14px;font-weight:600;">{{ currentTask.publisher_name }}</span>
              <span class="detail-header-time">{{ formatTaskHeaderTime(currentTask) }}</span>
            </div>
            <div class="detail-header-right">
              <el-button
                v-if="currentTask.status === 'accepted' || currentTask.status === 'rejected'"
                type="warning"
                @click="openUploadDialog(currentTask)"
              >{{ currentTask.status === 'rejected' ? '重新上传' : '上传' }}</el-button>
              <el-button circle @click="detailVisible = false"><el-icon><Close /></el-icon></el-button>
            </div>
          </div>

          <div class="inline-detail-body">
            <TaskStatusTimeline :task="currentTask" task-group="operator" />
            <div class="inline-detail-stat-card">
              <label>店铺</label>
              <span>{{ currentTask.shop_name || '-' }}</span>
            </div>
            <div class="inline-detail-stat-card">
              <label>任务数量</label>
              <span>{{ currentTask.quantity || 1 }}</span>
            </div>
            <div class="inline-detail-stat-card">
              <label>完成次数</label>
              <span>{{ currentTask.actual_quantity || 0 }}</span>
            </div>
            <div class="inline-detail-stat-card">
              <label>工作项目</label>
              <span>{{ currentTask.title }}</span>
            </div>
            <div class="inline-detail-stat-card">
              <label>分值</label>
              <span>{{ currentTask.score || '-' }}</span>
            </div>
            <div class="inline-detail-stat-card full-width">
              <label>任务文件地址</label>
              <span>{{ currentTask.task_file_path || '-' }}</span>
            </div>
            <div class="inline-detail-stat-card full-width">
              <label>任务描述</label>
              <div class="value" style="white-space:pre-wrap;">{{ currentTask.description || '暂无' }}</div>
            </div>
            <div v-if="currentTask.status === 'rejected'" class="inline-detail-stat-card full-width">
              <label>驳回原因</label>
              <div class="value" style="color:#e63946;">{{ currentTask.reject_reason }}</div>
            </div>

            <template v-if="detailRefImages.length">
              <div class="inline-detail-files">
                <h4>参考图 ({{ detailRefImages.length }})</h4>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                  <div v-for="file in detailRefImages" :key="file.id" draggable="true" @dragstart="setupFileDrag($event, file)">
                    <el-image :src="file._previewSrc || getFileUrl(file)" fit="contain" :preview-src-list="detailRefPreviewList" preview-teleported style="width:120px;height:120px;border-radius:8px;border:1px solid #e4e7ed;" />
                  </div>
                </div>
              </div>
            </template>

            <div v-if="detailRefAttachments.length" class="inline-detail-files">
              <h4>参考附件 ({{ detailRefAttachments.length }})</h4>
              <div v-for="file in detailRefAttachments" :key="file.id" class="attachment-item" draggable="true" @dragstart="setupFileDrag($event, file)">
                <el-icon :size="28" color="#909399"><Document /></el-icon>
                <div class="file-card-info">
                  <span class="file-name">{{ file.file_name }}</span>
                  <span class="file-size">{{ formatSize(file.file_size) }}</span>
                </div>
                <el-button type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
              </div>
            </div>

            <div v-if="workFiles.length" class="inline-detail-files">
              <h4>完成凭证</h4>
              <div class="file-grid">
                <div v-for="file in workFiles" :key="file.id" class="file-item" draggable="true" @dragstart="setupFileDrag($event, file)">
                  <el-image v-if="file.file_type === 'image'" :src="file._previewSrc || getFileUrl(file)" fit="cover" :preview-src-list="imagePreviewList" preview-teleported style="width:120px;height:120px;border-radius:8px;" />
                  <div v-else class="attachment-item">
                    <el-icon :size="28" color="#909399"><Document /></el-icon>
                    <div class="file-card-info">
                      <span class="file-name">{{ file.file_name }}</span>
                      <span class="file-size">{{ formatSize(file.file_size) }}</span>
                    </div>
                    <el-button type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </el-card>

    <!-- 上传对话框 -->
    <el-dialog v-model="uploadVisible" title="上传完成凭证" width="500px" top="10vh">
      <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px;">
        <span style="font-size:14px;color:var(--dd-text-primary);white-space:nowrap;">完成次数</span>
        <el-input-number
          v-model="uploadQuantity"
          :min="1"
          :max="999"
          :disabled="uploadAllChecked"
          style="width:140px;"
        />
        <el-checkbox v-model="uploadAllChecked">全部</el-checkbox>
        <span v-if="uploadAllChecked" style="font-size:12px;color:#909399;">(共{{ uploadTaskQuantity }}次)</span>
      </div>
      <el-upload
        ref="uploadRef"
        v-model:file-list="uploadFiles"
        drag
        multiple
        :auto-upload="false"
        :limit="maxFileCount"
        @change="onUploadChange"
        @paste="handleUploadPaste"
      >
        <el-icon :size="40"><Plus /></el-icon>
        <div style="margin-top:8px;">拖拽或点击上传</div>
        <template #tip>
          <div style="margin-top:8px;font-size:12px;color:#909399;">
            单文件最大{{ maxFileSizeMB }}MB，最多{{ maxFileCount }}个
          </div>
        </template>
      </el-upload>
      <el-progress v-if="uploading" :percentage="uploadProgress" style="margin-top:12px;" />
      <template #footer>
        <el-button @click="uploadVisible = false">取消</el-button>
        <el-button type="primary" :loading="uploading" @click="handleUpload">上传</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close, Plus, Document } from '@element-plus/icons-vue'
import { getMyAcceptedApi, getTaskDetailApi, uploadFilesApi, finishTaskApi, undoSubmitApi, getFileUrl, fetchImageDataUrl, saveFileToDisk, setupFileDrag, preloadFilesForDrag, getPublisherListApi } from '@/api'
import { STATUS_MAP, STATUS_TAG_TYPE, formatDate, formatFileSize, formatTaskHeaderTime } from '@/utils/format'
import { useRealtime } from '@/composables/useRealtime'
import { useConfig } from '@/composables/useConfig'
import { useFileHelpers } from '@/composables/useFileHelpers'
import { usePersistedFilters } from '@/composables/usePersistedFilters'
import { appendClipboardImages, syncRawFiles } from '@/utils/clipboard-upload'
import TaskStatusTimeline from '@/components/TaskStatusTimeline.vue'
import InlineWorkUpload from '@/components/InlineWorkUpload.vue'

const route = useRoute()
const router = useRouter()

const { getInt } = useConfig()
const maxFileCount = getInt('upload.max_file_count', 10)
const maxFileSizeMB = getInt('upload.max_file_size_mb', 50)

const list = ref([])
const loading = ref(false)
const page = ref(1)
const pageSize = ref(15)
const total = ref(0)
const statusFilter = ref('')
const dateRange = ref(null)
const publisherFilter = ref('')
const shopFilter = ref('')
usePersistedFilters('operator_assistant_my_tasks', { statusFilter, dateRange, publisherFilter, shopFilter })
const dateField = ref('')
const publisherList = ref([])
const fixedStatus = computed(() => route.meta.fixedStatus || '')
const pageTitle = computed(() => route.meta.title || '我的任务')

const shopOptions = ['店铺A', '店铺B', '店铺C', '店铺D', '店铺E', '店铺F', '店铺G', '店铺H']

const detailVisible = ref(false)
const currentTask = ref(null)
const imagePreviewList = ref([])

const uploadVisible = ref(false)
const uploadRef = ref(null)
const uploadFiles = ref([])
const uploading = ref(false)
const uploadingTaskId = ref(null)
const uploadTaskQuantity = ref(1)
const uploadQuantity = ref(1)
const uploadAllChecked = ref(false)
const rawUploadFiles = ref([])
const uploadProgress = ref(0)
const inlineUploadingId = ref(null)
const inlineSubmitId = ref(null)
const inlineQuantityValues = ref({})

function statusLabel(s) { return STATUS_MAP[s] || s }
function statusType(s) { return STATUS_TAG_TYPE[s] || '' }
function tableRowClassName({ row }) {
  return row?.status === 'accepted' && row?.urge_time ? 'row-urged' : ''
}

const { getRefImages, getRefAttachments, getWorkFiles, getRefImageSrcList, getFirstImage, getImageSrcList } = useFileHelpers()
const detailRefImages = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type === 'image')
})
const detailRefPreviewList = computed(() => {
  return detailRefImages.value.map(f => f._previewSrc || getFileUrl(f))
})
const workFiles = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category !== 'reference')
})
const detailRefAttachments = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type !== 'image')
})

function canInlineSubmit(row) {
  return fixedStatus.value === 'accepted' && row?.status === 'accepted'
}

function getInlineQuantityValue(row) {
  if (!row) return null
  if (Object.prototype.hasOwnProperty.call(inlineQuantityValues.value, row.id)) {
    return inlineQuantityValues.value[row.id]
  }
  return row.actual_quantity || row.quantity || 1
}

function setInlineQuantityValue(row, value) {
  if (!row) return
  const parsed = parseInt(value)
  const nextValue = Number.isFinite(parsed) && parsed > 0 ? parsed : null
  inlineQuantityValues.value = { ...inlineQuantityValues.value, [row.id]: nextValue }
}

async function handleInlineProofUpload(row, files) {
  if (!canInlineSubmit(row) || inlineUploadingId.value) return
  inlineUploadingId.value = row.id
  try {
    const res = await uploadFilesApi(row.id, files, 'work', {
      actualQuantity: getInlineQuantityValue(row),
      saveOnly: true
    })
    if (res.code === 0) {
      ElMessage.success(res.msg || '已保存，请确认后提交')
      await loadData({ silent: true })
    } else {
      ElMessage.error(res.msg || '上传失败')
    }
  } catch (e) {
    ElMessage.error('上传失败: ' + (e.response?.data?.msg || e.message || '网络错误'))
  } finally {
    inlineUploadingId.value = null
  }
}

async function submitInlineProof(row) {
  if (!canInlineSubmit(row) || inlineSubmitId.value) return
  inlineSubmitId.value = row.id
  try {
    const detailRes = await getTaskDetailApi({ taskId: row.id })
    if (detailRes.code !== 0) {
      ElMessage.error(detailRes.msg || '获取任务详情失败')
      return
    }
    const workFiles = (detailRes.data.files || []).filter(file => file.file_category !== 'reference')
    const quantityValue = getInlineQuantityValue(row)
    if (!workFiles.length && !quantityValue) {
      ElMessage.warning('请上传完成凭证或填写完成次数')
      return
    }

    const res = await finishTaskApi({
      taskId: row.id,
      actualQuantity: quantityValue
    })
    if (res.code === 0) {
      ElMessage.success('已提交完成，等待审核')
      await loadData()
    } else {
      ElMessage.error(res.msg || '提交失败')
    }
  } catch (e) {
    ElMessage.error('提交失败: ' + (e.response?.data?.msg || e.message || '网络错误'))
  } finally {
    inlineSubmitId.value = null
  }
}

function onUploadChange(uf, ufs) {
  rawUploadFiles.value = syncRawFiles(ufs)
}

function handleUploadPaste(event) {
  appendClipboardImages(event, uploadFiles, rawUploadFiles, {
    prefix: 'operator-work',
    maxCount: maxFileCount,
    maxSizeMB: maxFileSizeMB
  })
}

async function loadData(options = {}) {
  if (!options.silent) loading.value = true
  try {
    const res = await getMyAcceptedApi({
      page: page.value,
      pageSize: pageSize.value,
      status: fixedStatus.value || statusFilter.value || undefined,
      taskGroup: 'operator',
      dateStart: dateRange.value?.[0] || undefined,
      dateEnd: dateRange.value?.[1] || undefined,
      dateField: dateField.value || undefined,
      publisherId: publisherFilter.value || undefined,
      shopName: shopFilter.value || undefined
    })
    if (res.code === 0) {
      list.value = res.data.list || []
      total.value = Number(res.data.total) || 0
      const openTaskId = route.query.openTask
      if (openTaskId) {
        const task = list.value.find(t => t.id == openTaskId)
        if (task) { router.replace({ query: {} }); viewDetail(task) }
      }
    }
  } catch (e) {
    console.warn('[OA-MyTasks] 加载失败:', e.message)
  } finally {
    if (!options.silent) loading.value = false
  }
}

watch(() => route.query.openTask, (newTaskId) => {
  if (newTaskId && list.value.length > 0) {
    const task = list.value.find(t => t.id == newTaskId)
    if (task) { router.replace({ query: {} }); viewDetail(task) }
  }
})

function queryValue(key) {
  const value = route.query[key]
  return Array.isArray(value) ? value[0] : value
}

function applyDashboardQueryFilters() {
  const status = queryValue('status')
  const dateFieldQuery = queryValue('dateField')
  if (status && !fixedStatus.value) statusFilter.value = String(status)
  dateField.value = ['finish', 'submit'].includes(dateFieldQuery) ? dateFieldQuery : ''
  if (route.query.dateStart || route.query.dateEnd || route.query.startDate || route.query.endDate) {
    const start = queryValue('dateStart') || queryValue('startDate') || queryValue('dateEnd') || queryValue('endDate')
    const end = queryValue('dateEnd') || queryValue('endDate') || queryValue('dateStart') || queryValue('startDate')
    dateRange.value = [String(start), String(end)]
  }
}

watch(() => [route.query.dateStart, route.query.dateEnd, route.query.startDate, route.query.endDate, route.query.status, route.query.dateField], () => {
  applyDashboardQueryFilters()
  page.value = 1
  loadData()
})

watch(() => route.path, () => {
  applyDashboardQueryFilters()
  page.value = 1
  detailVisible.value = false
  loadData()
})

async function viewDetail(row) {
  try {
    const res = await getTaskDetailApi({ taskId: row.id })
    if (res.code === 0) {
      const files = res.data.files || []
      const allImageFiles = files.filter(f => f.file_type === 'image')
      await Promise.all(allImageFiles.map(async (f) => {
        f._previewSrc = await fetchImageDataUrl(f)
      }))
      preloadFilesForDrag(files)
      currentTask.value = { ...res.data, files }
      const workImageFiles = files.filter(f => f.file_category !== 'reference' && f.file_type === 'image')
      imagePreviewList.value = workImageFiles.map(f => f._previewSrc || getFileUrl(f))
      detailVisible.value = true
    } else {
      ElMessage.error(res.msg || '获取详情失败')
    }
  } catch (e) {
    ElMessage.error('获取详情失败')
  }
}

function openUploadDialog(row) {
  uploadingTaskId.value = row.id
  uploadTaskQuantity.value = row.quantity || 1
  uploadQuantity.value = row.quantity || 1
  uploadAllChecked.value = true
  uploadFiles.value = []
  rawUploadFiles.value = []
  uploadVisible.value = true
}

async function handleUpload() {
  if (!rawUploadFiles.value.length && !uploadQuantity.value) {
    ElMessage.warning('请上传完成凭证或填写完成次数')
    return
  }

  uploading.value = true
  uploadProgress.value = 0
  try {
    const res = await uploadFilesApi(uploadingTaskId.value, rawUploadFiles.value, 'work', {
      actualQuantity: uploadQuantity.value,
      onUploadProgress: (event) => {
        if (event.total) uploadProgress.value = Math.min(99, Math.round((event.loaded * 100) / event.total))
      }
    })
    if (res.code === 0) {
      uploadProgress.value = 100
      ElMessage.success('上传成功')
      uploadVisible.value = false
      detailVisible.value = false
      loadData()
    } else {
      ElMessage.error(res.msg || '上传失败')
    }
  } catch (e) {
    ElMessage.error('上传失败: ' + (e.message || '网络错误'))
  } finally {
    uploading.value = false
    setTimeout(() => { uploadProgress.value = 0 }, 500)
  }
}

async function handleUndoSubmit(row) {
  try {
    await ElMessageBox.confirm(
      '确认撤回已提交的凭证？撤回后可重新上传。',
      '撤回提交',
      { type: 'warning', confirmButtonText: '确认撤回' }
    )
    const res = await undoSubmitApi({ taskId: row.id })
    if (res.code === 0) {
      ElMessage.success(res.msg)
      detailVisible.value = false
      loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } catch {}
}

const formatSize = formatFileSize

async function loadPublishers() {
  try {
    const res = await getPublisherListApi()
    if (res.code === 0) publisherList.value = res.data || []
  } catch {}
}
applyDashboardQueryFilters()
loadPublishers()

watch(uploadAllChecked, (val) => {
  if (val) uploadQuantity.value = uploadTaskQuantity.value
})

useRealtime(loadData, 3000, {
  shouldPause: () => detailVisible.value || uploadVisible.value || !!inlineUploadingId.value || !!inlineSubmitId.value
})
</script>

<style scoped>
.page-container { max-width: none; padding: 0 8px; }
.file-badge {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  cursor: pointer; color: var(--dd-text-secondary); padding: 4px 0;
}
.file-badge:hover { color: var(--dd-primary); }
.file-badge span { font-size: 10px; }
:deep(.row-urged) { background: rgba(230, 57, 70, 0.14) !important; }
:deep(.row-urged td) { color: #9f1d2a; font-weight: 600; }
.file-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.file-item { text-align: center; }
.attachment-item {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 8px; background: #f5f7fa;
  border-radius: 8px; border: 1px solid #e4e7ed;
}
.file-card-info { text-align: center; }
.file-name { font-size: 12px; color: var(--dd-text-secondary); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.file-size { font-size: 11px; color: var(--dd-text-secondary); display: block; }
</style>
