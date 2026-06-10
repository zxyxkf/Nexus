<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">任务审核</span>
        </div>
      </template>

      <div style="margin-bottom:12px;">
        <el-button type="success" :disabled="selectedRows.length === 0" @click="handleBatchReview">
          批量审核通过 ({{ selectedRows.length }})
        </el-button>
      </div>

      <el-table :data="displayList" v-loading="loading" stripe style="width:100%" empty-text="暂无待审核任务" @selection-change="onSelectChange" @sort-change="handleSortChange">
        <el-table-column type="selection" width="45" />
        <el-table-column prop="task_no" label="任务编号" width="95" align="center" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="shop_name" label="店铺" width="140" align="center" show-overflow-tooltip>
          <template #default="{ row }">{{ row.shop_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="title" label="工作项目" min-width="110" align="center" show-overflow-tooltip />
        <el-table-column label="分值" width="70" align="center">
          <template #default="{ row }">{{ row.score || '-' }}</template>
        </el-table-column>
        <el-table-column label="数量" width="70" align="center">
          <template #default="{ row }">{{ row.quantity || 1 }}</template>
        </el-table-column>
        <el-table-column label="完成次数" width="80" align="center">
          <template #default="{ row }">{{ row.actual_quantity || 0 }}</template>
        </el-table-column>
        <el-table-column label="文件地址" width="180" align="center" show-overflow-tooltip>
          <template #default="{ row }">{{ row.task_file_path || '-' }}</template>
        </el-table-column>
        <el-table-column prop="designer_name" label="运营助理" width="100" align="center" />
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
        <el-table-column label="完成凭证" width="190" align="center">
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
        <el-table-column label="状态" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'doing' ? 'primary' : 'success'" size="small">
              {{ row.status === 'doing' ? '待审核' : '已完成' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="create_time" label="发布时间" width="170" align="center" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">查看任务</el-button>
            <el-button
              v-if="row.status === 'doing'"
              type="success" link size="small"
              @click="handleReview(row, 'pass')"
            >通过</el-button>
            <el-button
              v-if="row.status === 'doing'"
              type="danger" link size="small"
              @click="handleReview(row, 'reject')"
            >驳回</el-button>
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

    <!-- 任务审核详情 —— 内联覆盖层 -->
    <transition name="overlay-fade">
      <div v-if="detailVisible" class="inline-detail-overlay">
        <div class="inline-detail-header">
          <div class="detail-header-left">
            <span class="detail-project-title" :title="currentTask.title || '-'">{{ currentTask.title || '-' }}</span>
            <span style="font-size:14px;font-weight:600;">{{ currentTask.designer_name }}</span>
            <span class="detail-header-time">{{ formatTaskHeaderTime(currentTask) }}</span>
          </div>
          <div class="detail-header-right">
            <el-button v-if="currentTask.status === 'doing'" type="success" size="small" @click="doReview('pass')" :loading="reviewLoading">通过</el-button>
            <el-button v-if="currentTask.status === 'doing'" type="danger" size="small" @click="doReview('reject')" :loading="reviewLoading">驳回</el-button>
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
          <div class="inline-detail-stat-card full-width">
            <label>任务文件地址</label>
            <span>{{ currentTask.task_file_path || '-' }}</span>
          </div>
          <div class="inline-detail-stat-card full-width">
            <label>任务描述</label>
            <div class="value" style="white-space:pre-wrap;">{{ currentTask.description || '暂无' }}</div>
          </div>
          <div class="inline-detail-stat-card full-width">
            <label>上传路径</label>
            <span>{{ currentTask.work_path || '无' }}</span>
          </div>

          <template v-if="detailRefImages.length">
            <div class="inline-detail-files">
              <h4>参考图 ({{ detailRefImages.length }})</h4>
              <div style="display:flex;flex-wrap:wrap;gap:8px;">
                <div v-for="file in detailRefImages" :key="file.id" style="position:relative;" draggable="true" @dragstart="setupFileDrag($event, file)">
                  <el-image :src="file._previewSrc || getFileUrl(file)" fit="contain" :preview-src-list="detailRefPreviewList" preview-teleported style="width:150px;height:150px;border-radius:8px;border:1px solid #e4e7ed;" />
                  <el-button class="file-download-btn" type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
                </div>
              </div>
            </div>
          </template>

          <div v-if="detailRefAttachments.length" class="inline-detail-files">
            <h4>参考附件 ({{ detailRefAttachments.length }})</h4>
            <div v-for="file in detailRefAttachments" :key="file.id" class="review-ref-attach" draggable="true" @dragstart="setupFileDrag($event, file)">
              <el-icon :size="28" color="#909399"><Document /></el-icon>
              <div style="flex:1;min-width:0;">
                <span style="font-size:13px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ file.file_name }}</span>
                <span style="font-size:11px;color:#909399;">{{ formatSize(file.file_size) }}</span>
              </div>
              <el-button type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
            </div>
          </div>

          <div v-if="reviewWorkFiles.length" class="inline-detail-files">
            <h4>完成凭证</h4>
            <div class="review-file-grid">
              <div v-for="file in reviewWorkFiles" :key="file.id" class="review-file-item" draggable="true" @dragstart="setupFileDrag($event, file)">
                <template v-if="file.file_type === 'image'">
                  <el-image :src="file._previewSrc || getFileUrl(file)" fit="cover" :preview-src-list="imagePreviewList" style="width:180px;height:160px;border-radius:8px;border:1px solid #e4e7ed;cursor:pointer;">
                    <template #error>
                      <div class="img-error"><el-icon :size="24"><PictureFilled /></el-icon><span>加载失败</span></div>
                    </template>
                  </el-image>
                  <el-button type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
                </template>
                <div v-else class="review-file-nonimage">
                  <el-icon :size="32"><Document /></el-icon>
                  <span class="review-file-name">{{ file.file_name }}</span>
                  <el-button type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </transition>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close, PictureFilled, Document } from '@element-plus/icons-vue'
import { getMyPublishedApi, getTaskDetailApi, reviewTaskApi, batchReviewApi, getFileUrl, fetchImageDataUrl, saveFileToDisk, setupFileDrag, preloadFilesForDrag } from '@/api'
import { useRealtime } from '@/composables/useRealtime'
import { useFileHelpers } from '@/composables/useFileHelpers'
import { formatDate, formatFileSize, formatTaskHeaderTime } from '@/utils/format'
import TaskStatusTimeline from '@/components/TaskStatusTimeline.vue'

const loading = ref(false)
const list = ref([])
const sortKey = ref('')
const sortOrder = ref('')

const displayList = computed(() => {
  const arr = [...list.value]
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
  } else {
    arr.sort((a, b) => new Date(b.create_time) - new Date(a.create_time))
  }
  return arr
})

function handleSortChange({ prop, order }) {
  sortKey.value = prop || ''
  sortOrder.value = order || ''
}
const total = ref(0)
const page = ref(1)
const pageSize = ref(15)

const detailVisible = ref(false)
const currentTask = ref(null)
const imagePreviewList = ref([])
const reviewLoading = ref(false)
const selectedRows = ref([])

function onSelectChange(rows) { selectedRows.value = rows }

const { getRefImages, getRefAttachments, getWorkFiles, getRefImageSrcList, getFirstImage, getImageSrcList } = useFileHelpers()
const detailRefImages = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type === 'image')
})
const detailRefPreviewList = computed(() => {
  return detailRefImages.value.map(f => f._previewSrc || getFileUrl(f))
})
const reviewWorkFiles = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category !== 'reference')
})
const detailRefAttachments = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type !== 'image')
})

async function handleBatchReview() {
  try {
    await ElMessageBox.confirm(`确认审核通过选中的 ${selectedRows.value.length} 个任务？`, '批量审核')
    const ids = selectedRows.value.map(r => r.id)
    const res = await batchReviewApi({ taskIds: ids })
    if (res.code === 0) {
      ElMessage.success(res.msg)
      selectedRows.value = []
      await loadData()
    } else { ElMessage.error(res.msg) }
  } catch (e) {
    if (e !== 'cancel' && e?.message !== 'cancel') {
      console.error('[OpReview] 批量审核失败:', e)
    }
  }
}

async function loadData(options = {}) {
  if (!options.silent) loading.value = true
  try {
    const res = await getMyPublishedApi({
      page: page.value,
      pageSize: pageSize.value,
      status: 'doing',
      taskGroup: 'operator',
      selfOnly: true
    })
    if (res.code === 0) {
      list.value = res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (e) {
    console.error('[OpReview] 加载失败:', e)
  } finally {
    if (!options.silent) loading.value = false
  }
}

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
    }
  } catch (e) {
    console.error('[OpReview] 加载详情失败:', e)
  }
}

async function handleReview(row, action) {
  const actionLabel = action === 'pass' ? '审核通过' : '驳回'
  try {
    await ElMessageBox.confirm(`确认${actionLabel}该任务？`, '提示')
    reviewLoading.value = true
    const res = await reviewTaskApi({ taskId: row.id, action })
    if (res.code === 0) {
      ElMessage.success(actionLabel)
      list.value = list.value.filter(item => item.id !== row.id)
      await loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } catch {
    // cancelled
  } finally {
    reviewLoading.value = false
  }
}

async function doReview(action) {
  reviewLoading.value = true
  try {
    const res = await reviewTaskApi({ taskId: currentTask.value.id, action })
    if (res.code === 0) {
      ElMessage.success(action === 'pass' ? '审核通过' : '已驳回')
      list.value = list.value.filter(item => item.id !== currentTask.value.id)
      detailVisible.value = false
      await loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } finally {
    reviewLoading.value = false
  }
}

const formatSize = formatFileSize

useRealtime(loadData, 3000, { shouldPause: () => detailVisible.value || reviewLoading.value })
</script>

<style scoped>
.page-container { max-width: none; padding: 0 8px; }
.review-file-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.review-file-item { text-align: center; }
.review-file-nonimage { width: 180px; height: 160px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #e4e7ed; border-radius: 8px; background: #fafbfc; gap: 8px; color: var(--dd-text-muted); }
.review-file-name { font-size: 12px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.img-error { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 180px; height: 160px; background: var(--dd-border-light); border-radius: 8px; color: var(--dd-text-muted); font-size: 12px; gap: 4px; }
.file-badge {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  cursor: pointer; color: var(--dd-text-secondary); padding: 4px 0;
}
.file-badge:hover { color: var(--dd-primary); }
.file-badge span { font-size: 10px; }
.review-ref-attach {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; margin-bottom: 6px;
  background: #f5f7fa; border-radius: 8px; border: 1px solid #e4e7ed;
}
.file-download-btn { position: absolute; right: 4px; bottom: 4px; background: rgba(255, 255, 255, 0.9); border-radius: 4px; }
</style>
