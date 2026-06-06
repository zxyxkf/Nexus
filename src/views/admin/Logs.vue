<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">操作日志</span>
        </div>
      </template>

      <div class="filter-bar">
        <el-select v-model="filter.operation" placeholder="操作类型" clearable style="width:150px;" @change="loadData">
          <el-option label="全部" value="" />
          <el-option v-for="op in operationTypes" :key="op" :label="op" :value="op" />
        </el-select>
        <el-input v-model="filter.username" placeholder="用户名" clearable style="width:150px;" @clear="loadData" @keyup.enter="loadData" />
        <el-date-picker v-model="filter.dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" @change="loadData" style="width:260px;" :shortcuts="dateShortcuts" />
        <el-button @click="loadData" type="primary">查询</el-button>
        <el-button type="danger" :disabled="selectedRows.length === 0" @click="handleBatchDelete">
          批量删除 ({{ selectedRows.length }})
        </el-button>
      </div>

      <el-table ref="tableRef" :data="list" v-loading="loading" stripe style="width:100%" :max-height="620" empty-text="暂无操作日志" highlight-current-row @selection-change="onSelectChange">
        <el-table-column type="selection" width="45" />
        <el-table-column prop="username" label="用户" width="90" sortable />
        <el-table-column label="角色" width="70" prop="role" sortable>
          <template #default="{ row }">
            <el-tag size="small" :type="row.role==='admin'?'danger':row.role==='sub_admin'?'':row.role==='operator'?'warning':'success'" effect="plain">
              {{ row.role==='admin'?'超级管理':row.role==='sub_admin'?'子管理':row.role==='operator'?'运营':'美工' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="operation" label="操作" width="130" show-overflow-tooltip />
        <el-table-column prop="module" label="模块" width="80" />
        <el-table-column label="结果" width="60">
          <template #default="{ row }">
            <el-tag :type="row.result_code === 0 ? 'success' : 'danger'" size="small" effect="plain">
              {{ row.result_code === 0 ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="result_msg" label="消息" width="150" show-overflow-tooltip />
        <el-table-column prop="error_msg" label="报错信息" min-width="180" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.error_msg" :style="{ color: row.result_code !== 0 ? '#f56c6c' : '' }">{{ row.error_msg }}</span>
            <span v-else style="color:#c0c4cc;">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="cost_time" label="耗时" width="70">
          <template #default="{ row }">{{ row.cost_time }}ms</template>
        </el-table-column>
        <el-table-column prop="ip_addr" label="IP" width="130" show-overflow-tooltip />
        <el-table-column label="时间" width="165">
          <template #default="{ row }">{{ row.create_time }}</template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrap">
        <Pagination
          v-model:currentPage="page"
          v-model:pageSize="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @current-change="loadData"
          @size-change="loadData"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getLogListApi, getOperationTypesApi, batchDeleteLogsApi } from '@/api'

const loading = ref(false)
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const operationTypes = ref([])
const selectedRows = ref([])

function onSelectChange(rows) { selectedRows.value = rows }

const dateShortcuts = [
  { text: '今天', value: () => [new Date(), new Date()] },
  { text: '最近3天', value: () => { const d = new Date(); d.setDate(d.getDate() - 3); return [d, new Date()] } },
  { text: '最近7天', value: () => { const d = new Date(); d.setDate(d.getDate() - 7); return [d, new Date()] } },
  { text: '最近30天', value: () => { const d = new Date(); d.setDate(d.getDate() - 30); return [d, new Date()] } }
]

const filter = reactive({
  operation: '',
  username: '',
  dateRange: null
})

async function loadData() {
  loading.value = true
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
      operation: filter.operation || undefined,
      username: filter.username || undefined,
      startDate: filter.dateRange?.[0] || undefined,
      endDate: filter.dateRange?.[1] || undefined
    }
    const res = await getLogListApi(params)
    if (res.code === 0) {
      list.value = res.data.list
      total.value = res.data.total
    }
  } catch (e) {
    console.error('[Logs] 加载日志列表失败:', e)
  } finally { loading.value = false }
}

async function loadOperationTypes() {
  try {
    const res = await getOperationTypesApi()
    if (res.code === 0) operationTypes.value = res.data
  } catch (e) {
    console.error('[Logs] 加载操作类型失败:', e)
  }
}

async function handleBatchDelete() {
  try {
    await ElMessageBox.confirm(
      `确认删除选中的 ${selectedRows.value.length} 条操作日志？此操作不可恢复。`,
      '批量删除日志',
      { confirmButtonText: '确认删除', cancelButtonText: '取消', type: 'warning' }
    )
    const ids = selectedRows.value.map(r => r.id)
    const res = await batchDeleteLogsApi({ logIds: ids })
    if (res.code === 0) {
      ElMessage.success(res.msg || '删除成功')
      selectedRows.value = []
      await loadData()
    } else {
      ElMessage.error(res.msg || '删除失败')
    }
  } catch {}
}

onMounted(() => {
  loadData()
  loadOperationTypes()
})
</script>

<style scoped>
</style>
