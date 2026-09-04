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
        <el-table-column v-if="isCsAgent" label="款式图" width="120" align="center">
          <template #default="{ row }">
            <div v-if="getStyleImages(row.files).length" class="style-thumb-cell" draggable="true" @dragstart="setupFileDrag($event, getStyleImages(row.files)[0])">
              <el-image :src="getFileUrl(getStyleImages(row.files)[0])" :preview-src-list="getStyleImages(row.files).map(getFileUrl)" preview-teleported fit="contain" />
              <span>{{ getStyleImages(row.files).length }}张</span>
            </div><span v-else>-</span>
          </template>
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
        <el-table-column label="效果图" width="190" align="center">
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
        <el-table-column v-if="isCsAgent" label="原图" width="150" align="center">
          <template #default="{ row }">
            <div
              v-if="getOriginalImages(row.files).length"
              class="media-thumb-cell"
              draggable="true"
              @dragstart="setupFileDrag($event, getOriginalImages(row.files)[0])"
              @mouseenter="preloadFilesForDrag(getOriginalImages(row.files))"
            >
              <el-image
                :src="getFileUrl(getOriginalImages(row.files)[0])"
                fit="contain"
                :preview-src-list="getOriginalImages(row.files).map(getFileUrl)"
                preview-teleported
              />
              <span>{{ getOriginalImages(row.files).length }}张</span>
            </div>
            <el-tooltip v-else-if="getOriginalFiles(row.files).length" :content="getOriginalFiles(row.files).map(f => f.file_name).join('\n')" placement="top">
              <div class="file-badge" draggable="true" @dragstart="setupFileDrag($event, getOriginalFiles(row.files)[0])" @mouseenter="preloadFilesForDrag(getOriginalFiles(row.files))">
                <el-icon :size="18"><Document /></el-icon>
                <span>{{ getOriginalFiles(row.files).length }}个文件</span>
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
              v-if="isCsAgent && row.status === 'doing' && row.allowedActions?.review"
              type="warning"
              link
              size="small"
              @click="openModification(row)"
            >修改</el-button>
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
              v-if="!isCsAgent && row.status === 'doing' && row.allowedActions?.review"
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
        <el-button v-if="currentTask.status === 'doing' && currentTask.allowedActions?.review" type="warning" size="small" @click="openModificationFromDetail">修改</el-button>
        <el-button v-if="currentTask.status === 'doing' && currentTask.allowedActions?.review" type="success" size="small" @click="doReview('pass')" :loading="reviewLoading">通过</el-button>
        <el-button v-if="!isCsAgent && currentTask.status === 'doing' && currentTask.allowedActions?.review" type="danger" size="small" @click="doReview('reject')" :loading="reviewLoading">驳回</el-button>
        <el-button
          v-if="canOpenPayment && currentTask.allowedActions?.openPayment"
          type="warning"
          size="small"
          :disabled="!getWorkImages(currentTask.files).length || isPaymentOpened(currentTask.payment_tracking_opened)"
          :loading="paymentOpeningIds.has(currentTask.id)"
          @click="handleOpenPayment(currentTask)"
        >开启打款</el-button>
      </template>
      <template #modifications>
        <CsModificationRecords
          v-if="isCsAgent"
          ref="modificationRef"
          :task="currentTask"
          mode="customer"
          :submit-customer="submitCustomerModification"
        />
      </template>
    </TaskDetail>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
import { getMyPublishedApi, reviewTaskApi, requestCsModificationApi, batchReviewApi, getFileUrl, setupFileDrag, preloadFilesForDrag, openPaymentFromTaskApi, openPaymentBatchApi } from '@/api'
import { useRealtime } from '@/composables/useRealtime'
import { useFileHelpers } from '@/composables/useFileHelpers'
import { usePersistedTableSort } from '@/composables/usePersistedTableSort'
import { useTaskDetail } from '@/composables/useTaskDetail'
import { formatDate, formatScoreReviewApprovedScore, formatScoreReviewStatus, formatScoreValue, scoreReviewTagType } from '@/utils/format'
import { hasPermission } from '@/utils/permissions'
import TaskDetail from '@/components/TaskDetail.vue'
import CsModificationRecords from '@/components/task/CsModificationRecords.vue'

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

const { detailVisible, currentTask, openDetail: viewDetail } = useTaskDetail({
  onError: error => console.error('[Review] 加载任务详情失败:', error)
})
const modificationRef = ref(null)
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

function onSelectChange(rows) { selectedRows.value = rows }

async function openModification(row) {
  if (!isCsAgent.value || row?.status !== 'doing') return
  await viewDetail(row)
  await nextTick()
  modificationRef.value?.openNewModification?.()
}

async function openModificationFromDetail() {
  if (!currentTask.value || !isCsAgent.value) return
  await nextTick()
  modificationRef.value?.openNewModification?.()
}

const { getRefImages, getRefAttachments, getWorkFiles, getEffectFiles, getOriginalFiles, getRefImageSrcList } = useFileHelpers()
function getWorkImages(files) {
  return getEffectFiles(files).filter(file => file.file_type === 'image')
}
function getStyleImages(files) { return (files || []).filter(file => file.file_category === 'style' && file.file_type === 'image') }
function getEffectImages(files) { return getEffectFiles(files).filter(file => file.file_type === 'image') }
function getOriginalImages(files) { return getOriginalFiles(files).filter(file => file.file_type === 'image') }
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
    await ElMessageBox.confirm(`确认${actionLabel}该任务？`, '提示')
    reviewLoading.value = true
    const res = await reviewTaskApi({ taskId: row.id, action, rejectReason: '' })
    if (res.code === 0) {
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
    reviewLoading.value = true
    const res = await reviewTaskApi({ taskId: currentTask.value.id, action, rejectReason: '' })
    if (res.code === 0) {
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

async function submitCustomerModification(payload) {
  if (reviewLoading.value) return false
  reviewLoading.value = true
  try {
    const res = await requestCsModificationApi(payload)
    if (res.code !== 0) {
      ElMessage.error(res.msg || '新增修改失败')
      return false
    }
    ElMessage.success('已新增修改')
    list.value = list.value.filter(item => Number(item.id) !== Number(payload.taskId))
    detailVisible.value = false
    await loadData()
    return true
  } catch (error) {
    ElMessage.error(error.response?.data?.msg || error.message || '新增修改失败')
    return false
  } finally {
    reviewLoading.value = false
  }
}

watch(taskGroup, async () => {
  page.value = 1
  list.value = []
  total.value = 0
  selectedRows.value = []
  detailVisible.value = false
  currentTask.value = null
  await loadData()
})
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
.style-thumb-cell, .media-thumb-cell { display:inline-flex; align-items:center; gap:5px; color:var(--dd-text-secondary); font-size:11px; }
.style-thumb-cell .el-image, .media-thumb-cell .el-image { width:42px; height:42px; border-radius:5px; border:1px solid var(--dd-border-light); cursor:pointer; }
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
