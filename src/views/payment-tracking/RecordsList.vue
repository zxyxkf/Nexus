<template>
  <main class="payment-page">
    <header class="page-header">
      <div>
        <h1>打款记录</h1>
        <span class="record-count">{{ total }} 条已结束</span>
      </div>
    </header>

    <section class="filter-bar" aria-label="打款记录筛选">
      <el-input
        v-model="filters.keyword"
        clearable
        placeholder="搜索货号、产品 ID、策划人、来源任务"
        class="keyword-input"
        @clear="applyFilters"
        @keyup.enter="applyFilters"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="filters.plannerId" clearable placeholder="全部策划人" @change="applyFilters">
        <el-option v-for="item in plannerOptions" :key="item.value" :label="item.label" :value="item.value" />
      </el-select>
      <el-select v-model="filters.stageCode" clearable placeholder="结束阶段" @change="applyFilters">
        <el-option v-for="stage in PAYMENT_STAGES" :key="stage.code" :label="stage.label" :value="stage.code" />
      </el-select>
      <el-select v-if="isAdmin" v-model="filters.store" clearable placeholder="全部店铺" @change="applyFilters">
        <el-option v-for="store in storeOptions" :key="store" :label="store" :value="store" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="applyFilters">查询</el-button>
      <el-tooltip content="重置筛选" placement="top">
        <el-button circle :icon="Refresh" aria-label="重置筛选" @click="resetFilters" />
      </el-tooltip>
    </section>

    <section v-loading="loading" class="record-list">
      <ProductRowCard
        v-for="record in records"
        :key="record.id"
        :record="record"
        @select-stage="openStage(record, $event.stageCode)"
        @restore="restoreRecord(record)"
        @delete="deleteRecord(record)"
      />
      <el-empty v-if="!loading && records.length === 0" description="暂无已结束的打款记录" />
    </section>

    <Pagination
      v-if="total > 0"
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      @current-change="loadRecords"
      @size-change="handlePageSizeChange"
    />
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Refresh, Search } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deletePaymentRecordApi, listPaymentRecordsApi, restorePaymentProcessApi } from '@/api'
import ProductRowCard from '@/components/payment-tracking/ProductRowCard.vue'
import Pagination from '@/components/Pagination.vue'
import { PAYMENT_STAGES } from '@/config/payment-tracking'
import { getUser } from '@/utils/auth'

const router = useRouter()
const user = getUser()
const isAdmin = computed(() => (
  user?.role === 'admin'
  || user?.permissions?.includes('*')
  || user?.permissions?.includes('payment.manage.all')
))
const loading = ref(false)
const records = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const knownPlanners = ref(new Map())
const knownStores = ref(new Set())
const filters = reactive({ keyword: '', plannerId: '', stageCode: '', store: '' })

const plannerOptions = computed(() => [...knownPlanners.value.entries()]
  .map(([value, label]) => ({ value, label }))
  .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')))
const storeOptions = computed(() => [...knownStores.value].sort((a, b) => a.localeCompare(b, 'zh-CN')))

function rememberFilterOptions(items) {
  const planners = new Map(knownPlanners.value)
  const stores = new Set(knownStores.value)
  items.forEach(record => {
    if (record.plannerId) planners.set(record.plannerId, record.plannerName || `用户 ${record.plannerId}`)
    if (record.store) stores.add(record.store)
  })
  knownPlanners.value = planners
  knownStores.value = stores
}

async function loadRecords() {
  loading.value = true
  try {
    const response = await listPaymentRecordsApi({
      processStatus: 'ended',
      keyword: filters.keyword || undefined,
      plannerId: filters.plannerId || undefined,
      stageCode: filters.stageCode || undefined,
      store: isAdmin.value ? (filters.store || undefined) : undefined,
      page: page.value,
      pageSize: pageSize.value
    })
    records.value = response.data?.list || []
    total.value = Number(response.data?.total) || 0
    rememberFilterOptions(records.value)
  } catch (error) {
    console.error('[PaymentTracking] 加载打款记录失败:', error)
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  loadRecords()
}

function resetFilters() {
  Object.assign(filters, { keyword: '', plannerId: '', stageCode: '', store: '' })
  applyFilters()
}

function handlePageSizeChange() {
  page.value = 1
  loadRecords()
}

function openStage(record, stageCode) {
  if (!stageCode) return
  router.push(`/payment-tracking/records/${record.id}/stages/${stageCode}`)
}

async function restoreRecord(record) {
  try {
    await ElMessageBox.confirm('确认恢复这条流程？恢复后将回到选品收集继续处理。', '恢复流程', {
      confirmButtonText: '确认恢复',
      type: 'warning'
    })
    const response = await restorePaymentProcessApi(record.id, { version: record.version })
    if (response.code === 0) {
      ElMessage.success('流程已恢复')
      await loadRecords()
    }
  } catch {}
}

async function deleteRecord(record) {
  try {
    await ElMessageBox.confirm(`确认删除货号“${record.styleNumber || '未填写'}”的打款记录？`, '删除确认', {
      confirmButtonText: '确认删除',
      type: 'warning'
    })
    const response = await deletePaymentRecordApi(record.id, record.version)
    if (response.code === 0) {
      ElMessage.success('记录已删除')
      await loadRecords()
    }
  } catch {}
}

onMounted(loadRecords)
</script>

<style scoped>
.payment-page {
  min-width: 0;
}

.page-header,
.filter-bar {
  display: flex;
  align-items: center;
}

.page-header {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.page-header > div {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

h1 {
  margin: 0;
  font-size: 22px;
}

.record-count {
  color: var(--dd-text-secondary, #909399);
  font-size: 13px;
}

.filter-bar {
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px 0;
  border-top: 1px solid var(--dd-border-light, #e4e7ed);
  border-bottom: 1px solid var(--dd-border-light, #e4e7ed);
}

.filter-bar :deep(.el-select) {
  width: 150px;
}

.keyword-input {
  width: min(340px, 100%);
}

.record-list {
  display: grid;
  gap: 10px;
  min-height: 180px;
}

@media (max-width: 720px) {
  .filter-bar :deep(.el-select),
  .keyword-input {
    width: 100%;
  }
}
</style>
