<template>
  <div class="page-container">
    <el-card shadow="never" class="page-card" v-loading="loading">
      <template #header>
        <div class="card-header"><span class="card-title">个人统计</span></div>
      </template>
      <el-row :gutter="20">
        <el-col :span="span" v-for="item in cards" :key="item.key">
          <el-card shadow="never" class="stat-card">
            <div class="stat-value" :style="{ color: item.color }">
              {{ stats[item.key] ?? 0 }}{{ item.suffix || '' }}
            </div>
            <div class="stat-label">{{ item.label }}</div>
            <div class="stat-icon-bg" :style="{ background: item.color }"></div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 月度积分统计表 -->
      <div v-if="stats.monthly_stats && stats.monthly_stats.length > 0" style="margin-top:24px;">
        <h4 style="margin:0 0 12px;font-size:14px;font-weight:600;">月度积分统计 ({{ new Date().getFullYear() }})</h4>
        <el-table :data="stats.monthly_stats" stripe size="small" style="width:100%;">
          <el-table-column prop="month" label="月份" width="70" align="center" />
          <el-table-column prop="score" label="分值" min-width="80" align="center">
            <template #default="{ row }">
              <span :style="{ fontWeight: row.score > 0 ? 600 : 400, color: row.score > 0 ? '#722ed1' : '' }">{{ row.score }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="finished" label="完成" min-width="70" align="center">
            <template #default="{ row }">
              <span style="color:#67c23a;">{{ row.finished }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="total" label="总接单" min-width="70" align="center">
            <template #default="{ row }">{{ row.total }}</template>
          </el-table-column>
          <el-table-column label="完成率" min-width="100" align="center">
            <template #default="{ row }">
              <template v-if="row.rate !== null && row.rate !== undefined">
                <div style="display:flex;justify-content:center;">
                  <el-progress
                    :percentage="row.rate"
                    :stroke-width="6"
                    :color="row.rate >= 80 ? '#67c23a' : row.rate >= 60 ? '#e6a23c' : '#f56c6c'"
                    style="width:100px;"
                  />
                </div>
              </template>
              <span v-else style="color:var(--dd-text-muted);">-</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div v-if="showProjectMonthly && projectMonthlyRows.length > 0" style="margin-top:24px;">
        <h4 style="margin:0 0 12px;font-size:14px;font-weight:600;">月度项目类型完成统计 ({{ new Date().getFullYear() }})</h4>
        <el-table :data="projectMonthlyRows" stripe size="small" style="width:100%;">
          <el-table-column prop="project_name" label="工作项目类型" fixed="left" min-width="140" />
          <el-table-column
            v-for="month in projectMonths"
            :key="month.key"
            :prop="month.key"
            :label="month.label"
            width="86"
            align="center"
          />
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getMyStatsApi } from '@/api'

const props = defineProps({
  cards: { type: Array, required: true },
  showProjectMonthly: { type: Boolean, default: false }
})

const stats = ref({})
const loading = ref(false)

// 8 张卡片用 3 列（24/3=8），5 张用 4 列（24/5≈5 取 4）
const span = computed(() => props.cards.length > 5 ? 3 : Math.floor(24 / props.cards.length))
const projectMonths = Array.from({ length: 12 }, (_, index) => ({
  key: `m${index + 1}`,
  label: `${index + 1}月`,
  month: index + 1
}))
const projectMonthlyRows = computed(() => (stats.value.project_stats || []).map(project => {
  const row = { project_name: project.project_name }
  for (const month of projectMonths) {
    const value = project.monthly_counts?.find(item => Number(item.month) === month.month)?.count
    row[month.key] = Number(value || 0)
  }
  return row
}))

async function loadStats() {
  loading.value = true
  try {
    const res = await getMyStatsApi()
    if (res.code === 0) stats.value = res.data
  } catch (e) {
    console.warn('[Stats] 加载失败')
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
</style>
