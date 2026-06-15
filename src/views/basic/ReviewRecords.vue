<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">审核记录</span>
          <div class="header-right">
            <el-select v-model="publisherFilter" placeholder="筛选发布人" clearable style="width:150px;" @change="loadData">
              <el-option label="全部" value="" />
              <el-option v-for="p in publisherList" :key="p.id" :label="p.real_name || p.username" :value="p.id" />
            </el-select>
            <el-select v-model="designerFilter" placeholder="筛选基础美工" clearable style="width:150px;" @change="loadData">
              <el-option label="全部" value="" />
              <el-option v-for="d in basicDesignerList" :key="d.id" :label="d.real_name || d.username" :value="d.id" />
            </el-select>
            <el-select v-model="statusFilter" placeholder="审核状态" clearable style="width:120px;" @change="loadData">
              <el-option label="全部" value="" />
              <el-option label="已通过" value="approved" />
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
          </div>
        </div>
      </template>

      <el-table data-nexus-sort="off" :data="list" v-loading="loading" stripe style="width:100%" empty-text="暂无审核记录" highlight-current-row @sort-change="onSortChange">
        <el-table-column prop="task_no" label="任务编号" width="130" show-overflow-tooltip />
        <el-table-column label="旺旺ID" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.wangwang_id || row.ref_path || '-' }}</template>
        </el-table-column>
        <el-table-column label="款号" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.style_number || '-' }}</template>
        </el-table-column>
        <el-table-column label="申请分值" width="100" align="center">
          <template #default="{ row }">{{ formatScoreValue(row.applied_score) }}</template>
        </el-table-column>
        <el-table-column label="审核通过分数" width="120" align="center">
          <template #default="{ row }">{{ formatScoreReviewApprovedScore(row) }}</template>
        </el-table-column>
        <el-table-column label="最终分值" width="100" align="center">
          <template #default="{ row }">{{ formatScoreValue(row.score) }}</template>
        </el-table-column>
        <el-table-column label="美工" width="100" align="center">
          <template #default="{ row }">{{ row.designer_name || '-' }}</template>
        </el-table-column>
        <el-table-column label="发布人" width="100" align="center" show-overflow-tooltip>
          <template #default="{ row }">{{ row.publisher_name || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="scoreReviewTagType(row.score_review_status)" size="small">
              {{ formatScoreReviewStatus(row.score_review_status, row) }}
            </el-tag>
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
        <el-table-column label="驳回原因" min-width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.score_review_reason || '-' }}</template>
        </el-table-column>
        <el-table-column prop="create_time" label="发布时间" width="170" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
        </el-table-column>
        <el-table-column prop="score_review_time" label="分数审核时间" width="170" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatScoreReviewTime(row) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">查看作品</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <Pagination v-bind="pageBind" />
      </div>

      <!-- 任务详情覆盖层 -->
      <transition name="overlay-fade">
        <div v-if="detailVisible" class="inline-detail-overlay">
          <div class="inline-detail-header">
            <div class="detail-header-left">
              <span class="detail-number">#{{ currentTask.task_no }}</span>
              <el-tag :type="statusType(currentTask.status)" size="small">{{ statusLabel(currentTask.status) }}</el-tag>
              <span class="detail-header-time">{{ formatTaskHeaderTime(currentTask) }}</span>
            </div>
            <div class="detail-header-right">
              <el-button circle @click="detailVisible = false"><el-icon><Close /></el-icon></el-button>
            </div>
          </div>

          <div class="inline-detail-body">
            <TaskStatusTimeline :task="currentTask" task-group="cs" />
            <TaskTransferTimeline :records="currentTask.transfer_records || []" />
            <div class="inline-detail-people">
              <div class="inline-detail-stat-card">
                <label>发布人</label>
                <span>{{ currentTask.publisher_name || '-' }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>接单人</label>
                <span>{{ currentTask.designer_name || '未接单' }}</span>
              </div>
            </div>

            <div class="inline-detail-section">
              <div class="inline-detail-section-title">任务信息</div>
              <div class="inline-detail-stat-card">
                <label>工作项目</label>
                <span>{{ currentTask.title || '-' }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>最终分值</label>
                <span>{{ formatScoreValue(currentTask.score) }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>旺旺ID</label>
                <span>{{ currentTask.wangwang_id || currentTask.ref_path || '无' }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>款号</label>
                <span>{{ currentTask.style_number || '无' }}</span>
              </div>
              <div class="inline-detail-stat-card full-width">
                <label>任务描述</label>
                <div class="value" style="white-space:pre-wrap;">{{ currentTask.description || '暂无' }}</div>
              </div>
            </div>

            <div class="inline-detail-section">
              <div class="inline-detail-section-title">提交与审核</div>
              <div class="inline-detail-stat-card">
                <label>申请分值</label>
                <span style="color:var(--dd-primary);font-weight:600;font-size:18px;">{{ formatScoreValue(currentTask.applied_score) }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>分数审核通过分数</label>
                <span>{{ formatScoreReviewApprovedScore(currentTask) }}</span>
              </div>
              <div class="inline-detail-stat-card">
                <label>分值审核状态</label>
                <el-tag :type="scoreReviewTagType(currentTask.score_review_status)" size="small">
                  {{ formatScoreReviewStatus(currentTask.score_review_status, currentTask) }}
                </el-tag>
              </div>
              <div v-if="currentTask.score_review_reason" class="inline-detail-stat-card full-width">
                <label>驳回原因</label>
                <div class="value" style="white-space:pre-wrap;">{{ currentTask.score_review_reason }}</div>
              </div>
              <div v-if="currentTask.reject_reason" class="inline-detail-stat-card full-width">
                <label>任务驳回原因</label>
                <div class="value" style="color:#e63946;white-space:pre-wrap;">{{ currentTask.reject_reason }}</div>
              </div>
            </div>

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
            <div v-if="detailWorkImages.length" class="inline-detail-files">
              <h4>作品图片 ({{ detailWorkImages.length }})</h4>
              <div style="display:flex;flex-wrap:wrap;gap:8px;">
                <div v-for="(file, index) in detailWorkImages" :key="file.id" style="position:relative;" draggable="true" @dragstart="setupFileDrag($event, file)">
                  <el-image :src="file._previewSrc || getFileUrl(file)" fit="contain" :preview-src-list="detailWorkPreviewList" :initial-index="index" preview-teleported style="width:150px;height:150px;border-radius:8px;border:1px solid #e4e7ed;" />
                  <el-button type="primary" link size="small" @click="downloadFile(file)" style="position:absolute;bottom:4px;right:4px;background:rgba(255,255,255,0.85);border-radius:4px;">下载</el-button>
                </div>
              </div>
            </div>
            <div v-if="detailWorkAttachments.length" class="inline-detail-files">
              <h4>作品附件 ({{ detailWorkAttachments.length }})</h4>
              <div v-for="file in detailWorkAttachments" :key="file.id" class="file-card" draggable="true" @dragstart="setupFileDrag($event, file)">
                <el-icon :size="28" color="#909399"><Document /></el-icon>
                <div class="file-card-info">
                  <span class="file-card-name">{{ file.file_name }}</span>
                  <span class="file-card-size">{{ formatSize(file.file_size) }}</span>
                </div>
                <el-button type="primary" link size="small" @click="downloadFile(file)">下载</el-button>
              </div>
            </div>
            <RejectHistory :records="currentTask.reject_records || []" />
          </div>
        </div>
      </transition>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { Close, Document } from '@element-plus/icons-vue'
import { getScoreReviewRecordsApi } from '@/api/score'
import { getFileUrl, setupFileDrag, preloadFilesForDrag } from '@/api'
import { getBasicDesignerListApi, getPublisherListApi } from '@/api'
import { STATUS_MAP, STATUS_TAG_TYPE, formatDate, formatFileSize, formatScoreReviewApprovedScore, formatScoreReviewStatus, formatScoreReviewTime, formatScoreValue, formatTaskHeaderTime, scoreReviewTagType } from '@/utils/format'
import Pagination from '@/components/Pagination.vue'
import TaskStatusTimeline from '@/components/TaskStatusTimeline.vue'
import TaskTransferTimeline from '@/components/TaskTransferTimeline.vue'
import RejectHistory from '@/components/RejectHistory.vue'
import { useFileHelpers } from '@/composables/useFileHelpers'
import { usePersistedTableSort } from '@/composables/usePersistedTableSort'
import { useTaskDetail } from '@/composables/useTaskDetail'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(15)

const publisherFilter = ref('')
const designerFilter = ref('')
const statusFilter = ref('')
const dateRange = ref(null)
const publisherList = ref([])
const basicDesignerList = ref([])

const sortField = ref('score_review_time')
const sortOrder = ref('descending')
usePersistedTableSort('basic_review_records', { prop: sortField, order: sortOrder }, {
  defaultProp: 'score_review_time',
  defaultOrder: 'descending'
})

const { detailVisible, currentTask, openDetail: viewDetail } = useTaskDetail({
  onError: error => console.error('[ReviewRecords] 加载详情失败:', error)
})

const { getRefImages, getRefAttachments, getRefImageSrcList, getWorkFiles, getFirstImage, getImageSrcList, downloadFile } = useFileHelpers()

function statusLabel(status) { return STATUS_MAP[status] || status || '-' }
function statusType(status) { return STATUS_TAG_TYPE[status] || 'info' }

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
    const res = await getScoreReviewRecordsApi({
      page: page.value,
      pageSize: pageSize.value,
      publisherId: publisherFilter.value || undefined,
      designerId: designerFilter.value || undefined,
      status: statusFilter.value || undefined,
      dateStart: dateRange.value?.[0] || undefined,
      dateEnd: dateRange.value?.[1] || undefined,
      sortField: sortField.value,
      sortOrder: sortOrder.value === 'ascending' ? 'asc' : 'desc'
    })
    if (res.code === 0) {
      list.value = res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (e) {
    console.error('[ReviewRecords] 加载失败:', e)
  } finally { loading.value = false }
}

const formatSize = formatFileSize

function onSortChange({ prop, order }) {
  sortField.value = prop || 'score_review_time'
  sortOrder.value = order || 'descending'
  loadData()
}

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
