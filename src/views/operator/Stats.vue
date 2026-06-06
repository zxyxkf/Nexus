<template>
  <div class="page-container">
    <!-- ==================== 个人美工任务统计 ==================== -->
    <el-card shadow="never" class="page-card" v-loading="loading">
      <template #header>
        <div class="card-header"><span class="card-title">个人美工任务统计</span></div>
      </template>

      <el-row :gutter="20">
        <el-col :span="6" v-for="item in designCards" :key="item.key">
          <el-card shadow="never" class="stat-card">
            <div class="stat-value" :style="{ color: item.color }">{{ designStats[item.key] ?? 0 }}</div>
            <div class="stat-label">{{ item.label }}</div>
            <div class="stat-icon-bg" :style="{ background: item.color }"></div>
          </el-card>
        </el-col>
      </el-row>

      <div v-if="designMonthly.length > 0" style="margin-top:24px;">
        <h4 style="margin:0 0 12px;font-size:14px;font-weight:600;">月度美工任务统计 ({{ currentYear }})</h4>
        <el-table :data="designMonthly" stripe size="small" style="width:100%;" :max-height="400" empty-text="暂无数据">
          <el-table-column prop="name" label="美工" width="90" fixed="left" />
          <el-table-column v-for="m in 12" :key="'dm'+m" :label="m+'月'" :width="m <= 6 ? 100 : 100" align="center">
            <template #default="{ row }">
              <div class="month-cell">
                <div class="mc-row"><span class="mc-dot pub"></span>发 {{ row.months[m-1].published }}</div>
                <div class="mc-row"><span class="mc-dot fin"></span>完 {{ row.months[m-1].finished }}</div>
                <div class="mc-row"><span class="mc-dot uns"></span>未 {{ row.months[m-1].unsubmitted }}</div>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <el-empty v-else description="暂无美工任务数据" :image-size="80" style="margin-top:24px;" />
    </el-card>

    <!-- ==================== 个人运营任务统计 ==================== -->
    <el-card shadow="never" class="page-card" v-loading="loading" style="margin-top:16px;">
      <template #header>
        <div class="card-header"><span class="card-title">个人运营任务统计</span></div>
      </template>

      <el-row :gutter="20">
        <el-col :span="6" v-for="item in operatorCards" :key="item.key">
          <el-card shadow="never" class="stat-card">
            <div class="stat-value" :style="{ color: item.color }">{{ operatorStats[item.key] ?? 0 }}</div>
            <div class="stat-label">{{ item.label }}</div>
            <div class="stat-icon-bg" :style="{ background: item.color }"></div>
          </el-card>
        </el-col>
      </el-row>

      <div v-if="operatorMonthly.length > 0" style="margin-top:24px;">
        <h4 style="margin:0 0 12px;font-size:14px;font-weight:600;">月度运营任务统计 ({{ currentYear }})</h4>
        <el-table :data="operatorMonthly" stripe size="small" style="width:100%;" :max-height="400" empty-text="暂无数据">
          <el-table-column prop="name" label="运营助理" width="90" fixed="left" />
          <el-table-column v-for="m in 12" :key="'om'+m" :label="m+'月'" :width="m <= 6 ? 100 : 100" align="center">
            <template #default="{ row }">
              <div class="month-cell">
                <div class="mc-row"><span class="mc-dot pub"></span>发 {{ row.months[m-1].published }}</div>
                <div class="mc-row"><span class="mc-dot fin"></span>完 {{ row.months[m-1].finished }}</div>
                <div class="mc-row"><span class="mc-dot uns"></span>未 {{ row.months[m-1].unsubmitted }}</div>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
      <el-empty v-else description="暂无运营任务数据" :image-size="80" style="margin-top:24px;" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getMyStatsApi } from '@/api'

const loading = ref(false)
const stats = ref({})
const currentYear = new Date().getFullYear()

const designStats = computed(() => stats.value.design_stats || {})
const operatorStats = computed(() => stats.value.operator_stats || {})
const designMonthly = computed(() => stats.value.design_monthly || [])
const operatorMonthly = computed(() => stats.value.operator_monthly || [])

const designCards = [
  { key: 'total', label: '总发布量', color: '#409eff' },
  { key: 'finished_count', label: '已完成', color: '#67c23a' },
  { key: 'wait_count', label: '待接单', color: '#909399' },
  { key: 'rejected_count', label: '已驳回', color: '#f56c6c' }
]

const operatorCards = [
  { key: 'total', label: '总发布量', color: '#409eff' },
  { key: 'finished_count', label: '已完成', color: '#67c23a' },
  { key: 'wait_count', label: '待接单', color: '#909399' },
  { key: 'rejected_count', label: '已驳回', color: '#f56c6c' }
]

async function loadStats() {
  loading.value = true
  try {
    const res = await getMyStatsApi()
    if (res.code === 0) stats.value = res.data
  } catch (e) {
    console.error('[Stats] 加载统计失败:', e)
  } finally { loading.value = false }
}

onMounted(() => loadStats())
</script>

<style scoped>
.stat-card { text-align: center; border-radius: var(--dd-radius-lg) !important; transition: all var(--dd-transition-normal); cursor: default; position: relative; overflow: hidden; }
.stat-card:hover { transform: translateY(-3px); box-shadow: var(--dd-shadow-lg) !important; }
.stat-value { font-size: 36px; font-weight: 800; line-height: 1.2; }
.stat-label { font-size: 14px; color: var(--dd-text-muted); margin-top: 8px; font-weight: 500; }
.stat-icon-bg { position: absolute; bottom: -15px; right: -15px; width: 60px; height: 60px; border-radius: 50%; opacity: 0.08; }

.month-cell { font-size: 12px; line-height: 1.6; }
.mc-row { display: flex; align-items: center; gap: 2px; white-space: nowrap; }
.mc-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.mc-dot.pub { background: #409eff; }
.mc-dot.fin { background: #67c23a; }
.mc-dot.uns { background: #e6a23c; }
</style>
