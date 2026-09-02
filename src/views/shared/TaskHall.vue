<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">任务大厅</span>
          <div class="header-right">
            <el-input
              v-model="keyword"
              placeholder="搜索任务标题/编号"
              clearable
              style="width:240px;"
              @clear="loadData"
              @keyup.enter="loadData"
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </div>
        </div>
      </template>

      <el-table ref="tableRef" :default-sort="defaultSort" data-nexus-sort="off" @sort-change="handleSortChange" :data="list" v-loading="loading" stripe style="width:100%" highlight-current-row>
        <template #empty>
          <TaskEmptyState description="暂无可领取任务" hint="可稍后查看，或清空搜索条件后重试" action-text="清空搜索" @action="clearSearch" />
        </template>
        <el-table-column prop="task_no" label="任务编号" width="140" show-overflow-tooltip />
        <el-table-column v-if="isOperatorAssistant" prop="shop_name" label="店铺" width="140" show-overflow-tooltip>
          <template #default="{ row }">{{ row.shop_name || '-' }}</template>
        </el-table-column>
        <el-table-column prop="title" label="工作项目" min-width="90" show-overflow-tooltip />
        <el-table-column label="分值" width="100" align="center">
          <template #default="{ row }">{{ row.score || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isOperatorAssistant" label="数量" width="70" align="center">
          <template #default="{ row }">{{ row.quantity || 1 }}</template>
        </el-table-column>
        <el-table-column v-if="isOperatorAssistant" label="文件地址" width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.task_file_path || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isBasicDesigner" label="旺旺ID" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.wangwang_id || row.ref_path || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="!isOperatorAssistant" label="款号" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.style_number || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="isBasicDesigner" label="任务描述" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.description || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="!isOperatorAssistant" label="指定颜色" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.specified_color || '-' }}</template>
        </el-table-column>
        <el-table-column v-if="!isBasicDesigner && !isOperatorAssistant" label="参考路径" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ row.ref_path || '-' }}</template>
        </el-table-column>
        <el-table-column label="参考图" width="170" align="center">
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
        <el-table-column v-if="!isBasicDesigner && !isOperatorAssistant" label="截止时间" min-width="80">
          <template #default="{ row }">{{ row.deadline || '-' }}</template>
        </el-table-column>
        <el-table-column prop="publisher_name" label="发布人" width="105" />
        <el-table-column prop="create_time" label="发布时间" width="170" sortable="custom" show-overflow-tooltip>
          <template #default="{ row }">{{ formatDate(row.create_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="130" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="viewDetail(row)">详情</el-button>
            <el-button type="primary" size="small" @click="acceptTask(row)" :loading="acceptingId === row.id">接单</el-button>
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
        :task-group="taskGroup"
        detail-context="hall"
        @close="detailVisible = false"
      >
        <template #actions>
          <el-button type="primary" size="small" @click="acceptInDetail" :loading="acceptingId === currentTask?.id">接单</el-button>
        </template>
      </TaskDetail>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Document } from '@element-plus/icons-vue'
import TaskDetail from '@/components/TaskDetail.vue'
import { getTaskHallApi, acceptTaskApi, getFileUrl, setupFileDrag, preloadFilesForDrag } from '@/api'
import { formatDate, formatFileSize } from '@/utils/format'
import { useRealtime } from '@/composables/useRealtime'
import { useFileHelpers } from '@/composables/useFileHelpers'
import { usePersistedTableSort } from '@/composables/usePersistedTableSort'
import { useTaskDetail } from '@/composables/useTaskDetail'
import TaskEmptyState from '@/components/TaskEmptyState.vue'

const route = useRoute()
const isBasicDesigner = computed(() => route.meta.role === 'basic_designer')
const isOperatorAssistant = computed(() => route.meta.role === 'operator_assistant')
const taskGroup = computed(() => {
  if (route.meta.role === 'basic_designer') return 'cs'
  if (route.meta.role === 'operator_assistant') return 'operator'
  return 'design'
})

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(15)
const keyword = ref('')
const acceptingId = ref(null)
const sortKey = ref('')
const sortOrder = ref('')
const tableRef = ref(null)
const { defaultSort } = usePersistedTableSort(
  () => `task_hall_${route.path}`,
  { prop: sortKey, order: sortOrder },
  { routePath: () => route.path, tableRef }
)
function handleSortChange({ prop, order }) {
  sortKey.value = prop || ''
  sortOrder.value = order || ''
  page.value = 1
  loadData()
}
const { detailVisible, currentTask, openDetail: openTaskDetail } = useTaskDetail({
  collectPreloadFiles: detail => detail.files || [],
  collectPreviewFiles: detail => (detail.files || []).filter(file => file.file_category === 'reference' && file.file_type === 'image'),
  normalizeDetail: data => ({ ...data, files: data.files || [] }),
  onError: () => {}
})

const { getRefImages, getRefAttachments, getRefImageSrcList, downloadFile } = useFileHelpers()
const formatSize = formatFileSize

const detailRefImages = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type === 'image')
})
const detailRefPreviewList = computed(() => {
  return detailRefImages.value.map(f => f._previewSrc || getFileUrl(f))
})
const detailAttachFiles = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category !== 'reference')
})
const detailRefAttachments = computed(() => {
  if (!currentTask.value?.files) return []
  return currentTask.value.files.filter(f => f.file_category === 'reference' && f.file_type !== 'image')
})

async function viewDetail(row) {
  const res = await openTaskDetail(row)
  if (res === null) {
    currentTask.value = row
    detailVisible.value = true
  }
}

async function acceptInDetail() {
  if (currentTask.value) await acceptTask(currentTask.value)
  detailVisible.value = false
}

async function loadData(options = {}) {
  if (!options.silent) loading.value = true
  try {
    const res = await getTaskHallApi({
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value || undefined,
      taskGroup: taskGroup.value,
      sortField: sortKey.value || undefined,
      sortOrder: sortOrder.value === 'ascending' ? 'asc' : sortOrder.value === 'descending' ? 'desc' : undefined
    })
    if (res.code === 0) {
      list.value = res.data.list
      total.value = res.data.total
    }
  } catch (e) {
    console.error('[TaskHall] 加载任务大厅失败:', e)
  } finally {
    if (!options.silent) loading.value = false
  }
}

function clearSearch() {
  keyword.value = ''
  page.value = 1
  loadData()
}

watch(taskGroup, async () => {
  page.value = 1
  list.value = []
  total.value = 0
  detailVisible.value = false
  currentTask.value = null
  await loadData()
})

async function acceptTask(row) {
  try {
    await ElMessageBox.confirm(`确认接单「${row.title}」？`, '接单确认')
    acceptingId.value = row.id
    const res = await acceptTaskApi({ taskId: row.id })
    if (res.code === 0) {
      ElMessage.success('接单成功！请尽快完成')
      await loadData()
    } else {
      ElMessage.error(res.msg)
    }
  } catch {
    // 取消
  } finally {
    acceptingId.value = null
  }
}

useRealtime(loadData, 3000, { shouldPause: () => detailVisible.value })
</script>

<style scoped>
.page-container { max-width: none; padding: 0 8px; }
:deep(.el-table__body tr) { height: 52px; }
.file-card {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 12px; border: 1px solid #ebeef5;
  border-radius: 8px; margin-bottom: 6px;
}
.file-card-info { flex: 1; min-width: 0; }
.file-card-name {
  display: block; font-size: 13px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.file-card-size { font-size: 12px; color: var(--dd-text-muted); }
.multiline-value { white-space: pre-wrap; word-break: break-word; }
</style>
