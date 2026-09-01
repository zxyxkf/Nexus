<template>
  <main class="manager-review-page">
    <header class="page-header">
      <div>
        <h1>店长审核</h1>
        <span class="record-count">{{ total }} 条待审核</span>
      </div>
    </header>

    <section class="filter-bar" aria-label="店长审核筛选">
      <el-input
        v-model="filters.keyword"
        clearable
        class="keyword-input"
        placeholder="搜索货号、产品 ID、申请人、来源任务"
        @clear="applyFilters"
        @keyup.enter="applyFilters"
      >
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select
        v-if="canViewAllStores"
        v-model="filters.store"
        clearable
        placeholder="全部店铺"
        @change="applyFilters"
      >
        <el-option v-for="store in storeOptions" :key="store" :label="store" :value="store" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="applyFilters">查询</el-button>
      <el-tooltip content="重置筛选" placement="top">
        <el-button circle :icon="Refresh" aria-label="重置筛选" @click="resetFilters" />
      </el-tooltip>
    </section>

    <section class="record-list" v-loading="loading">
      <ProductRowCard
        v-for="review in reviews"
        :key="review.id"
        :record="review.record"
      >
        <template #actions>
          <el-button type="primary" plain :icon="View" @click="viewRecord(review)">查看记录</el-button>
          <el-button type="success" plain :icon="Check" @click="openApprove(review)">通过</el-button>
          <el-button type="danger" plain :icon="Close" @click="rejectReview(review)">拒绝</el-button>
        </template>
      </ProductRowCard>
      <el-empty v-if="!loading && reviews.length === 0" description="暂无待审核记录" />
    </section>

    <Pagination
      v-if="total > 0"
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[10, 20, 50]"
      @current-change="loadReviews"
      @size-change="handlePageSizeChange"
    />

    <el-dialog
      v-model="detailVisible"
      title="待审核记录"
      width="min(920px, 94vw)"
      align-center
      append-to-body
      destroy-on-close
      class="manager-review-detail-dialog"
    >
      <div v-loading="detailLoading" class="detail-scroll">
        <template v-if="detailRecord">
          <div class="detail-title-row">
            <div>
              <strong>{{ detailRecord.styleNumber || '未填写货号' }}</strong>
              <span>#{{ String(detailRecord.storeSeq || 0).padStart(3, '0') }}</span>
            </div>
            <el-tag type="danger" effect="light">第二阶段 · 待店长审核</el-tag>
          </div>

          <div class="detail-meta">
            <span>店铺 {{ detailRecord.store || '-' }}</span>
            <span>策划人 {{ detailRecord.plannerName || '-' }}</span>
            <span>产品 ID {{ detailRecord.productId || '-' }}</span>
            <span>来源任务 {{ detailRecord.sourceTaskNo || '-' }}</span>
          </div>

          <div class="timeline-band">
            <StageTimeline
              :stages="detailRecord.stages"
              :current-stage="detailRecord.currentStage"
              :end-stage="detailRecord.endStage"
              :link-status="detailRecord.linkStatus"
              readonly
            />
          </div>

          <section class="detail-section">
            <h3>信息及选品</h3>
            <div class="detail-grid">
              <div><label>选品时间</label><span>{{ detailRecord.selectionDate || '-' }}</span></div>
              <div><label>货号</label><span>{{ detailRecord.styleNumber || '-' }}</span></div>
              <div><label>成本</label><span>{{ detailRecord.cost ?? '-' }}</span></div>
              <div><label>售价</label><span>{{ detailRecord.salePrice ?? '-' }}</span></div>
              <div><label>上架时间</label><span>{{ detailRecord.listingDate || '-' }}</span></div>
              <div><label>上架类目</label><span>{{ detailRecord.listingCategory || '-' }}</span></div>
              <div class="full-width"><label>选品方式</label><span>{{ detailRecord.selectionMethod || '-' }}</span></div>
              <div class="full-width"><label>说明</label><span class="multiline">{{ detailRecord.detailText || '-' }}</span></div>
            </div>
          </section>

          <template v-for="group in selectionImageGroups" :key="group.category">
            <section v-if="group.images.length" class="detail-section">
              <h3>{{ group.label }}</h3>
              <div class="image-grid">
                <el-image
                  v-for="(image, index) in group.images"
                  :key="image.id"
                  :src="group.urls[index]"
                  :preview-src-list="group.urls"
                  :initial-index="index"
                  fit="cover"
                  preview-teleported
                />
              </div>
            </section>
          </template>
        </template>
      </div>
    </el-dialog>

    <el-dialog
      v-model="approveVisible"
      title="确认开启付费"
      width="420px"
      align-center
      append-to-body
      :close-on-click-modal="false"
    >
      <el-form label-position="top">
        <el-form-item label="付费时间" required>
          <el-date-picker
            v-model="paidAt"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="请选择付费时间"
            style="width:100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveVisible = false">取消</el-button>
        <el-button type="success" :loading="decisionLoading" @click="approveReview">确认通过</el-button>
      </template>
    </el-dialog>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Check, Close, Refresh, Search, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  approvePaymentManagerReviewApi,
  getPaymentImageUrl,
  getPaymentManagerReviewApi,
  listPaymentManagerReviewsApi,
  rejectPaymentManagerReviewApi
} from '@/api'
import Pagination from '@/components/Pagination.vue'
import ProductRowCard from '@/components/payment-tracking/ProductRowCard.vue'
import StageTimeline from '@/components/payment-tracking/StageTimeline.vue'
import { getUser } from '@/utils/auth'

const user = getUser()
const canViewAllStores = computed(() => (
  user?.role === 'admin'
  || user?.role === 'sub_admin'
  || user?.permissions?.includes('*')
  || user?.permissions?.includes('payment.manage.all')
))
const loading = ref(false)
const detailLoading = ref(false)
const decisionLoading = ref(false)
const reviews = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const filters = reactive({ keyword: '', store: '' })
const knownStores = ref(new Set())
const detailVisible = ref(false)
const detailRecord = ref(null)
const approveVisible = ref(false)
const paidAt = ref('')
const decisionTarget = ref(null)

const storeOptions = computed(() => [...knownStores.value].sort((a, b) => a.localeCompare(b, 'zh-CN')))
const selectionImageGroups = computed(() => [
  { category: 'product_main', label: '产品主图' },
  { category: 'detail_screenshot', label: '说明截图' },
  { category: 'competitor', label: '竞品主图' }
].map(group => {
  const images = (detailRecord.value?.images || []).filter(image => image.category === group.category)
  return { ...group, images, urls: images.map(getPaymentImageUrl) }
}))

async function loadReviews() {
  loading.value = true
  try {
    const response = await listPaymentManagerReviewsApi({
      keyword: filters.keyword || undefined,
      store: canViewAllStores.value ? (filters.store || undefined) : undefined,
      page: page.value,
      pageSize: pageSize.value
    })
    reviews.value = response.data?.list || []
    total.value = Number(response.data?.total || 0)
    const nextStores = new Set(knownStores.value)
    reviews.value.forEach(item => { if (item.store) nextStores.add(item.store) })
    knownStores.value = nextStores
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  loadReviews()
}

function resetFilters() {
  Object.assign(filters, { keyword: '', store: '' })
  applyFilters()
}

function handlePageSizeChange() {
  page.value = 1
  loadReviews()
}

async function viewRecord(row) {
  detailVisible.value = true
  detailLoading.value = true
  detailRecord.value = null
  try {
    const response = await getPaymentManagerReviewApi(row.id)
    if (response.code === 0) detailRecord.value = response.data?.record || null
    else if (response.code === 404 || response.code === 409) await loadReviews()
  } finally {
    detailLoading.value = false
  }
}

function openApprove(row) {
  decisionTarget.value = row
  paidAt.value = ''
  approveVisible.value = true
}

async function approveReview() {
  if (!paidAt.value) {
    ElMessage.warning('请选择付费时间')
    return
  }
  decisionLoading.value = true
  try {
    const target = decisionTarget.value
    const response = await approvePaymentManagerReviewApi(target.id, {
      requestVersion: target.requestVersion,
      paidAt: paidAt.value
    })
    if (response.code === 0) {
      approveVisible.value = false
      ElMessage.success('审核已通过')
      await loadReviews()
    } else if (response.code === 409) {
      approveVisible.value = false
      await loadReviews()
    }
  } finally {
    decisionLoading.value = false
  }
}

async function rejectReview(row) {
  try {
    await ElMessageBox.confirm(
      `确认拒绝货号“${row.styleNumber || '未填写'}”的付费申请？拒绝后流程将结束。`,
      '拒绝确认',
      { confirmButtonText: '确认拒绝', type: 'warning' }
    )
    decisionLoading.value = true
    const response = await rejectPaymentManagerReviewApi(row.id, {
      requestVersion: row.requestVersion
    })
    if (response.code === 0) {
      ElMessage.success('已拒绝，流程已结束')
      await loadReviews()
    } else if (response.code === 409) {
      await loadReviews()
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close' && Number(error?.code) === 409) await loadReviews()
  } finally {
    decisionLoading.value = false
  }
}

onMounted(loadReviews)
</script>

<style scoped>
.manager-review-page {
  min-width: 0;
}

.page-header {
  display: flex;
  align-items: center;
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
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px 0;
  border-top: 1px solid var(--dd-border-light, #e4e7ed);
  border-bottom: 1px solid var(--dd-border-light, #e4e7ed);
}

.keyword-input {
  width: min(340px, 100%);
}

.filter-bar :deep(.el-select) {
  width: 150px;
}

.record-list {
  display: grid;
  gap: 10px;
  min-height: 180px;
}

.detail-scroll {
  max-height: min(70vh, 720px);
  min-height: 160px;
  overflow-y: auto;
  padding: 0 4px 6px 0;
}

.detail-title-row,
.detail-title-row > div,
.detail-meta {
  display: flex;
  align-items: center;
}

.detail-title-row {
  justify-content: space-between;
  gap: 16px;
}

.detail-title-row > div {
  gap: 10px;
}

.detail-title-row strong {
  font-size: 20px;
}

.detail-title-row span,
.detail-meta {
  color: var(--dd-text-secondary, #909399);
  font-size: 12px;
}

.detail-meta {
  flex-wrap: wrap;
  gap: 6px 16px;
  margin-top: 8px;
}

.timeline-band {
  margin: 18px 0;
  padding: 13px 0;
  border-top: 1px solid var(--dd-border-light, #e4e7ed);
  border-bottom: 1px solid var(--dd-border-light, #e4e7ed);
  overflow-x: auto;
}

.detail-section + .detail-section {
  margin-top: 22px;
}

.detail-section h3 {
  margin: 0 0 12px;
  font-size: 15px;
}

.detail-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid var(--dd-border-light, #e4e7ed);
  border-left: 1px solid var(--dd-border-light, #e4e7ed);
}

.detail-grid > div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  min-height: 42px;
  border-right: 1px solid var(--dd-border-light, #e4e7ed);
  border-bottom: 1px solid var(--dd-border-light, #e4e7ed);
}

.detail-grid label,
.detail-grid span {
  padding: 10px 12px;
  overflow-wrap: anywhere;
}

.detail-grid label {
  background: #f7f8fa;
  color: var(--dd-text-secondary, #909399);
  font-size: 12px;
}

.detail-grid span {
  color: var(--dd-text-regular, #606266);
  font-size: 13px;
}

.detail-grid .full-width {
  grid-column: 1 / -1;
}

.multiline {
  white-space: pre-wrap;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}

.image-grid :deep(.el-image) {
  width: 100%;
  aspect-ratio: 1;
  border: 1px solid var(--dd-border-light, #e4e7ed);
  border-radius: 6px;
  cursor: zoom-in;
}

@media (max-width: 720px) {
  .filter-bar :deep(.el-select),
  .keyword-input {
    width: 100%;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .detail-grid .full-width {
    grid-column: auto;
  }
}
</style>
