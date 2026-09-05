<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ pageTitle }}</span>
          <div class="header-right">
            <el-input
              v-model="keyword"
              placeholder="搜索旺旺ID/款号"
              clearable
              style="width:200px;"
              @clear="loadData"
              @keyup.enter="loadData"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-select
              v-model="publisherFilter"
              placeholder="发布人筛选"
              clearable
              style="width:150px;"
              @change="loadData"
            >
              <el-option label="全部" value="" />
              <el-option
                v-for="p in publisherList"
                :key="p.id"
                :label="p.real_name || p.username"
                :value="String(p.id)"
              />
            </el-select>
            <el-date-picker
              v-model="dateFilter"
              type="date"
              placeholder="任务日期"
              value-format="YYYY-MM-DD"
              clearable
              style="width:150px;"
              @change="loadData"
            />
            <el-select v-if="!fixedStatus" v-model="statusFilter" placeholder="状态筛选" clearable style="width:130px;" @change="loadData">
              <el-option label="全部" value="" />
              <el-option label="已接单" value="accepted" />
              <el-option label="作图中" value="doing" />
              <el-option label="待上传原图" value="pending_original" />
              <el-option label="已完成" value="finished" />
              <el-option label="修改中" value="rejected" />
            </el-select>
          </div>
        </div>
      </template>

      <el-table ref="tableRef" :default-sort="defaultSort" data-nexus-sort="off" :data="displayList" v-loading="loading" stripe style="width:100%" empty-text="暂无接单任务" highlight-current-row :row-class-name="tableRowClassName" @sort-change="handleSortChange">
        <el-table-column prop="task_no" label="编号" width="130" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="title" label="工作项目" min-width="100" show-overflow-tooltip v-if="!isBasicDesigner" />
        <el-table-column label="分值" width="80" align="center" v-if="!isBasicDesigner">
          <template #default="{ row }">{{ row.score || '-' }}</template>
        </el-table-column>
        <el-table-column label="旺旺ID" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.wangwang_id || row.ref_path || '-' }}</template>
        </el-table-column>
        <el-table-column label="款号" width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.style_number || '-' }}</template>
        </el-table-column>
        <el-table-column label="款式图" width="120" align="center">
          <template #default="{ row }">
            <div
              v-if="getStyleImages(row.files).length"
              class="style-thumb-cell"
              draggable="true"
              @dragstart="setupFileDrag($event, getStyleImages(row.files)[0])"
              @mouseenter="preloadFilesForDrag(getStyleImages(row.files))"
            >
              <el-image
                :src="getFileUrl(getStyleImages(row.files)[0])"
                :preview-src-list="getStyleImages(row.files).map(getFileUrl)"
                preview-teleported
                fit="contain"
              />
              <span>{{ getStyleImages(row.files).length }}张</span>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="参考图" min-width="160" align="center">
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
        <el-table-column label="状态" width="130">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small" effect="plain">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="publisher_name" label="发布人" width="130" />
        <el-table-column label="效果图" min-width="150" align="center">
          <template #default="{ row }">
            <div
              v-if="getEffectImages(row.files).length"
              class="media-thumb-cell"
              draggable="true"
              @dragstart="setupFileDrag($event, getEffectImages(row.files)[0])"
              style="display:inline-block;"
            >
              <el-image
                :src="getFileUrl(getEffectImages(row.files)[0])"
                fit="contain"
                :preview-src-list="getEffectImages(row.files).map(getFileUrl)"
                :initial-index="0"
                preview-teleported
                style="width:48px;height:48px;border-radius:6px;cursor:pointer;border:1px solid #e4e7ed;"
              />
            </div>
            <el-tooltip
              v-else-if="getEffectFilesForTask(row.files).length"
              :content="getEffectFilesForTask(row.files).map(f => f.file_name).join('\n')"
              placement="top"
            >
              <div class="file-badge" @click="viewDetail(row)" draggable="true" @dragstart="setupFileDrag($event, getEffectFilesForTask(row.files)[0])" @mouseenter="preloadFilesForDrag(getEffectFilesForTask(row.files))">
                <el-icon :size="18"><Document /></el-icon>
                <span>{{ getEffectFilesForTask(row.files).length }}个附件</span>
              </div>
            </el-tooltip>
            <span v-else style="color:#c0c4cc;font-size:12px;">-</span>
          </template>
        </el-table-column>
        <el-table-column label="原图" min-width="150" align="center">
          <template #default="{ row }">
            <div v-if="getOriginalImages(row.files).length" class="media-thumb-cell" draggable="true" @dragstart="setupFileDrag($event, getOriginalImages(row.files)[0])" @mouseenter="preloadFilesForDrag(getOriginalImages(row.files))">
              <el-image :src="getFileUrl(getOriginalImages(row.files)[0])" fit="contain" :preview-src-list="getOriginalImages(row.files).map(getFileUrl)" preview-teleported />
              <span>{{ getOriginalImages(row.files).length }}张</span>
            </div>
            <el-tooltip v-else-if="getOriginalFiles(row.files).length" :content="getOriginalFiles(row.files).map(f => f.file_name).join('\n')" placement="top">
              <div class="file-badge" draggable="true" @dragstart="setupFileDrag($event, getOriginalFiles(row.files)[0])" @mouseenter="preloadFilesForDrag(getOriginalFiles(row.files))">
                <el-icon :size="18"><Document /></el-icon>
                <span>{{ getOriginalFiles(row.files).length }}个文件</span>
              </div>
            </el-tooltip>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="create_time" label="发布时间" width="170" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="240" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">详情</el-button>
            <el-button
              v-if="row.status === 'accepted'"
              type="warning"
              link size="small"
              @click="openUpload(row)"
            >上传</el-button>
            <el-button
              v-if="row.status === 'pending_original'"
              type="warning"
              link size="small"
              @click="openOriginalUpload(row)"
            >上传原图</el-button>
            <el-button
              v-if="row.status === 'rejected'"
              type="warning"
              link size="small"
              @click="viewDetail(row)"
            >处理修改</el-button>
            <el-button
              v-if="row.status === 'doing'"
              type="warning"
              link size="small"
              @click="handleUndoSubmit(row)"
            >撤回</el-button>
            <el-button
              v-if="row.status !== 'finished'"
              type="info"
              link size="small"
              @click="openTransfer(row)"
            >转移</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <Pagination
          v-model:currentPage="page"
          v-model:pageSize="pageSize"
          :total="total"
          :page-sizes="[10, 15, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadData"
          @size-change="loadData"
        />
      </div>

      <!-- 任务详情 —— 内联覆盖层 -->
      <TaskDetail
        :visible="detailVisible"
        :task="currentTask"
        task-group="cs"
        detail-context="cs-assignee"
        :max-file-count="maxFileCount"
        :max-file-size-m-b="maxFileSizeMB"
        @close="detailVisible = false"
        @original-uploaded="refreshCurrentTask"
        @original-completed="handleOriginalCompleted"
      >
        <template #actions>
          <el-button
            v-if="currentTask.status === 'accepted'"
            type="warning"
            @click="openUpload(currentTask)"
          >上传作品</el-button>
        </template>
        <template #modifications>
          <CsModificationRecords
            :task="currentTask"
            mode="designer"
            :submit-designer="submitDesignerModification"
          />
        </template>
      </TaskDetail>
    </el-card>

    <!-- 待上传原图的独立上传窗口，避免进入详情页后重复操作 -->
    <el-dialog
      v-model="originalUploadVisible"
      title="上传原图"
      width="620px"
      top="8vh"
      append-to-body
      destroy-on-close
      class="standalone-original-upload-dialog"
      :close-on-click-modal="false"
      @closed="originalUploadTask = null"
    >
      <el-skeleton v-if="originalUploadLoading" :rows="5" animated />
      <OriginalUploadPanel
        v-else-if="originalUploadTask"
        :task="originalUploadTask"
        :auto-complete="true"
        :max-file-count="maxFileCount"
        :max-file-size-m-b="maxFileSizeMB"
        @completed="handleStandaloneOriginalCompleted"
      />
    </el-dialog>

    <!-- 上传作品对话框 -->
    <el-dialog
      v-model="uploadVisible"
      title="上传作品"
      width="500px"
      append-to-body
      :z-index="2000"
      :close-on-click-modal="false"
      @keydown.enter.exact.prevent="handleUpload"
    >
      <div v-if="retainedWorkFiles.length" class="retained-work-list">
        <div class="retained-work-title">现有作品</div>
        <div v-for="file in retainedWorkFiles" :key="file.id" class="retained-work-file">
          <el-image
            v-if="file.file_type === 'image'"
            :src="file._previewSrc || getFileUrl(file)"
            fit="cover"
            :preview-src-list="retainedWorkImageList"
            preview-teleported
          />
          <el-icon v-else :size="22"><Document /></el-icon>
          <span :title="file.file_name">{{ file.file_name }}</span>
          <small>{{ formatSize(file.file_size) }}</small>
          <el-button circle text aria-label="移除现有作品" @click="removeRetainedWorkFile(file)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>
      </div>

      <el-upload
        ref="uploadRef"
        drag
        multiple
        :auto-upload="false"
        :limit="maxFileCount"
        accept="*"
        :on-change="handleFileChange"
        :file-list="uploadUiFiles"
        @paste="handleUploadPaste"
      >
        <el-icon class="el-icon--upload" :size="48"><UploadFilled /></el-icon>
        <div class="el-upload__text">拖拽文件到此处，或<em>点击选择</em></div>
        <template #tip>
          <div class="el-upload__tip">
            支持所有文件格式，单个文件最大{{ maxFileSizeMB }}MB
          </div>
        </template>
      </el-upload>

      <el-form-item label="申请分数" style="margin-top:12px;">
        <el-input-number v-model="appliedScore" :min="1" :step="0.5" :precision="1" style="width:100%;" placeholder="默认为1分，大于1需组长审核" />
        <div class="form-hint">默认1分无需审核；大于1分需组长审核通过后生效</div>
      </el-form-item>
      <el-progress v-if="uploadLoading" :percentage="uploadProgress" style="margin-top:12px;" />
      <template #footer>
        <el-button @click="uploadVisible = false">取消</el-button>
        <el-button type="primary" @click="handleUpload" :loading="uploadLoading">
          {{ uploadLoading ? '上传中...' : '开始上传' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 转移任务对话框 -->
    <el-dialog v-model="transferVisible" title="转移任务" width="450px" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="任务编号">
          <span>{{ transferTask?.task_no }}</span>
        </el-form-item>
        <el-form-item label="工作项目">
          <span>{{ transferTask?.title }}</span>
        </el-form-item>
        <el-form-item label="转移给">
          <el-select
            v-model="transferDesignerId"
            placeholder="请选择接收人"
            filterable
            style="width:100%;"
          >
            <el-option
              v-for="d in transferDesignerList"
              :key="d.id"
              :label="`${d.real_name || d.username}（${d.is_online ? '在线' : '离线'}）`"
              :value="d.id"
              :disabled="!d.is_online"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="转移原因">
          <el-input
            v-model="transferReason"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="请填写转移原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="transferVisible = false">取消</el-button>
        <el-button type="primary" @click="handleTransfer" :loading="transferLoading">确认转移</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Document, Search, UploadFilled } from '@element-plus/icons-vue'
import { completeCsModificationApi, getMyAcceptedApi, getTaskDetailApi, uploadFilesApi, finishTaskApi, transferTaskApi, undoSubmitApi, getBasicDesignerListApi, getPublisherListApi, getFileUrl, setupFileDrag, preloadFilesForDrag } from '@/api'
import { STATUS_MAP, STATUS_TAG_TYPE, formatDate, formatFileSize, formatScoreReviewApprovedScore, formatScoreReviewStatus, formatScoreValue, scoreReviewTagType } from '@/utils/format'
import { useRealtime } from '@/composables/useRealtime'
import { useConfig } from '@/composables/useConfig'
import { useFileHelpers } from '@/composables/useFileHelpers'
import { useOverdueSort } from '@/composables/useOverdueSort'
import { usePersistedFilters } from '@/composables/usePersistedFilters'
import { usePersistedTableSort } from '@/composables/usePersistedTableSort'
import { useTaskDetail } from '@/composables/useTaskDetail'
import { getUser } from '@/utils/auth'
import { appendClipboardImages, syncRawFiles } from '@/utils/clipboard-upload'
import TaskDetail from '@/components/TaskDetail.vue'
import OriginalUploadPanel from '@/components/task/OriginalUploadPanel.vue'
import CsModificationRecords from '@/components/task/CsModificationRecords.vue'

const route = useRoute()
const router = useRouter()
const isBasicDesigner = computed(() => {
  const user = getUser()
  return user?.role === 'basic_designer'
})

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(15)
const statusFilter = ref('')
const keyword = ref('')
const publisherFilter = ref('')
const dateFilter = ref('')
usePersistedFilters('basic_my_tasks', { statusFilter, keyword, publisherFilter, dateFilter })
const dateField = ref('')
const publisherList = ref([])
const fixedStatus = computed(() => route.meta.fixedStatus || '')
const pageTitle = computed(() => route.meta.title || '我的任务')

const uploadVisible = ref(false)
const uploadLoading = ref(false)
const uploadTaskId = ref(null)
const uploadUiFiles = ref([])
const fileList = ref([])
const uploadRef = ref(null)
const uploadProgress = ref(0)
const retainedWorkFiles = ref([])
const retainedWorkImageList = computed(() => retainedWorkFiles.value
  .filter(file => file.file_type === 'image')
  .map(file => file._previewSrc || getFileUrl(file)))

const appliedScore = ref(1)
const transferVisible = ref(false)
const transferLoading = ref(false)
const transferTask = ref(null)
const transferDesignerId = ref(null)
const transferDesignerList = ref([])
const transferReason = ref('')

const originalUploadVisible = ref(false)
const originalUploadLoading = ref(false)
const originalUploadTask = ref(null)

const { detailVisible, currentTask, openDetail: viewDetail } = useTaskDetail({
  onError: error => console.error('[MyTasks] 加载任务详情失败:', error)
})

// 逾期检测 + 置顶排序
const { isOverdue, sortedList, tableRowClassName } = useOverdueSort(list)
const sortKey = ref('')
const sortOrder = ref('')
const tableRef = ref(null)
const { defaultSort } = usePersistedTableSort(
  () => `basic_my_tasks_${route.path}`,
  { prop: sortKey, order: sortOrder },
  { routePath: () => route.path, tableRef }
)

const displayList = computed(() => {
  const arr = [...sortedList.value]
  if (sortKey.value === 'task_no' && sortOrder.value) {
    arr.sort((a, b) => {
      const cmp = String(a.task_no || '').localeCompare(String(b.task_no || ''), undefined, { numeric: true })
      return sortOrder.value === 'ascending' ? cmp : -cmp
    })
  } else if (sortKey.value === 'create_time' && sortOrder.value) {
    arr.sort((a, b) => {
      const cmp = new Date(a.create_time || 0) - new Date(b.create_time || 0)
      return sortOrder.value === 'ascending' ? cmp : -cmp
    })
  }
  return arr
})

function handleSortChange({ prop, order }) {
  sortKey.value = prop || ''
  sortOrder.value = order || ''
}

function statusLabel(s) { return s === 'rejected' ? '修改中' : STATUS_MAP[s] || s }
function statusType(s) { return STATUS_TAG_TYPE[s] || 'info' }
const { getRefImages, getRefAttachments, getEffectFiles, getOriginalFiles, getRefImageSrcList } = useFileHelpers()
function getEffectImages(files) {
  return getEffectFiles(files).filter(file => file.file_type === 'image')
}
function getEffectFilesForTask(files) {
  return getEffectFiles(files)
}
function getOriginalImages(files) {
  return getOriginalFiles(files).filter(file => file.file_type === 'image')
}
const detailRefImages = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type === 'image')
})
const detailRefPreviewList = computed(() => {
  return detailRefImages.value.map(f => f._previewSrc || getFileUrl(f))
})
const workImageFiles = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category !== 'reference' && f.file_category !== 'reject' && f.file_type === 'image')
})
const workImagePreviewList = computed(() => {
  return workImageFiles.value.map(f => f._previewSrc || getFileUrl(f))
})
const workAttachFiles = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category !== 'reference' && f.file_category !== 'reject' && f.file_type !== 'image')
})

function getStyleImages(files) {
  return (files || []).filter(file => file.file_category === 'style' && file.file_type === 'image')
}
const detailRefAttachments = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type !== 'image')
})

async function loadData(options = {}) {
  if (!options.silent) loading.value = true
  try {
    const res = await getMyAcceptedApi({
      page: page.value,
      pageSize: pageSize.value,
      status: fixedStatus.value === 'accepted' ? 'accepted,rejected,pending_original' : (fixedStatus.value || statusFilter.value || undefined),
      taskGroup: 'cs',
      keyword: keyword.value || undefined,
      publisherId: publisherFilter.value || undefined,
      dateStart: dateFilter.value || undefined,
      dateEnd: dateFilter.value || undefined,
      dateField: dateField.value || undefined
    })
    if (res.code === 0) {
      list.value = res.data.list
      total.value = Number(res.data.total) || 0
      const openTaskId = route.query.openTask
      if (openTaskId) {
        const task = list.value.find(t => t.id == openTaskId)
        if (task) { router.replace({ query: {} }); viewDetail(task) }
      }
    }
  } catch (e) {
    console.error('[MyTasks] 加载接单列表失败:', e)
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
  const date = queryValue('dateStart') || queryValue('startDate') || queryValue('dateEnd') || queryValue('endDate')
  if (date) dateFilter.value = String(date)
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

function openUpload(row) {
  if (row.status !== 'accepted') {
    viewDetail(row)
    return
  }
  uploadTaskId.value = row.id
  uploadUiFiles.value = []
  fileList.value = []
  retainedWorkFiles.value = (row.files || []).filter(file => (
    file.file_category === 'work' && !file.reject_record_id
  ))
  appliedScore.value = Number(row.applied_score) > 0 ? Number(row.applied_score) : 1
  uploadVisible.value = true
}

function removeRetainedWorkFile(file) {
  retainedWorkFiles.value = retainedWorkFiles.value.filter(item => Number(item.id) !== Number(file.id))
}

function handleFileChange(uploadFile, uploadFiles) {
  uploadUiFiles.value = uploadFiles || []
  fileList.value = syncRawFiles(uploadFiles)
}

function handleUploadPaste(event) {
  appendClipboardImages(event, uploadUiFiles, fileList, {
    prefix: 'work',
    maxCount: maxFileCount.value,
    maxSizeMB: maxFileSizeMB.value
  })
}

async function handleUpload() {
  if (uploadLoading.value) return
  if (!fileList.value.length && !retainedWorkFiles.value.length) {
    ElMessage.warning('请先选择文件')
    return
  }

  // 上传前校验
  const maxSizeMB = getInt('upload.max_file_size_mb', 50)
  const maxSize = maxSizeMB * 1024 * 1024
  const oversize = fileList.value.find(f => f.size > maxSize)
  if (oversize) {
    ElMessage.warning(`文件"${oversize.name}"超过${maxSizeMB}MB限制`)
    return
  }
  const maxCount = getInt('upload.max_file_count', 10)
  if (fileList.value.length > maxCount) {
    ElMessage.warning(`一次最多上传${maxCount}个文件`)
    return
  }

  uploadLoading.value = true
  uploadProgress.value = 0
  try {
    const uploadOptions = {
      appliedScore: appliedScore.value,
      retainedFileIds: retainedWorkFiles.value.map(file => file.id),
      onUploadProgress: (event) => {
        if (event.total) uploadProgress.value = Math.min(99, Math.round((event.loaded * 100) / event.total))
      }
    }
    const res = await uploadFilesApi(uploadTaskId.value, fileList.value, 'work', uploadOptions)
    if (res.code === 0) {
      uploadProgress.value = 100
      ElMessage.success(res.msg || '上传成功')
      uploadUiFiles.value = []
      fileList.value = []
      uploadVisible.value = false
      detailVisible.value = false
      await loadData()
    } else {
      ElMessage.error(res.msg || '上传失败')
    }
  } catch (err) {
    ElMessage.error('上传失败: ' + (err.response?.data?.msg || err.message || '未知错误'))
  } finally {
    uploadLoading.value = false
    setTimeout(() => { uploadProgress.value = 0 }, 500)
  }
}

async function submitDesignerModification(payload) {
  try {
    const res = await completeCsModificationApi(payload)
    if (res.code !== 0) {
      ElMessage.error(res.msg || '提交修改失败')
      return false
    }
    ElMessage.success(res.msg || '本次修改已完成')
    detailVisible.value = false
    await loadData()
    return true
  } catch (error) {
    ElMessage.error(error.response?.data?.msg || error.message || '提交修改失败')
    return false
  }
}

async function refreshCurrentTask(taskId) {
  try {
    const response = await getTaskDetailApi({ taskId })
    if (response.code === 0) currentTask.value = response.data
  } catch (error) {
    console.error('[MyTasks] 刷新原图列表失败:', error)
  }
}

async function handleOriginalCompleted() {
  detailVisible.value = false
  await loadData()
}

async function openOriginalUpload(row) {
  if (!row?.id || row.status !== 'pending_original') return
  originalUploadTask.value = null
  originalUploadLoading.value = true
  originalUploadVisible.value = true
  try {
    const response = await getTaskDetailApi({ taskId: row.id })
    if (response.code !== 0) throw new Error(response.msg || '加载任务详情失败')
    originalUploadTask.value = response.data || row
  } catch (error) {
    originalUploadVisible.value = false
    ElMessage.error(error.response?.data?.msg || error.message || '加载任务详情失败')
  } finally {
    originalUploadLoading.value = false
  }
}

async function handleStandaloneOriginalCompleted() {
  originalUploadVisible.value = false
  originalUploadTask.value = null
  await loadData({ silent: true })
}

async function openTransfer(row) {
  transferTask.value = row
  transferDesignerId.value = null
  transferReason.value = ''
  transferVisible.value = true
  try {
    const res = await getBasicDesignerListApi()
    if (res.code === 0) {
      transferDesignerList.value = (res.data || []).filter(d => d.id !== row.designer_id)
    }
  } catch (e) {
    console.error('[MyTasks] 加载基础美工列表失败:', e)
  }
}

async function handleTransfer() {
  if (!transferDesignerId.value) {
    ElMessage.warning('请选择接收人')
    return
  }
  const selectedDesigner = transferDesignerList.value.find(d => Number(d.id) === Number(transferDesignerId.value))
  if (!selectedDesigner?.is_online) {
    ElMessage.warning('接收人当前不在线，不能转移')
    return
  }
  const reason = transferReason.value.trim()
  if (!reason) {
    ElMessage.warning('请填写转移原因')
    return
  }
  try {
    await ElMessageBox.confirm('确认将该任务转移给选中的基础美工？', '转移确认')
    transferLoading.value = true
    const res = await transferTaskApi({
      taskId: transferTask.value.id,
      newDesignerId: transferDesignerId.value,
      reason
    })
    if (res.code === 0) {
      ElMessage.success('任务转移成功')
      transferVisible.value = false
      await loadData()
    } else {
      ElMessage.error(res.msg || '转移失败')
    }
  } catch {
    // 取消
  } finally {
    transferLoading.value = false
  }
}

async function finishTask(row) {
  try {
    await ElMessageBox.confirm('确认标记完成？提交后将等待运营审核。', '确认')
    const res = await finishTaskApi({ taskId: row.id })
    if (res.code === 0) {
      ElMessage.success('已提交完成，等待审核')
      await loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } catch {}
}

async function handleUndoSubmit(row) {
  try {
    await ElMessageBox.confirm(
      '确认撤回已提交的作品？撤回后可重新上传。',
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

async function loadPublisherList() {
  try {
    const res = await getPublisherListApi()
    if (res.code === 0) {
      publisherList.value = res.data || []
    }
  } catch (e) {
    console.error('[MyTasks] 加载发布人列表失败:', e)
  }
}

onMounted(() => {
  applyDashboardQueryFilters()
  loadPublisherList()
})

const { getInt } = useConfig()
const maxFileCount = computed(() => getInt('upload.max_file_count', 10))
const maxFileSizeMB = computed(() => getInt('upload.max_file_size_mb', 50))
const formatSize = formatFileSize
useRealtime(loadData, 3000, { shouldPause: () => detailVisible.value || uploadVisible.value || originalUploadVisible.value || transferVisible.value })
</script>

<style scoped>
.page-container { max-width: none; padding: 0 8px; }
.file-badge {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  cursor: pointer; color: var(--dd-text-secondary); padding: 4px 0;
}
.file-badge:hover { color: var(--dd-primary); }
.file-badge span { font-size: 10px; }
.style-thumb-cell, .media-thumb-cell { display:inline-flex; align-items:center; gap:5px; color:var(--dd-text-secondary); font-size:11px; }
.style-thumb-cell .el-image, .media-thumb-cell .el-image { width:42px; height:42px; border-radius:5px; border:1px solid var(--dd-border-light); cursor:pointer; }
.retained-work-list { margin-bottom: 12px; border: 1px solid var(--dd-border-light); border-radius: 6px; overflow: hidden; }
.retained-work-title { padding: 8px 10px; background: var(--dd-bg-secondary); color: var(--dd-text-regular); font-size: 12px; font-weight: 700; }
.retained-work-file { display: flex; align-items: center; gap: 8px; min-height: 42px; padding: 5px 8px; border-top: 1px solid var(--dd-border-light); }
.retained-work-file .el-image { width: 32px; height: 32px; flex: 0 0 auto; border-radius: 4px; }
.retained-work-file > span { flex: 1; min-width: 0; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.retained-work-file > small { color: var(--dd-text-muted); font-size: 11px; }
.standalone-original-upload-dialog :deep(.el-dialog__body) {
  max-height: calc(100vh - 180px);
  overflow-y: auto;
  padding-top: 8px;
}
.standalone-original-upload-dialog :deep(.original-upload-panel) {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

.file-card {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; margin-bottom: 6px;
  background: var(--dd-bg-secondary, #f5f7fa);
  border-radius: 8px; border: 1px solid var(--dd-border-light, #e4e7ed);
}
.file-card-info { flex: 1; min-width: 0; }
.file-card-name {
  display: block; font-size: 13px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.file-card-size { font-size: 11px; color: var(--dd-text-secondary); }

/* 催促任务置顶高亮 */
:deep(.row-urged td) { color: #9f1d2a; font-weight: 600; }
</style>
