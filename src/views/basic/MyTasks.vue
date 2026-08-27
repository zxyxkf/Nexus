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
              <el-option label="已完成" value="finished" />
              <el-option label="已驳回" value="rejected" />
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
        <el-table-column label="指定颜色" width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.specified_color || '-' }}</template>
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
        <el-table-column label="作品预览" min-width="150" align="center">
          <template #default="{ row }">
            <div
              v-if="getFirstImage(row.files)"
              draggable="true"
              @dragstart="setupFileDrag($event, getFirstImage(row.files))"
              style="display:inline-block;"
            >
              <el-image
                :src="getFileUrl(getFirstImage(row.files))"
                fit="cover"
                :preview-src-list="getImageSrcList(row.files)"
                :initial-index="0"
                preview-teleported
                style="width:48px;height:48px;border-radius:6px;cursor:pointer;border:1px solid #e4e7ed;"
              />
            </div>
            <el-tooltip
              v-else-if="getWorkFiles(row.files).length"
              :content="getWorkFiles(row.files).map(f => f.file_name).join('\n')"
              placement="top"
            >
              <div class="file-badge" @click="viewDetail(row)" draggable="true" @dragstart="setupFileDrag($event, getWorkFiles(row.files)[0])" @mouseenter="preloadFilesForDrag(getWorkFiles(row.files))">
                <el-icon :size="18"><Document /></el-icon>
                <span>{{ getWorkFiles(row.files).length }}个附件</span>
              </div>
            </el-tooltip>
            <span v-else style="color:#c0c4cc;font-size:12px;">-</span>
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
            >上传作品</el-button>
            <el-button
              v-if="row.status === 'rejected'"
              type="warning"
              link size="small"
              @click="openUpload(row)"
            >重新上传</el-button>
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
      <TaskDetailOverlay
        :visible="detailVisible"
        :title="currentTask?.title || currentTask?.task_no || '任务详情'"
        body-class="inline-detail-body"
        @close="detailVisible = false"
      >
        <template #summary>
          <div class="detail-header-left">
              <span class="detail-number">#{{ currentTask.task_no }}</span>
              <el-tag :type="statusType(currentTask.status)" size="small">{{ statusLabel(currentTask.status) }}</el-tag>
              <span class="detail-header-time">{{ formatTaskHeaderTime(currentTask) }}</span>
          </div>
        </template>
        <template #actions>
          <el-button
            v-if="currentTask.status === 'accepted' || currentTask.status === 'rejected'"
            type="warning"
            @click="openUpload(currentTask)"
          >{{ currentTask.status === 'rejected' ? '重新上传' : '上传作品' }}</el-button>
        </template>

            <TaskStatusTimeline :task="currentTask" task-group="cs" />
            <TaskTransferTimeline :records="currentTask.transfer_records || []" />
            <div class="inline-detail-people">
              <div class="inline-detail-stat-card">
                <label>发布人</label>
                <span>{{ currentTask.publisher_name || '-' }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>接单人</label>
                <span>{{ currentTask.designer_name || '我' }}</span>
              </div>
            </div>

            <div class="inline-detail-section">
              <div class="inline-detail-section-title">任务信息</div>
              <div class="inline-detail-stat-card">
                <label>旺旺ID</label>
                <span>{{ currentTask.wangwang_id || currentTask.ref_path || '无' }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>款号</label>
                <span>{{ currentTask.style_number || '无' }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>指定颜色</label>
                <span>{{ currentTask.specified_color || '无' }}</span>
              </div>
              <div class="inline-detail-stat-card full-width">
                <label>任务描述</label>
                <div class="value" style="white-space:pre-wrap;">{{ currentTask.description || '暂无' }}</div>
              </div>
            </div>

            <div class="inline-detail-section">
              <div class="inline-detail-section-title">提交与审核</div>
              <div class="inline-detail-stat-card">
                <label>申请分数</label>
                <span>{{ formatScoreValue(currentTask.applied_score) }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>分数审核状态</label>
                <el-tag :type="scoreReviewTagType(currentTask.score_review_status)" size="small">
                  {{ formatScoreReviewStatus(currentTask.score_review_status, currentTask) }}
                </el-tag>
              </div>
              <div class="inline-detail-stat-card">
                <label>分数审核通过分数</label>
                <span>{{ formatScoreReviewApprovedScore(currentTask) }}</span>
              </div>
              <div v-if="currentTask.status === 'rejected'" class="inline-detail-stat-card full-width">
                <label>驳回原因</label>
                <div class="value" style="color:#e63946;">{{ currentTask.reject_reason }}</div>
              </div>
              <div v-if="currentTask.score_review_reason" class="inline-detail-stat-card full-width">
                <label>分数审核驳回原因</label>
                <div class="value" style="color:#e63946;white-space:pre-wrap;">{{ currentTask.score_review_reason }}</div>
              </div>
            </div>

            <template v-if="currentTask.files && currentTask.files.length > 0">
              <div v-if="detailRefImages.length" class="inline-detail-files">
                <h4>参考图 ({{ detailRefImages.length }})</h4>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                  <div v-for="(file, index) in detailRefImages" :key="file.id" style="position:relative;" draggable="true" @dragstart="setupFileDrag($event, file)">
                    <el-image :src="file._previewSrc || getFileUrl(file)" fit="contain" :preview-src-list="detailRefPreviewList" :initial-index="index" preview-teleported style="width:150px;height:150px;border-radius:8px;border:1px solid #e4e7ed;" />
                    <el-button type="primary" link size="small" @click="downloadFile(file)" style="position:absolute;bottom:4px;right:4px;background:rgba(255,255,255,0.85);border-radius:4px;">下载</el-button>
                  </div>
                </div>
              </div>
              <div v-if="detailRefAttachments.length" class="inline-detail-files">
                <h4>参考附件 ({{ detailRefAttachments.length }})</h4>
                <div v-for="file in detailRefAttachments" :key="file.id" class="file-card" draggable="true" @dragstart="setupFileDrag($event, file)">
                  <el-icon :size="28" color="#909399"><Document /></el-icon>
                  <div class="file-card-info">
                    <span class="file-card-name">{{ file.file_name }}</span>
                    <span class="file-card-size">{{ formatSize(file.file_size) }}</span>
                  </div>
                  <el-button type="primary" link size="small" @click="downloadFile(file)">下载</el-button>
                </div>
              </div>
              <div v-if="workImageFiles.length" class="inline-detail-files">
                <h4>作品图片 ({{ workImageFiles.length }})</h4>
                <div style="display:flex;flex-wrap:wrap;gap:8px;">
                  <div v-for="(file, index) in workImageFiles" :key="file.id" style="position:relative;" draggable="true" @dragstart="setupFileDrag($event, file)">
                    <el-image :src="file._previewSrc || getFileUrl(file)" fit="contain" :preview-src-list="workImagePreviewList" :initial-index="index" preview-teleported style="width:150px;height:150px;border-radius:8px;border:1px solid #e4e7ed;" />
                    <el-button type="primary" link size="small" @click="downloadFile(file)" style="position:absolute;bottom:4px;right:4px;background:rgba(255,255,255,0.85);border-radius:4px;">下载</el-button>
                  </div>
                </div>
              </div>
              <div v-if="workAttachFiles.length" class="inline-detail-files">
                <h4>作品附件 ({{ workAttachFiles.length }})</h4>
                <div v-for="file in workAttachFiles" :key="file.id" class="file-card" draggable="true" @dragstart="setupFileDrag($event, file)">
                  <el-icon :size="28" color="#909399"><Document /></el-icon>
                  <div class="file-card-info">
                    <span class="file-card-name">{{ file.file_name }}</span>
                    <span class="file-card-size">{{ formatSize(file.file_size) }}</span>
                  </div>
                  <el-button type="primary" link size="small" @click="downloadFile(file)">下载</el-button>
                </div>
              </div>
            </template>
            <RejectHistory :records="currentTask.reject_records || []" />
      </TaskDetailOverlay>
    </el-card>

    <!-- 上传作品对话框 -->
    <el-dialog v-model="uploadVisible" title="上传作品" width="500px" :close-on-click-modal="false" @keydown.enter.exact.prevent="handleUpload">
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
import { Document, Search } from '@element-plus/icons-vue'
import { getMyAcceptedApi, uploadFilesApi, finishTaskApi, transferTaskApi, undoSubmitApi, getBasicDesignerListApi, getPublisherListApi, getFileUrl, setupFileDrag, preloadFilesForDrag } from '@/api'
import { STATUS_MAP, STATUS_TAG_TYPE, formatDate, formatFileSize, formatScoreReviewApprovedScore, formatScoreReviewStatus, formatScoreValue, formatTaskHeaderTime, scoreReviewTagType } from '@/utils/format'
import { useRealtime } from '@/composables/useRealtime'
import { useConfig } from '@/composables/useConfig'
import { useFileHelpers } from '@/composables/useFileHelpers'
import { useOverdueSort } from '@/composables/useOverdueSort'
import { usePersistedFilters } from '@/composables/usePersistedFilters'
import { usePersistedTableSort } from '@/composables/usePersistedTableSort'
import { useTaskDetail } from '@/composables/useTaskDetail'
import { getUser } from '@/utils/auth'
import { appendClipboardImages, syncRawFiles } from '@/utils/clipboard-upload'
import TaskStatusTimeline from '@/components/TaskStatusTimeline.vue'
import TaskDetailOverlay from '@/components/TaskDetailOverlay.vue'
import TaskTransferTimeline from '@/components/TaskTransferTimeline.vue'
import RejectHistory from '@/components/RejectHistory.vue'

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

const appliedScore = ref(1)
const transferVisible = ref(false)
const transferLoading = ref(false)
const transferTask = ref(null)
const transferDesignerId = ref(null)
const transferDesignerList = ref([])
const transferReason = ref('')

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

function statusLabel(s) { return STATUS_MAP[s] || s }
function statusType(s) { return STATUS_TAG_TYPE[s] || 'info' }
const { getRefImages, getRefAttachments, getWorkFiles, getRefImageSrcList, getFirstImage, getImageSrcList, downloadFile } = useFileHelpers()
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
      status: fixedStatus.value === 'accepted' ? 'accepted,rejected' : (fixedStatus.value || statusFilter.value || undefined),
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
  uploadTaskId.value = row.id
  uploadUiFiles.value = []
  fileList.value = []
  appliedScore.value = 1
  uploadVisible.value = true
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
  if (!fileList.value.length) {
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
    const res = await uploadFilesApi(uploadTaskId.value, fileList.value, 'work', {
      appliedScore: appliedScore.value,
      onUploadProgress: (event) => {
        if (event.total) uploadProgress.value = Math.min(99, Math.round((event.loaded * 100) / event.total))
      }
    })
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
useRealtime(loadData, 3000, { shouldPause: () => detailVisible.value || uploadVisible.value || transferVisible.value })
</script>

<style scoped>
.page-container { max-width: none; padding: 0 8px; }
.file-badge {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  cursor: pointer; color: var(--dd-text-secondary); padding: 4px 0;
}
.file-badge:hover { color: var(--dd-primary); }
.file-badge span { font-size: 10px; }

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
