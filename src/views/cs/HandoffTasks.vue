<template>
  <div class="handoff-page">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="page-header">
          <div>
            <h1>暂存任务</h1>
            <p>等待在线客服继承的未完成任务</p>
          </div>
          <el-tag :type="isOnline ? 'success' : 'info'" effect="plain">
            {{ isOnline ? '当前已上线' : '当前已下线' }}
          </el-tag>
        </div>
      </template>

      <div class="toolbar">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索任务编号、旺旺ID、款号或工作项目"
          :prefix-icon="Search"
          @keyup.enter="handleFilterChange"
          @clear="handleFilterChange"
        />
        <el-select v-model="filters.status" clearable placeholder="状态筛选" @change="handleFilterChange">
          <el-option label="全部" value="" />
          <el-option v-for="option in statusOptions" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-button :icon="Refresh" :loading="loading" @click="refresh()">刷新</el-button>
      </div>

      <el-table :data="tasks" v-loading="loading" stripe empty-text="暂无暂存任务" highlight-current-row>
        <el-table-column prop="task_no" label="任务编号" min-width="150" show-overflow-tooltip />
        <el-table-column prop="wangwang_id" label="旺旺ID" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.wangwang_id || '-' }}</template>
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
                fit="cover"
              />
              <span>{{ getStyleImages(row.files).length }}张</span>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="效果图" width="120" align="center">
          <template #default="{ row }">
            <div
              v-if="getEffectImages(row.files).length"
              class="media-thumb-cell"
              draggable="true"
              @dragstart="setupFileDrag($event, getEffectImages(row.files)[0])"
              @mouseenter="preloadFilesForDrag(getEffectImages(row.files))"
            >
              <el-image
                :src="getFileUrl(getEffectImages(row.files)[0])"
                :preview-src-list="getEffectImages(row.files).map(getFileUrl)"
                preview-teleported
                fit="contain"
              />
              <span>{{ getEffectImages(row.files).length }}张</span>
            </div>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column prop="style_number" label="款号" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.style_number || '-' }}</template>
        </el-table-column>
        <el-table-column prop="designer_name" label="基础美工" min-width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ row.designer_name || '未接单' }}</template>
        </el-table-column>
        <el-table-column prop="status" label="任务状态" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)" size="small" effect="plain">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="handoff_time" label="暂存时间" width="170">
          <template #default="{ row }">{{ formatDate(row.handoff_time) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="170" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link :icon="View" @click="openDetail(row)">查看</el-button>
            <el-button
              type="success"
              link
              :icon="UserFilled"
              :disabled="!canClaim"
              :loading="claimingIds.has(row.id)"
              @click="claimTask(row)"
            >继承</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <Pagination
          v-model:currentPage="filters.page"
          v-model:pageSize="filters.pageSize"
          :total="total"
          :page-sizes="[10, 15, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="refresh"
          @size-change="handlePageSizeChange"
        />
      </div>
    </el-card>

    <TaskDetail
      :visible="detailVisible"
      :task="currentTask"
      task-group="cs"
      detail-context="handoff"
      @close="closeDetail"
    >
      <template #actions>
        <el-button
          v-if="currentTask"
          type="success"
          size="small"
          :icon="UserFilled"
          :disabled="!canClaim"
          :loading="claimingIds.has(currentTask.id)"
          @click="claimTask(currentTask)"
        >继承任务</el-button>
      </template>
    </TaskDetail>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh, Search, UserFilled, View } from '@element-plus/icons-vue'
import { claimCsHandoffTaskApi, getCsHandoffTasksApi, getFileUrl, preloadFilesForDrag, setupFileDrag } from '@/api'
import { useUserStore } from '@/store'
import { STATUS_MAP, STATUS_TAG_TYPE, formatDate } from '@/utils/format'
import { useRealtime } from '@/composables/useRealtime'
import { useTaskDetail } from '@/composables/useTaskDetail'
import { useFileHelpers } from '@/composables/useFileHelpers'
import Pagination from '@/components/Pagination.vue'
import TaskDetail from '@/components/TaskDetail.vue'

const userStore = useUserStore()
const tasks = ref([])
const total = ref(0)
const claimingIds = ref(new Set())
const filters = reactive({ keyword: '', status: '', page: 1, pageSize: 15 })
const statusOptions = [
  { label: '已接单', value: 'accepted' },
  { label: '待审核', value: 'doing' },
  { label: '修改中', value: 'rejected' },
  { label: '草稿', value: 'draft' }
]

const isOnline = computed(() => (userStore.userInfo?.csShiftStatus || 'online') === 'online')
const canClaim = computed(() => (
  userStore.isCsAgent
  && userStore.hasPermission('cs.handoff.claim')
  && isOnline.value
))

const {
  detailVisible,
  currentTask,
  openDetail,
  closeDetail
} = useTaskDetail({
  onError: error => console.error('[HandoffTasks] 加载任务详情失败:', error)
})

async function loadTasks() {
  const response = await getCsHandoffTasksApi({ ...filters })
  if (response.code !== 0) return
  tasks.value = response.data?.list || []
  total.value = Number(response.data?.total || 0)
}

const { loading, refresh } = useRealtime(loadTasks, 3000, {
  shouldPause: () => detailVisible.value
})

function handleFilterChange() {
  filters.page = 1
  refresh()
}

function handlePageSizeChange() {
  filters.page = 1
  refresh()
}

function statusLabel(status) {
  return status === 'rejected' ? '修改中' : STATUS_MAP[status] || status || '-'
}

function getStyleImages(files) {
  return (files || []).filter(file => file.file_category === 'style' && file.file_type === 'image')
}

const { getEffectFiles } = useFileHelpers()
function getEffectImages(files) {
  return getEffectFiles(files).filter(file => file.file_type === 'image')
}

function statusType(status) {
  return STATUS_TAG_TYPE[status] || 'info'
}

async function claimTask(task) {
  if (!task?.id || !canClaim.value) return
  claimingIds.value = new Set([...claimingIds.value, task.id])
  try {
    const response = await claimCsHandoffTaskApi(task.id)
    if (response.code !== 0) return
    ElMessage.success('任务已继承到我的任务')
    if (Number(currentTask.value?.id) === Number(task.id)) closeDetail()
    await refresh()
  } finally {
    const next = new Set(claimingIds.value)
    next.delete(task.id)
    claimingIds.value = next
  }
}
</script>

<style scoped>
.handoff-page {
  width: 100%;
}

.page-card {
  border-radius: 6px;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.page-header h1 {
  margin: 0;
  color: var(--dd-text-primary, #303133);
  font-size: 18px;
  line-height: 1.4;
  letter-spacing: 0;
}

.page-header p {
  margin: 4px 0 0;
  color: var(--dd-text-secondary, #606266);
  font-size: 13px;
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) 150px auto;
  gap: 10px;
  margin-bottom: 14px;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.style-thumb-cell, .media-thumb-cell {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--dd-text-secondary, #606266);
  font-size: 11px;
}

.style-thumb-cell .el-image, .media-thumb-cell .el-image {
  width: 42px;
  height: 42px;
  border: 1px solid var(--dd-border-light, #e4e7ed);
  border-radius: 5px;
  cursor: pointer;
}

@media (max-width: 760px) {
  .toolbar {
    grid-template-columns: 1fr;
  }
}
</style>
