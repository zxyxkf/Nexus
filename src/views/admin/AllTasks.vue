<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">{{ pageTitle }}</span>
        </div>
      </template>

      <!-- 筛选栏 -->
      <div class="filter-bar">
        <el-input v-model="filter.keyword" placeholder="搜索编号/标题" clearable style="width:200px;" @clear="loadData" @keyup.enter="loadData" />
        <el-select v-model="filter.status" placeholder="状态" clearable style="width:120px;" @change="loadData">
          <el-option label="全部" value="" />
          <el-option label="待接单" value="wait" />
          <el-option label="已接单" value="accepted" />
          <el-option label="作图中" value="doing" />
          <el-option label="已完成" value="finished" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
        <el-select v-model="filter.publisherId" :placeholder="publisherLabel" clearable filterable style="width:150px;" @change="loadData">
          <el-option label="全部" value="" />
          <el-option v-for="u in publisherList" :key="u.id" :label="u.real_name || u.name || u.username" :value="String(u.id)" />
        </el-select>
        <el-select v-model="filter.designerId" :placeholder="designerLabel" clearable filterable style="width:150px;" @change="loadData">
          <el-option label="全部" value="" />
          <el-option v-for="u in designerList" :key="u.id" :label="u.real_name || u.name || u.username" :value="String(u.id)" />
        </el-select>
        <el-date-picker v-model="filter.dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width:260px;" @change="loadData" />
        <el-button @click="loadData" type="primary">查询</el-button>
        <el-button @click="resetFilter">重置</el-button>
        <el-button @click="exportCurrentTasks">导出当前筛选</el-button>
        <el-button :disabled="selectedRows.length === 0" @click="exportSelectedTasks">
          导出选中({{ selectedRows.length }})
        </el-button>
        <el-button :disabled="selectedRows.length === 0" @click="downloadSelectedFiles">
          下载文件({{ selectedRows.length }})
        </el-button>
        <el-button type="danger" :disabled="selectedRows.length === 0" @click="batchDeleteSelected">
          批量删除({{ selectedRows.length }})
        </el-button>
        <el-popover placement="bottom-end" :width="220" trigger="click">
          <template #reference>
            <el-button>列设置</el-button>
          </template>
          <div class="column-settings">
            <el-checkbox-group v-model="visibleColumns">
              <el-checkbox v-for="col in columnOptions" :key="col.key" :value="col.key">{{ col.label }}</el-checkbox>
            </el-checkbox-group>
          </div>
        </el-popover>
      </div>

      <el-table :data="list" v-loading="loading" stripe style="width:100%" @selection-change="onSelectionChange">
        <template #empty>
          <TaskEmptyState description="暂无任务记录" hint="可以调整筛选条件后重新查询" action-text="重置筛选" @action="resetFilter" />
        </template>
        <el-table-column type="selection" width="45" />
        <el-table-column v-if="isColumnVisible('task_no')" prop="task_no" label="任务编号" min-width="140" />
        <el-table-column v-if="isColumnVisible('title')" prop="title" label="工作项目" min-width="140" show-overflow-tooltip />
        <el-table-column v-if="isColumnVisible('score')" label="分值" align="center">
          <template #default="{ row }">{{ row.score || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('status')" label="状态">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('publisher')" prop="publisher_name" :label="publisherLabel" />
        <el-table-column v-if="isColumnVisible('designer')" prop="designer_name" :label="designerLabel" />
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">详情</el-button>
            <el-button type="danger" link size="small" @click="deleteRow(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <Pagination
          v-model:currentPage="page"
          v-model:pageSize="pageSize"
          :total="total"
          :page-sizes="[10, 15, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadData"
          @size-change="loadData"
        />
      </div>

    <!-- 任务详情 —— 内联覆盖层 -->
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
          <TaskStatusTimeline :task="currentTask" :task-group="taskGroup" />
          <div class="inline-detail-stat-card">
            <label>{{ publisherLabel }}</label>
            <span>{{ currentTask.publisher_name }}</span>
          </div>
          <div class="inline-detail-stat-card">
            <label>{{ designerLabel }}</label>
            <span>{{ currentTask.designer_name || '未接单' }}</span>
          </div>
          <div class="inline-detail-stat-card">
            <label>工作项目</label>
            <span>{{ currentTask.title || '-' }}</span>
          </div>
          <div class="inline-detail-stat-card">
            <label>分值</label>
            <span>{{ currentTask.score || '-' }}</span>
          </div>
          <div v-if="taskGroup === 'operator'" class="inline-detail-stat-card">
            <label>任务数量</label>
            <span>{{ currentTask.quantity || 1 }}</span>
          </div>
          <div v-if="taskGroup === 'operator'" class="inline-detail-stat-card">
            <label>完成次数</label>
            <span>{{ currentTask.actual_quantity || 0 }}</span>
          </div>
          <div v-if="taskGroup === 'operator'" class="inline-detail-stat-card full-width">
            <label>任务文件地址</label>
            <span>{{ currentTask.task_file_path || '-' }}</span>
          </div>
          <div v-if="taskGroup === 'cs'" class="inline-detail-stat-card">
            <label>申请分数</label>
            <span>{{ currentTask.applied_score || '-' }}</span>
          </div>
          <div v-if="taskGroup === 'design' || taskGroup === 'operator'" class="inline-detail-stat-card full-width">
            <label>上传路径</label>
            <span>{{ currentTask.work_path || '无' }}</span>
          </div>
          <div v-if="currentTask.status==='rejected'" class="inline-detail-stat-card full-width">
            <label>驳回原因</label>
            <div class="value" style="color:#e63946;">{{ currentTask.reject_reason }}</div>
          </div>
          <div class="inline-detail-stat-card full-width">
            <label>任务描述</label>
            <div class="value" style="white-space:pre-wrap;">{{ currentTask.description || '暂无' }}</div>
          </div>

          <template v-if="currentTask.files && currentTask.files.length > 0">
            <div v-if="refImageFiles.length > 0" class="inline-detail-files">
              <h4>参考图 ({{ refImageFiles.length }})</h4>
              <div v-for="file in refImageFiles" :key="file.id" style="position:relative;display:inline-block;" draggable="true" @dragstart="setupFileDrag($event, file)">
                <el-image
                  :src="file._previewSrc || getFileUrl(file)"
                  fit="contain"
                  :preview-src-list="refImagePreviewList"
                  preview-teleported
                  style="width:150px;height:150px;border-radius:8px;margin-right:8px;margin-bottom:8px;border:1px solid #e4e7ed;"
                />
                <el-button class="file-download-btn" type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
              </div>
            </div>
            <div v-if="refAttachmentFiles.length > 0" class="inline-detail-files">
              <h4>参考附件 ({{ refAttachmentFiles.length }})</h4>
              <div v-for="file in refAttachmentFiles" :key="file.id" class="file-card" draggable="true" @dragstart="setupFileDrag($event, file)">
                <el-icon :size="28" color="#909399"><Document /></el-icon>
                <div class="file-card-info">
                  <span class="file-card-name">{{ file.file_name }}</span>
                  <span class="file-card-size">{{ formatSize(file.file_size) }}</span>
                </div>
                <el-button type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
              </div>
            </div>
            <div v-if="workImageFiles.length > 0" class="inline-detail-files">
              <h4>{{ taskGroup === 'operator' ? '完成凭证图片' : '作品图片' }} ({{ workImageFiles.length }})</h4>
              <div v-for="file in workImageFiles" :key="file.id" style="position:relative;display:inline-block;" draggable="true" @dragstart="setupFileDrag($event, file)">
                <el-image
                  :src="file._previewSrc || getFileUrl(file)"
                  fit="contain"
                  :preview-src-list="workImagePreviewList"
                  preview-teleported
                  style="width:150px;height:150px;border-radius:8px;margin-right:8px;margin-bottom:8px;border:1px solid #e4e7ed;"
                />
                <el-button class="file-download-btn" type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
              </div>
            </div>
            <div v-if="workAttachmentFiles.length > 0" class="inline-detail-files">
              <h4>{{ taskGroup === 'operator' ? '完成凭证附件' : '作品附件' }} ({{ workAttachmentFiles.length }})</h4>
              <div v-for="file in workAttachmentFiles" :key="file.id" class="file-card" draggable="true" @dragstart="setupFileDrag($event, file)">
                <el-icon :size="28" color="#909399"><Document /></el-icon>
                <div class="file-card-info">
                  <span class="file-card-name">{{ file.file_name }}</span>
                  <span class="file-card-size">{{ formatSize(file.file_size) }}</span>
                </div>
                <el-button type="primary" link size="small" @click="saveFileToDisk(file)">下载</el-button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </transition>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Close, Delete, Document } from '@element-plus/icons-vue'
import { getAllTasksApi, getTaskDetailApi, getUserListApi, getDesignerListApi, getBasicDesignerListApi, getOperatorAssistantListApi, getFileUrl, fetchImageDataUrl, saveFileToDisk, deleteTaskApi, batchDeleteApi, batchDownloadFilesApi, setupFileDrag, preloadFilesForDrag } from '@/api'
import { STATUS_MAP, STATUS_TAG_TYPE, formatFileSize, formatTaskHeaderTime } from '@/utils/format'
import TaskStatusTimeline from '@/components/TaskStatusTimeline.vue'
import TaskEmptyState from '@/components/TaskEmptyState.vue'
import { usePersistedFilters } from '@/composables/usePersistedFilters'
import { exportTasksApi } from '@/api/export'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(15)
const filter = reactive({ keyword: '', status: '', publisherId: '', designerId: '', dateRange: null, dateField: '' })
usePersistedFilters(`admin_all_tasks_${route.meta.taskGroup || 'design'}`, filter)
applyQueryFilters()
const publisherList = ref([])
const designerList = ref([])
const selectedRows = ref([])
const columnOptions = [
  { key: 'task_no', label: '任务编号' },
  { key: 'title', label: '工作项目' },
  { key: 'score', label: '分值' },
  { key: 'status', label: '状态' },
  { key: 'publisher', label: '发布人' },
  { key: 'designer', label: '接单人' }
]
const visibleColumns = ref(JSON.parse(localStorage.getItem(`admin_task_columns_${route.meta.taskGroup || 'design'}`) || 'null') || columnOptions.map(c => c.key))

const detailVisible = ref(false)
const currentTask = ref(null)

const taskGroup = computed(() => route.meta.taskGroup || 'design')
const pageTitle = computed(() => `${route.meta.title || '全量任务'}管理`)
const publisherRole = computed(() => taskGroup.value === 'cs' ? 'cs_agent' : 'operator')
const designerRole = computed(() => taskGroup.value === 'cs' ? 'basic_designer' : taskGroup.value === 'operator' ? 'operator_assistant' : 'designer')
const publisherLabel = computed(() => taskGroup.value === 'cs' ? '客服' : '运营')
const designerLabel = computed(() => taskGroup.value === 'cs' ? '基础美工' : taskGroup.value === 'operator' ? '运营助理' : '美工')

function statusLabel(s) { return STATUS_MAP[s] || s }
function statusType(s) { return STATUS_TAG_TYPE[s] || 'info' }
function isColumnVisible(key) { return visibleColumns.value.includes(key) }
function onSelectionChange(rows) { selectedRows.value = rows }

const refImageFiles = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type === 'image')
})
const refAttachmentFiles = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type !== 'image')
})
const workImageFiles = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category !== 'reference' && f.file_type === 'image')
})
const workAttachmentFiles = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category !== 'reference' && f.file_type !== 'image')
})
const refImagePreviewList = computed(() => refImageFiles.value.map(f => f._previewSrc || getFileUrl(f)))
const workImagePreviewList = computed(() => workImageFiles.value.map(f => f._previewSrc || getFileUrl(f)))
const formatSize = formatFileSize

async function loadData() {
  loading.value = true
  try {
    const res = await getAllTasksApi({
      page: page.value, pageSize: pageSize.value,
      keyword: filter.keyword || undefined,
      status: filter.status || undefined,
      publisherId: filter.publisherId || undefined,
      designerId: filter.designerId || undefined,
      startDate: filter.dateRange?.[0] || undefined,
      endDate: filter.dateRange?.[1] || undefined,
      dateField: filter.dateField || undefined,
      taskGroup: taskGroup.value
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
    console.error('[AllTasks] 加载任务列表失败:', e)
  } finally { loading.value = false }
}

async function exportCurrentTasks() {
  const blob = await exportTasksApi({
    keyword: filter.keyword || undefined,
    status: filter.status || undefined,
    publisherId: filter.publisherId || undefined,
    designerId: filter.designerId || undefined,
    taskGroup: taskGroup.value,
    startDate: filter.dateRange?.[0] || undefined,
    endDate: filter.dateRange?.[1] || undefined,
    dateField: filter.dateField || undefined
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${route.meta.title || '任务列表'}_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

async function exportSelectedTasks() {
  if (!selectedRows.value.length) return
  const blob = await exportTasksApi({
    taskIds: selectedRows.value.map(r => r.id).join(','),
    taskGroup: taskGroup.value
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${route.meta.title || '任务列表'}_选中_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

async function downloadSelectedFiles() {
  if (!selectedRows.value.length) return
  const blob = await batchDownloadFilesApi({
    taskIds: selectedRows.value.map(r => r.id).join(',')
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `任务文件_${new Date().toISOString().slice(0, 10)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

watch(() => route.query.openTask, (newTaskId) => {
  if (newTaskId && list.value.length > 0) {
    const task = list.value.find(t => t.id == newTaskId)
    if (task) { router.replace({ query: {} }); viewDetail(task) }
  }
})

async function loadUsers() {
  try {
    const publisherRes = await getUserListApi({ role: publisherRole.value })
    if (publisherRes.code === 0) {
      publisherList.value = publisherRes.data.list || []
    }

    const designerApi = designerRole.value === 'basic_designer'
      ? getBasicDesignerListApi
      : designerRole.value === 'operator_assistant'
        ? getOperatorAssistantListApi
        : getDesignerListApi
    const designerRes = await designerApi()
    if (designerRes.code === 0) {
      designerList.value = designerRes.data || []
    }
  } catch (e) {
    console.error('[AllTasks] 加载用户列表失败:', e)
  }
}

function resetFilter() {
  filter.keyword = ''
  filter.status = ''
  filter.publisherId = ''
  filter.designerId = ''
  filter.dateRange = null
  filter.dateField = ''
  page.value = 1
  loadData()
}

function clearQueryFilters() {
  if (route.query.from === 'dashboard') {
    filter.keyword = ''
  }
  filter.status = ''
  filter.publisherId = ''
  filter.designerId = ''
  filter.dateRange = null
  filter.dateField = ''
}

function queryValue(key) {
  const value = route.query[key]
  return Array.isArray(value) ? value[0] : value
}

function readDrilldownFallback() {
  try {
    const raw = sessionStorage.getItem('nexus_dashboard_drilldown')
    if (!raw) return {}
    const saved = JSON.parse(raw)
    if (saved.path !== route.path) return {}
    if (Date.now() - Number(saved.time || 0) > 60_000) return {}
    sessionStorage.removeItem('nexus_dashboard_drilldown')
    return saved.query || {}
  } catch {
    return {}
  }
}

function applyQueryFilters() {
  clearQueryFilters()
  const fallback = readDrilldownFallback()
  const getParam = key => queryValue(key) || fallback[key]
  const status = getParam('status')
  const publisherId = getParam('publisherId')
  const designerId = getParam('designerId')
  const dateField = getParam('dateField')
  const drilldownDate = getParam('drilldownDate')
  const startDate = getParam('startDate') || getParam('dateStart')
  const endDate = getParam('endDate') || getParam('dateEnd')

  if (status) filter.status = status
  if (publisherId) filter.publisherId = String(publisherId)
  if (designerId) filter.designerId = String(designerId)
  filter.dateField = ['finish', 'submit'].includes(dateField) ? dateField : ''

  if (drilldownDate) {
    filter.dateRange = [String(drilldownDate), String(drilldownDate)]
  } else if (startDate || endDate) {
    filter.dateRange = [String(startDate || endDate), String(endDate || startDate)]
  }

  if (import.meta.env.DEV && (route.query.from === 'dashboard' || fallback.from === 'dashboard')) {
    console.log('[AllTasks] dashboard drilldown filters', {
      path: route.path,
      query: { ...route.query },
      fallback,
      filter: { ...filter }
    })
  }
}

watch(
  () => [route.query.startDate, route.query.endDate, route.query.dateStart, route.query.dateEnd, route.query.drilldownDate, route.query.drilldownKey, route.query.status, route.query.publisherId, route.query.designerId, route.query.dateField, route.query.from],
  () => {
    applyQueryFilters()
    page.value = 1
    loadData()
  }
)

async function viewDetail(row) {
  try {
    const res = await getTaskDetailApi({ taskId: row.id })
    if (res.code === 0) {
      const files = res.data.files || []
      const imageFiles = files.filter(f => f.file_type === 'image')
      await Promise.all(imageFiles.map(async (f) => {
        f._previewSrc = await fetchImageDataUrl(f)
      }))
      preloadFilesForDrag(files)
      currentTask.value = { ...res.data, files }
      detailVisible.value = true
    }
  } catch (e) {
    console.error('[AllTasks] 加载任务详情失败:', e)
  }
}

async function deleteRow(row) {
  try {
    await ElMessageBox.confirm(`确认删除任务「${row.task_no}」？将同时删除关联文件。`, '删除确认', { confirmButtonText: '确认删除', type: 'warning' })
    const res = await deleteTaskApi({ taskId: row.id })
    if (res.code === 0) {
      ElMessage.success(res.msg)
      await loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } catch {}
}

async function batchDeleteSelected() {
  if (!selectedRows.value.length) return
  try {
    await ElMessageBox.confirm(`确认删除选中的 ${selectedRows.value.length} 个任务？将同时删除关联文件。`, '批量删除确认', { confirmButtonText: '确认删除', type: 'warning' })
    const res = await batchDeleteApi({ taskIds: selectedRows.value.map(r => r.id) })
    if (res.code === 0) {
      ElMessage.success(res.msg)
      selectedRows.value = []
      await loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } catch {}
}

watch(visibleColumns, (cols) => {
  localStorage.setItem(`admin_task_columns_${taskGroup.value}`, JSON.stringify(cols))
}, { deep: true })

watch(() => route.meta.taskGroup, () => {
  filter.keyword = ''
  filter.status = ''
  filter.publisherId = ''
  filter.designerId = ''
  filter.dateRange = null
  filter.dateField = ''
  visibleColumns.value = JSON.parse(localStorage.getItem(`admin_task_columns_${route.meta.taskGroup || 'design'}`) || 'null') || columnOptions.map(c => c.key)
  applyQueryFilters()
  page.value = 1
  loadUsers()
  loadData()
})

onMounted(() => {
  applyQueryFilters()
  loadUsers()
  loadData()
})
</script>

<style scoped>
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
.file-download-btn { position: absolute; right: 12px; bottom: 12px; background: rgba(255, 255, 255, 0.9); border-radius: 4px; }
.column-settings { display: flex; flex-direction: column; gap: 6px; }
.column-settings :deep(.el-checkbox-group) { display: flex; flex-direction: column; gap: 6px; }
</style>
