<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">作品审核</span>
        </div>
      </template>

      <div style="margin-bottom:12px;">
        <el-button v-if="canReviewPage" type="success" :disabled="reviewableSelected.length === 0" @click="handleBatchReview">
          批量审核通过 ({{ reviewableSelected.length }})
        </el-button>
        <el-button
          v-if="canOpenPayment"
          type="warning"
          :disabled="paymentOpenableSelected.length === 0"
          :loading="batchPaymentOpening"
          @click="handleBatchOpenPayment"
        >批量开启打款 ({{ paymentOpenableSelected.length }})</el-button>
      </div>

      <el-table ref="tableRef" :default-sort="defaultSort" data-nexus-sort="off" :data="displayList" v-loading="loading" stripe style="width:100%" empty-text="暂无待审核任务" @selection-change="onSelectChange" @sort-change="handleSortChange">
        <el-table-column type="selection" width="45" />
        <el-table-column prop="task_no" label="任务编号" show-overflow-tooltip sortable="custom" />
        <el-table-column prop="title" label="工作项目" show-overflow-tooltip />
        <el-table-column label="分值" align="center">
          <template #default="{ row }">{{ row.score || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isCsAgent" label="旺旺ID" show-overflow-tooltip>
          <template #default="{ row }">{{ row.wangwang_id || row.ref_path || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isCsAgent" label="款号" show-overflow-tooltip>
          <template #default="{ row }">{{ row.style_number || '-' }}</template>
        </el-table-column>
        <el-table-column prop="designer_name" :label="designerLabel" />
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
        <el-table-column label="作品预览" width="190" align="center">
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
        <el-table-column label="状态">
          <template #default="{ row }">
            <el-tag :type="row.status === 'doing' ? 'primary' : 'success'" size="small">
              {{ row.status === 'doing' ? '待审核' : '已完成' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="create_time" label="发布时间" width="170" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="canOpenPayment ? 260 : 180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">查看作品</el-button>
            <el-button
              v-if="canOpenPayment && row.allowedActions?.openPayment"
              type="warning"
              link
              size="small"
              :disabled="!getWorkImages(row.files).length || isPaymentOpened(row.payment_tracking_opened)"
              :loading="paymentOpeningIds.has(row.id)"
              @click="handleOpenPayment(row)"
            >开启打款</el-button>
            <el-button
              v-if="row.status === 'doing' && row.allowedActions?.review"
              type="success" link size="small"
              @click="handleReview(row, 'pass')"
            >通过</el-button>
            <el-button
              v-if="row.status === 'doing' && row.allowedActions?.review"
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

      <!-- 作品查看 —— 内联覆盖层 -->
    <TaskDetail
      :visible="detailVisible"
      :task="currentTask"
      :task-group="taskGroup"
      detail-context="review"
      @close="detailVisible = false"
    >
      <template #actions>
        <el-button v-if="currentTask.status === 'doing' && currentTask.allowedActions?.review" type="success" size="small" @click="doReview('pass')" :loading="reviewLoading">通过</el-button>
        <el-button v-if="currentTask.status === 'doing' && currentTask.allowedActions?.review" type="danger" size="small" @click="doReview('reject')" :loading="reviewLoading">驳回</el-button>
        <el-button
          v-if="canOpenPayment && currentTask.allowedActions?.openPayment"
          type="warning"
          size="small"
          :disabled="!getWorkImages(currentTask.files).length || isPaymentOpened(currentTask.payment_tracking_opened)"
          :loading="paymentOpeningIds.has(currentTask.id)"
          @click="handleOpenPayment(currentTask)"
        >开启打款</el-button>
      </template>
    </TaskDetail>
    </el-card>

    <el-dialog
      v-model="rejectDialogVisible"
      title="驳回原因"
      width="520px"
      :close-on-click-modal="false"
    >
      <el-upload
        ref="rejectUploadRef"
        v-model:file-list="rejectUploadFiles"
        drag
        multiple
        :auto-upload="false"
        :limit="maxFileCount"
        @change="onRejectUploadChange"
        @paste="handleRejectUploadPaste"
      >
        <el-icon :size="40"><Plus /></el-icon>
        <div style="margin-top:8px;">拖拽图片或文件到此处，或点击上传</div>
        <template #tip>
          <div style="margin-top:8px;font-size:12px;color:#909399;">
            可选，支持截图粘贴；单文件最大{{ maxFileSizeMB }}MB，最多{{ maxFileCount }}个
          </div>
        </template>
      </el-upload>

      <el-input
        ref="rejectReasonInputRef"
        v-model="rejectDialogReason"
        type="textarea"
        :rows="4"
        maxlength="500"
        show-word-limit
        placeholder="请填写驳回原因"
        style="margin-top:14px;"
        @keydown.enter.ctrl.prevent="confirmRejectDialog"
      />

      <template #footer>
        <el-button @click="cancelRejectDialog">取消</el-button>
        <el-button type="danger" :loading="reviewLoading || rejectUploading" @click="confirmRejectDialog">
          确认驳回
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { nextTick, ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { PictureFilled, Document, Plus } from '@element-plus/icons-vue'
import { getMyPublishedApi, reviewTaskApi, batchReviewApi, uploadFilesApi, getFileUrl, saveFileToDisk, setupFileDrag, preloadFilesForDrag, openPaymentFromTaskApi, openPaymentBatchApi } from '@/api'
import { useRealtime } from '@/composables/useRealtime'
import { useConfig } from '@/composables/useConfig'
import { useFileHelpers } from '@/composables/useFileHelpers'
import { usePersistedTableSort } from '@/composables/usePersistedTableSort'
import { useTaskDetail } from '@/composables/useTaskDetail'
import { formatDate, formatFileSize, formatScoreReviewApprovedScore, formatScoreReviewStatus, formatScoreValue, scoreReviewTagType } from '@/utils/format'
import { appendClipboardImages, syncRawFiles } from '@/utils/clipboard-upload'
import { hasPermission } from '@/utils/permissions'
import TaskDetail from '@/components/TaskDetail.vue'

const route = useRoute()
const taskGroup = computed(() => route.meta.taskGroup || (route.meta.role === 'cs_agent' ? 'cs' : 'design'))
const isCsAgent = computed(() => taskGroup.value === 'cs')
const isOperatorTask = computed(() => taskGroup.value === 'operator')
const designerLabel = computed(() => isCsAgent.value ? '基础美工' : isOperatorTask.value ? '运营助理' : '美工')
const canOpenPayment = computed(() => taskGroup.value === 'design' && hasPermission('payment.open'))
const reviewPermission = computed(() => (
  taskGroup.value === 'operator'
    ? 'operator.review.assistant'
    : taskGroup.value === 'cs'
      ? 'cs.review.basic'
      : 'operator.review.design'
))
const canReviewPage = computed(() => hasPermission(reviewPermission.value))

function isPaymentOpened(value) {
  return value === true || value === 1 || value === '1'
}

const loading = ref(false)
const list = ref([])
const sortKey = ref('')
const sortOrder = ref('')
const tableRef = ref(null)
const { defaultSort } = usePersistedTableSort(
  () => `shared_review_${route.path}`,
  { prop: sortKey, order: sortOrder },
  { routePath: () => route.path, tableRef }
)

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

const imagePreviewList = ref([])
const { detailVisible, currentTask, openDetail: viewDetail } = useTaskDetail({
  onLoaded: (detail) => {
    const workImageFiles = (detail.files || []).filter(file => file.file_category !== 'reference' && file.file_category !== 'reject' && file.file_type === 'image')
    imagePreviewList.value = workImageFiles.map(file => file._previewSrc || getFileUrl(file))
  },
  onError: error => console.error('[Review] 加载任务详情失败:', error)
})
const reviewLoading = ref(false)
const selectedRows = ref([])
const reviewableSelected = computed(() => selectedRows.value.filter(row => (
  row.status === 'doing' && row.allowedActions?.review
)))
const paymentOpenableSelected = computed(() => selectedRows.value.filter(row => (
  row.allowedActions?.openPayment
  && getWorkImages(row.files).length
  && !isPaymentOpened(row.payment_tracking_opened)
)))
const paymentOpeningIds = ref(new Set())
const batchPaymentOpening = ref(false)
const rejectDialogVisible = ref(false)
const rejectDialogReason = ref('')
const rejectDialogResolve = ref(null)
const rejectUploadFiles = ref([])
const rejectRawFiles = ref([])
const rejectUploadRef = ref(null)
const rejectReasonInputRef = ref(null)
const rejectUploading = ref(false)
const { getInt } = useConfig()
const maxFileCount = computed(() => getInt('upload.max_file_count', 10))
const maxFileSizeMB = computed(() => getInt('upload.max_file_size_mb', 50))

function onSelectChange(rows) { selectedRows.value = rows }

const { getRefImages, getRefAttachments, getWorkFiles, getRefImageSrcList, getFirstImage, getImageSrcList, getImagePreviewIndex } = useFileHelpers()
function getWorkImages(files) {
  return getWorkFiles(files).filter(file => file.file_type === 'image')
}
const detailRefImages = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type === 'image')
})
const detailRefPreviewList = computed(() => {
  return detailRefImages.value.map(f => f._previewSrc || getFileUrl(f))
})
const reviewWorkFiles = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category !== 'reference' && f.file_category !== 'reject')
})
const detailRefAttachments = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type !== 'image')
})

async function handleBatchReview() {
  if (!reviewableSelected.value.length) return
  try {
    await ElMessageBox.confirm(`确认审核通过选中的 ${reviewableSelected.value.length} 个任务？`, '批量审核')
    const ids = reviewableSelected.value.map(r => r.id)
    const res = await batchReviewApi({ taskIds: ids })
    if (res.code === 0) {
      ElMessage.success(res.msg)
      selectedRows.value = []
      await loadData()
    } else { ElMessage.error(res.msg) }
  } catch {}
}

async function handleOpenPayment(row) {
  if (!row.allowedActions?.openPayment || !getWorkImages(row.files).length || isPaymentOpened(row.payment_tracking_opened)) return
  paymentOpeningIds.value = new Set([...paymentOpeningIds.value, row.id])
  try {
    const res = await openPaymentFromTaskApi(row.id)
    if (res.code === 0) {
      ElMessage.success(
        res.data?.restored
          ? '已恢复打款记录'
          : res.data?.alreadyOpened
            ? '该任务已开启打款'
            : '打款已开启'
      )
      await loadData()
    } else {
      ElMessage.error(res.msg || '开启打款失败')
    }
  } catch (error) {
    console.error('[Review] 开启打款失败:', error)
  } finally {
    const nextIds = new Set(paymentOpeningIds.value)
    nextIds.delete(row.id)
    paymentOpeningIds.value = nextIds
  }
}

async function handleBatchOpenPayment() {
  if (!paymentOpenableSelected.value.length) return
  batchPaymentOpening.value = true
  try {
    const res = await openPaymentBatchApi(paymentOpenableSelected.value.map(row => row.id))
    if (res.code !== 0) {
      ElMessage.error(res.msg || '批量开启打款失败')
      return
    }
    const result = res.data || {}
    const skippedDetails = (result.skipped || [])
      .map(item => `${item.taskNo || `任务${item.taskId}`}：${item.reason}`)
      .join('\n')
    const summary = `成功${Number(result.successCount || 0)}条，跳过${Number(result.skippedCount || 0)}条`
    await ElMessageBox.alert(
      skippedDetails ? `${summary}\n\n${skippedDetails}` : summary,
      '批量开启结果',
      {
        confirmButtonText: '知道了',
        showClose: false,
        customClass: 'payment-batch-result'
      }
    )
    selectedRows.value = []
    tableRef.value?.clearSelection?.()
    await loadData()
  } catch (error) {
    console.error('[Review] 批量开启打款失败:', error)
  } finally {
    batchPaymentOpening.value = false
  }
}

async function loadData(options = {}) {
  if (!options.silent) loading.value = true
  try {
    const res = await getMyPublishedApi({
      page: page.value,
      pageSize: pageSize.value,
      status: 'doing',
      taskGroup: taskGroup.value,
      selfOnly: true
    })
    if (res.code === 0) {
      list.value = res.data.list || []
      total.value = res.data.total || 0
    }
  } catch (e) {
    console.error('[Review] 加载审核列表失败:', e)
  } finally {
    if (!options.silent) loading.value = false
  }
}

async function handleReview(row, action) {
  if (!row.allowedActions?.review) return
  const actionLabel = action === 'pass' ? '审核通过' : '驳回'
  try {
    const rejectPayload = await getRejectPayload(action)
    if (!rejectPayload.reason) {
      await ElMessageBox.confirm(`确认${actionLabel}该任务？`, '提示')
    }
    reviewLoading.value = true
    const res = await reviewTaskApi({ taskId: row.id, action, rejectReason: rejectPayload.reason })
    if (res.code === 0) {
      await uploadRejectFilesIfNeeded(row.id, res.data?.rejectRecordId, rejectPayload.files)
      ElMessage.success(actionLabel)
      list.value = list.value.filter(item => item.id !== row.id)
      await loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } catch {
    // 用户取消
  } finally {
    reviewLoading.value = false
  }
}

async function doReview(action) {
  if (!currentTask.value?.allowedActions?.review) return
  try {
    const rejectPayload = await getRejectPayload(action)
    reviewLoading.value = true
    const res = await reviewTaskApi({ taskId: currentTask.value.id, action, rejectReason: rejectPayload.reason })
    if (res.code === 0) {
      await uploadRejectFilesIfNeeded(currentTask.value.id, res.data?.rejectRecordId, rejectPayload.files)
      ElMessage.success(action === 'pass' ? '审核通过' : '已驳回')
      list.value = list.value.filter(item => item.id !== currentTask.value.id)
      detailVisible.value = false
      await loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } catch {
    // 用户取消
  } finally {
    reviewLoading.value = false
  }
}

async function getRejectPayload(action) {
  if (action !== 'reject' || !isCsAgent.value) return { reason: '', files: [] }
  rejectDialogReason.value = ''
  rejectUploadFiles.value = []
  rejectRawFiles.value = []
  rejectDialogVisible.value = true
  await nextTick()
  rejectReasonInputRef.value?.focus?.()
  return new Promise((resolve, reject) => {
    rejectDialogResolve.value = { resolve, reject }
  })
}

function onRejectUploadChange(uploadFile, uploadFiles) {
  rejectRawFiles.value = syncRawFiles(uploadFiles)
}

function handleRejectUploadPaste(event) {
  appendClipboardImages(event, rejectUploadFiles, rejectRawFiles, {
    prefix: 'reject',
    maxCount: maxFileCount.value,
    maxSizeMB: maxFileSizeMB.value
  })
}

function cancelRejectDialog() {
  rejectDialogVisible.value = false
  rejectDialogResolve.value?.reject?.()
  rejectDialogResolve.value = null
}

function confirmRejectDialog() {
  const text = String(rejectDialogReason.value || '').trim()
  if (!text) {
    ElMessage.warning('请填写驳回原因')
    return
  }
  if (text.length > 500) {
    ElMessage.warning('驳回原因不能超过500字')
    return
  }
  const files = [...rejectRawFiles.value]
  rejectDialogVisible.value = false
  rejectDialogResolve.value?.resolve?.({ reason: text, files })
  rejectDialogResolve.value = null
}

async function uploadRejectFilesIfNeeded(taskId, rejectRecordId, files) {
  if (!files?.length) return
  if (!rejectRecordId) {
    ElMessage.warning('驳回已提交，但驳回附件缺少记录ID，未上传附件')
    return
  }
  rejectUploading.value = true
  try {
    const res = await uploadFilesApi(taskId, files, 'reject', { rejectRecordId })
    if (res.code !== 0) ElMessage.error(res.msg || '驳回附件上传失败')
  } catch (err) {
    ElMessage.error('驳回附件上传失败: ' + (err.response?.data?.msg || err.message || '未知错误'))
  } finally {
    rejectUploading.value = false
  }
}

const formatSize = formatFileSize
watch(taskGroup, async () => {
  page.value = 1
  list.value = []
  total.value = 0
  selectedRows.value = []
  detailVisible.value = false
  currentTask.value = null
  await loadData()
})
useRealtime(loadData, 3000, { shouldPause: () => detailVisible.value || reviewLoading.value || rejectDialogVisible.value })
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
.multiline-value { white-space: pre-wrap; word-break: break-word; }
.reject-reason-text { color: #e63946; white-space: pre-wrap; word-break: break-word; }
.file-download-btn { position: absolute; right: 4px; bottom: 4px; background: rgba(255, 255, 255, 0.9); border-radius: 4px; }
:global(.payment-batch-result .el-message-box__message) { white-space: pre-line; }
</style>
