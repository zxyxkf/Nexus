<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">分值审核</span>
          <div class="header-right">
            <el-select v-model="publisherFilter" placeholder="筛选发布人" clearable style="width:150px;" @change="loadData">
              <el-option label="全部" value="" />
              <el-option v-for="p in publisherList" :key="p.id" :label="p.real_name || p.username" :value="p.id" />
            </el-select>
            <el-select v-model="designerFilter" placeholder="筛选基础美工" clearable style="width:150px;" @change="loadData">
              <el-option label="全部" value="" />
              <el-option v-for="d in basicDesignerList" :key="d.id" :label="d.real_name || d.username" :value="d.id" />
            </el-select>
          </div>
        </div>
      </template>

      <el-table ref="tableRef" :default-sort="defaultSort" data-nexus-sort="off" @sort-change="handleSortChange" :data="list" v-loading="loading" stripe style="width:100%" empty-text="暂无待审核的分值申请" highlight-current-row>
        <el-table-column prop="task_no" label="任务编号" width="130" show-overflow-tooltip />
        <el-table-column label="旺旺ID" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.wangwang_id || row.ref_path || '-' }}</template>
        </el-table-column>
        <el-table-column label="款号" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.style_number || '-' }}</template>
        </el-table-column>
        <el-table-column label="申请分值" width="100" align="center">
          <template #default="{ row }">{{ row.applied_score }}</template>
        </el-table-column>
        <el-table-column label="美工" width="100" align="center">
          <template #default="{ row }">{{ row.designer_name || '-' }}</template>
        </el-table-column>
        <el-table-column label="发布人" width="100" align="center" show-overflow-tooltip>
          <template #default="{ row }">{{ row.publisher_name || '-' }}</template>
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
              <div class="file-badge" draggable="true" @dragstart="setupFileDrag($event, getWorkFiles(row.files)[0])" @mouseenter="preloadFilesForDrag(getWorkFiles(row.files))">
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
        <el-table-column label="操作" width="260" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">详情</el-button>
            <el-button type="success" link size="small" @click="handleApprove(row)" :loading="actionLoading === row.id">通过</el-button>
            <el-button type="danger" link size="small" @click="handleReject(row)">不通过</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <Pagination v-bind="pageBind" />
      </div>

      <!-- 驳回原因弹窗 -->
      <el-dialog v-model="rejectVisible" title="不予通过原因" width="450px" :close-on-click-modal="false">
        <el-input v-model="rejectReason" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="请填写不予通过的原因" />
        <template #footer>
          <el-button @click="rejectVisible = false">取消</el-button>
          <el-button type="danger" @click="confirmReject" :loading="rejectLoading">确认驳回</el-button>
        </template>
      </el-dialog>

      <!-- 任务详情覆盖层 -->
      <TaskDetail
        :visible="detailVisible"
        :task="currentTask"
        task-group="cs"
        detail-context="score-review"
        @close="detailVisible = false"
      >
        <template #actions>
          <el-button type="success" size="small" @click="handleApprove(currentTask)" :loading="actionLoading === currentTask?.id">通过</el-button>
          <el-button type="danger" size="small" @click="handleReject(currentTask)">不通过</el-button>
        </template>
      </TaskDetail>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
import TaskDetail from '@/components/TaskDetail.vue'
import { getScoreReviewListApi, approveScoreReviewApi, rejectScoreReviewApi } from '@/api/score'
import { getFileUrl, setupFileDrag, preloadFilesForDrag } from '@/api'
import { getBasicDesignerListApi, getPublisherListApi } from '@/api'
import { formatDate, formatFileSize } from '@/utils/format'
import Pagination from '@/components/Pagination.vue'
import { useFileHelpers } from '@/composables/useFileHelpers'
import { usePersistedTableSort } from '@/composables/usePersistedTableSort'
import { useTaskDetail } from '@/composables/useTaskDetail'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(15)
const actionLoading = ref(null)
const sortKey = ref('')
const sortOrder = ref('')
const tableRef = ref(null)
const { defaultSort } = usePersistedTableSort(
  'basic_score_review',
  { prop: sortKey, order: sortOrder },
  { tableRef }
)
function handleSortChange({ prop, order }) {
  sortKey.value = prop || ''
  sortOrder.value = order || ''
  page.value = 1
  loadData()
}

const publisherFilter = ref('')
const designerFilter = ref('')
const publisherList = ref([])
const basicDesignerList = ref([])

const rejectVisible = ref(false)
const rejectReason = ref('')
const rejectLoading = ref(false)
const rejectTaskId = ref(null)

const { detailVisible, currentTask, openDetail: viewDetail } = useTaskDetail({
  onError: error => console.error('[ScoreReview] 加载详情失败:', error)
})

const { getRefImages, getRefAttachments, getRefImageSrcList, getWorkFiles, getFirstImage, getImageSrcList, downloadFile } = useFileHelpers()

const detailRefImages = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type === 'image')
})
const detailRefPreviewList = computed(() => detailRefImages.value.map(f => f._previewSrc || getFileUrl(f)))
const detailRefAttachments = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type !== 'image')
})
const detailWorkImages = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category !== 'reference' && f.file_category !== 'reject' && f.file_type === 'image')
})
const detailWorkPreviewList = computed(() => {
  return detailWorkImages.value.map(f => f._previewSrc || getFileUrl(f))
})
const detailWorkAttachments = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category !== 'reference' && f.file_category !== 'reject' && f.file_type !== 'image')
})

const pageBind = computed(() => ({
  currentPage: page.value,
  pageSize: pageSize.value,
  total: total.value,
  pageSizes: [10, 15, 20, 50],
  layout: 'total, sizes, prev, pager, next, jumper',
  onCurrentChange: (p) => { page.value = p; loadData() },
  onSizeChange: (s) => { pageSize.value = s; loadData() }
}))

async function loadData() {
  loading.value = true
  try {
    const res = await getScoreReviewListApi({
      page: page.value,
      pageSize: pageSize.value,
      publisherId: publisherFilter.value || undefined,
      designerId: designerFilter.value || undefined,
      sortField: sortKey.value || undefined,
      sortOrder: sortOrder.value === 'ascending' ? 'asc' : sortOrder.value === 'descending' ? 'desc' : undefined
    })
    if (res.code === 0) {
      list.value = res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (e) {
    console.error('[ScoreReview] 加载失败:', e)
  } finally { loading.value = false }
}

async function handleApprove(row) {
  actionLoading.value = row.id
  try {
    const res = await approveScoreReviewApi({ taskId: row.id })
    if (res.code === 0) {
      ElMessage.success(`分值审核通过 (${row.applied_score}分)`)
      detailVisible.value = false
      await loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } finally { actionLoading.value = null }
}

function handleReject(row) {
  rejectTaskId.value = row.id
  rejectReason.value = ''
  rejectVisible.value = true
}

async function confirmReject() {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请填写不予通过的原因')
    return
  }
  rejectLoading.value = true
  try {
    const res = await rejectScoreReviewApi({ taskId: rejectTaskId.value, reason: rejectReason.value })
    if (res.code === 0) {
      ElMessage.success('已驳回，分值恢复为1')
      rejectVisible.value = false
      detailVisible.value = false
      await loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } finally { rejectLoading.value = false }
}

const formatSize = formatFileSize

async function loadBasicDesigners() {
  try {
    const res = await getBasicDesignerListApi()
    if (res.code === 0) basicDesignerList.value = res.data || []
  } catch {}
}
async function loadPublishers() {
  try {
    const res = await getPublisherListApi()
    if (res.code === 0) publisherList.value = res.data || []
  } catch {}
}

onMounted(() => {
  loadData()
  loadBasicDesigners()
  loadPublishers()
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
</style>
