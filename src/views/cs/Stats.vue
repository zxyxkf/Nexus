<template>
  <div class="page-container">
    <!-- ==================== 个人客服任务统计 ==================== -->
    <el-card shadow="never" class="page-card" v-loading="loading">
      <template #header>
        <div class="card-header"><span class="card-title">个人客服任务统计</span></div>
      </template>

      <el-row :gutter="20">
        <el-col :span="6" v-for="item in summaryCards" :key="item.key">
          <el-card shadow="never" class="stat-card">
            <div class="stat-value" :style="{ color: item.color }">{{ stats[item.key] ?? 0 }}</div>
            <div class="stat-label">{{ item.label }}</div>
            <div class="stat-icon-bg" :style="{ background: item.color }"></div>
          </el-card>
        </el-col>
      </el-row>

      <div v-if="selfMonthly.length > 0" style="margin-top:24px;">
        <h4 style="margin:0 0 12px;font-size:14px;font-weight:600;">个人发布任务月度统计 ({{ currentYear }})</h4>
        <div style="overflow-x:auto;">
          <table class="self-monthly-table">
            <thead>
              <tr>
                <th>指标</th>
                <th v-for="item in selfMonthly" :key="item.month">{{ item.month }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>发布量</td>
                <td v-for="item in selfMonthly" :key="'t'+item.month">{{ item.total }}</td>
              </tr>
              <tr>
                <td>已完成</td>
                <td v-for="item in selfMonthly" :key="'f'+item.month">{{ item.finished }}</td>
              </tr>
              <tr>
                <td>未完成</td>
                <td v-for="item in selfMonthly" :key="'u'+item.month">{{ item.unfinished }}</td>
              </tr>
              <tr>
                <td>待接单</td>
                <td v-for="item in selfMonthly" :key="'w'+item.month">{{ item.wait }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </el-card>

    <!-- ==================== 基础美工月度统计 ==================== -->
    <el-card shadow="never" class="page-card" v-loading="loading" style="margin-top:16px;">
      <template #header>
        <div class="card-header"><span class="card-title">基础美工月度任务统计</span></div>
      </template>

      <div v-if="csMonthly.length > 0">
        <el-table :data="csMonthly" stripe size="small" style="width:100%;" :max-height="400" empty-text="暂无数据">
          <el-table-column prop="name" label="基础美工" width="90" fixed="left" />
          <el-table-column v-for="m in 12" :key="'cm'+m" :label="m+'月'" :width="100" align="center">
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
      <el-empty v-else description="暂无基础美工任务数据" :image-size="80" style="margin-top:24px;" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { getMyStatsApi } from '@/api'

const loading = ref(false)
const stats = ref({})
const currentYear = new Date().getFullYear()

const summaryCards = [
  { key: 'total', label: '总发布量', color: '#409eff' },
  { key: 'finished_count', label: '已完成', color: '#67c23a' },
  { key: 'unfinished_count', label: '未完成', color: '#e6a23c' },
  { key: 'rejected_count', label: '已驳回', color: '#f56c6c' }
]

const selfMonthly = ref([])
const csMonthly = ref([])

async function loadStats() {
  loading.value = true
  try {
    const res = await getMyStatsApi()
    if (res.code === 0) {
      stats.value = res.data
      selfMonthly.value = res.data.self_monthly || []
      csMonthly.value = res.data.cs_monthly || []
    }
  } catch (e) {
    console.error('[CS Stats] 加载统计失败:', e)
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

.month-cell-short { font-size: 13px; font-weight: 600; }

.self-monthly-table { width:100%; border-collapse:collapse; font-size:12px; }
.self-monthly-table th, .self-monthly-table td {
  border: 1px solid var(--dd-border-light, #e4e7ed);
  padding: 8px 12px;
  text-align: center;
  white-space: nowrap;
}
.self-monthly-table thead th {
  background: var(--dd-bg-secondary, #f5f7fa);
  font-weight: 600;
  color: var(--dd-text-primary);
}
.self-monthly-table thead th:first-child { min-width:70px; }
.self-monthly-table tbody td:first-child {
  font-weight: 500;
  color: var(--dd-text-secondary);
  background: var(--dd-bg-secondary, #f5f7fa);
}
.self-monthly-table tbody tr:hover td { background: var(--dd-primary-lighter, rgba(67,97,238,0.05)); }
.self-monthly-table tbody tr:hover td:first-child { background: var(--dd-bg-secondary, #f5f7fa); }
</style>
