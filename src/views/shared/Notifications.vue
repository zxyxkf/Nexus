<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">通知中心</span>
          <div class="header-right">
            <el-switch v-model="unreadOnly" active-text="只看未读" @change="reload" />
            <el-button :disabled="!list.length" @click="markAllRead">全部已读</el-button>
            <el-button type="danger" :disabled="!list.length" @click="clearAll">清空</el-button>
          </div>
        </div>
      </template>

      <el-table :data="list" v-loading="loading" stripe style="width:100%" @row-click="openNotification">
        <template #empty>
          <TaskEmptyState description="暂无通知" hint="任务提醒、审核结果和催促提醒会显示在这里" />
        </template>
        <el-table-column label="" width="40" align="center">
          <template #default="{ row }">
            <span v-if="!row.is_read" class="unread-dot"></span>
          </template>
        </el-table-column>
        <el-table-column prop="title" label="标题" width="160" show-overflow-tooltip />
        <el-table-column prop="content" label="内容" min-width="280" show-overflow-tooltip />
        <el-table-column prop="type" label="类型" width="120">
          <template #default="{ row }">{{ typeLabel(row.type) }}</template>
        </el-table-column>
        <el-table-column prop="create_time" label="时间" width="180" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button v-if="!row.is_read" type="primary" link size="small" @click.stop="markRead(row)">已读</el-button>
            <el-button type="danger" link size="small" @click.stop="deleteOne(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <Pagination
          v-model:currentPage="page"
          v-model:pageSize="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadData"
          @size-change="loadData"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getNotificationList, readNotification, deleteNotification, getTaskDetailApi } from '@/api'
import { openTask } from '@/utils/task-navigation'
import TaskEmptyState from '@/components/TaskEmptyState.vue'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const unreadOnly = ref(false)

const TYPE_LABELS = {
  task_urge: '催促提醒',
  task_accept: '任务接单',
  task_submit: '任务提交',
  task_review: '审核通过',
  task_reject: '审核驳回',
  system: '系统通知'
}

function typeLabel(type) {
  return TYPE_LABELS[type] || type || '通知'
}

async function loadData() {
  loading.value = true
  try {
    const res = await getNotificationList({
      page: page.value,
      pageSize: pageSize.value,
      unreadOnly: unreadOnly.value ? 'true' : undefined
    })
    if (res.code === 0) {
      list.value = res.data?.list || []
      total.value = res.data?.total || 0
    }
  } finally {
    loading.value = false
  }
}

function reload() {
  page.value = 1
  loadData()
}

async function markRead(row) {
  const res = await readNotification({ id: row.id })
  if (res.code === 0) {
    row.is_read = 1
    ElMessage.success('已标记已读')
  }
}

async function markAllRead() {
  const res = await readNotification({ all: true })
  if (res.code === 0) {
    list.value.forEach(item => { item.is_read = 1 })
    ElMessage.success('已全部标记已读')
  }
}

async function deleteOne(row) {
  const res = await deleteNotification({ id: row.id })
  if (res.code === 0) {
    ElMessage.success('已删除')
    await loadData()
  }
}

async function clearAll() {
  try {
    await ElMessageBox.confirm('确认清空所有通知？', '清空通知', { type: 'warning' })
    const res = await deleteNotification({ all: true })
    if (res.code === 0) {
      list.value = []
      total.value = 0
      ElMessage.success('已清空')
    }
  } catch {}
}

async function openNotification(row) {
  if (!row.is_read) {
    await readNotification({ id: row.id }).catch(() => {})
    row.is_read = 1
  }
  if (!row.task_id) return
  try {
    const res = await getTaskDetailApi({ taskId: row.task_id })
    openTask(res.code === 0 ? res.data : { ...row, id: row.task_id })
  } catch {
    openTask({ ...row, id: row.task_id })
  }
}

onMounted(loadData)
</script>

<style scoped>
.page-container { max-width: none; padding: 0 8px; }
.unread-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dd-primary, #4361ee);
}
</style>
