<template>
  <div class="page-container" v-loading="loading">
    <div class="dashboard-actions">
      <el-button @click="exportDashboardReport">导出仪表盘</el-button>
    </div>
    <!-- ==================== 运营 & 美工设计师 ==================== -->
    <el-card v-if="showDesignSection" shadow="never" class="page-card section-blue">
      <template #header>
        <div class="card-header"><span class="card-title section-title-red">运营 & 美工设计师</span></div>
      </template>

      <!-- 统计卡片 -->
      <el-row :gutter="20">
        <el-col :xs="12" :sm="8" :md="4" v-for="item in statCards" :key="item.key">
          <el-card shadow="never" class="stat-card">
            <div class="stat-value" :style="{ color: item.color }">{{ designStats[item.key] ?? 0 }}</div>
            <div class="stat-label">{{ item.label }}</div>
            <div class="stat-icon-bg" :style="{ background: item.color }"></div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 美工本月积分排行 -->
      <el-row :gutter="20" class="chart-row">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">美工本月积分排行</span></div>
            </template>
            <div ref="designerCurrentMonthRef" style="height:300px;"></div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 美工上月积分排行 -->
      <el-row :gutter="20" class="chart-row">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">美工上月积分排行</span></div>
            </template>
            <div ref="designerLastMonthRef" style="height:300px;"></div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 美工完成效率排行 -->
      <el-row :gutter="20" class="chart-row">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">美工完成效率排行</span></div>
            </template>
            <div ref="designerChartRef" style="height:300px;"></div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 美工综合统计表 -->
      <el-row :gutter="20" class="chart-row" v-if="detailStats.designerStats?.length">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">美工综合统计 ({{ new Date().getFullYear() }})</span></div>
            </template>
            <el-table :data="detailStats.designerStats" stripe size="small" style="width:100%;" :default-sort="{ prop: 'total_score', order: 'descending' }">
              <el-table-column prop="name" label="美工" sortable />
              <el-table-column prop="total_score" label="总积分" sortable />
              <el-table-column prop="current_month_score" label="当月积分" sortable />
              <el-table-column prop="today_score" label="今日积分" sortable />
              <el-table-column prop="yesterday_score" label="昨日积分" sortable />
              <el-table-column prop="finished_count" label="已完成" sortable />
              <el-table-column prop="total_count" label="总任务" sortable />
              <el-table-column label="完成率" sortable prop="completion_rate" align="center">
                <template #default="{ row }">
                  <div style="display:flex;justify-content:center;">
                    <el-progress :percentage="row.completion_rate" :stroke-width="6" :color="row.completion_rate >= 80 ? '#67c23a' : row.completion_rate >= 60 ? '#e6a23c' : '#f56c6c'" style="width:100px;" />
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <!-- 美工月度积分明细 -->
      <el-row :gutter="20" class="chart-row" v-if="monthlyFlatData.length > 0">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">美工月度积分明细 ({{ new Date().getFullYear() }})</span></div>
            </template>
            <el-table :data="monthlyFlatData" stripe size="small" style="width:100%;">
              <el-table-column prop="designer_name" label="美工" fixed="left" min-width="80" />
              <el-table-column v-for="m in months" :key="m" :prop="m" :label="m" sortable align="center" />
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <!-- 美工日统计 -->
      <el-row :gutter="20" class="chart-row" v-if="designerDailyData.length > 0">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">美工日统计 ({{ currentMonthTitle }}，完成 / 待审核)</span></div>
            </template>
            <el-table :data="designerDailyData" stripe size="small" class="dashboard-wide-table" style="width:100%;">
              <el-table-column prop="name" label="美工" fixed="left" min-width="90" />
              <el-table-column v-for="d in monthDays" :key="d.key" :prop="d.key" :label="d.label" width="92" align="center">
                <template #default="{ row }">
                  <div class="daily-score-cell">
                    <el-button link type="primary" @click="openDailyTasks('design', d.day, row, 'finished')">{{ row[`${d.key}_finished`] }}</el-button>
                    <span>/</span>
                    <el-button link type="warning" @click="openDailyTasks('design', d.day, row, 'doing')">{{ row[`${d.key}_pending`] }}</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <!-- 项目类型完成统计 -->
      <el-row :gutter="20" class="chart-row" v-if="projectFlatData.length > 0">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">项目类型完成统计</span></div>
            </template>
            <el-table :data="projectFlatData" stripe size="small" class="dashboard-wide-table" style="width:100%;">
              <el-table-column prop="designer_name" label="美工" fixed="left" min-width="80" />
              <el-table-column v-for="p in allProjectNames" :key="p" :prop="p" :label="p" width="150" sortable align="center" show-overflow-tooltip />
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <!-- 运营发布统计（按月） -->
      <el-row :gutter="20" class="chart-row" v-if="operatorMonthlyData.length > 0">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">运营发布统计 ({{ new Date().getFullYear() }})</span></div>
            </template>
            <el-table :data="operatorMonthlyData" stripe size="small" style="width:100%;">
              <el-table-column prop="operator_name" label="运营" fixed="left" min-width="80" />
              <el-table-column v-for="m in months" :key="m" :prop="m" :label="m" sortable align="center" />
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <!-- ==================== 运营 & 运营助理 ==================== -->
    <el-card v-if="showOperatorSection" shadow="never" class="page-card section-purple" style="margin-top:16px;">
      <template #header>
        <div class="card-header"><span class="card-title section-title-purple">运营 & 运营助理</span></div>
      </template>

      <!-- 统计卡片 -->
      <el-row :gutter="20">
        <el-col :xs="12" :sm="8" :md="4" v-for="item in operatorStatCards" :key="item.key">
          <el-card shadow="never" class="stat-card">
            <div class="stat-value" :style="{ color: item.color }">{{ operatorStats[item.key] ?? 0 }}</div>
            <div class="stat-label">{{ item.label }}</div>
            <div class="stat-icon-bg" :style="{ background: item.color }"></div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 运营助理本月积分排行 -->
      <el-row :gutter="20" class="chart-row">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">运营助理本月积分排行</span></div>
            </template>
            <div ref="opAssistantCurrentMonthRef" style="height:300px;"></div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 运营助理上月积分排行 -->
      <el-row :gutter="20" class="chart-row">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">运营助理上月积分排行</span></div>
            </template>
            <div ref="opAssistantLastMonthRef" style="height:300px;"></div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 助理综合统计 -->
      <el-row :gutter="20" class="chart-row" v-if="detailStats.operatorAssistantStats?.length">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">助理综合统计 ({{ new Date().getFullYear() }})</span></div>
            </template>
            <el-table :data="detailStats.operatorAssistantStats" stripe size="small" style="width:100%;" :default-sort="{ prop: 'total_score', order: 'descending' }">
              <el-table-column prop="name" label="助理" sortable />
              <el-table-column prop="total_score" label="总积分" sortable />
              <el-table-column prop="current_month_score" label="当月积分" sortable />
              <el-table-column prop="today_score" label="今日积分" sortable />
              <el-table-column prop="yesterday_score" label="昨日积分" sortable />
              <el-table-column prop="finished_count" label="已完成" sortable />
              <el-table-column prop="total_count" label="总任务" sortable />
              <el-table-column label="完成率" sortable prop="completion_rate" align="center">
                <template #default="{ row }">
                  <div style="display:flex;justify-content:center;">
                    <el-progress :percentage="row.completion_rate" :stroke-width="6" :color="row.completion_rate >= 80 ? '#67c23a' : row.completion_rate >= 60 ? '#e6a23c' : '#f56c6c'" style="width:100px;" />
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <!-- 运营助理月度积分明细 -->
      <el-row :gutter="20" class="chart-row" v-if="operatorAssistantMonthlyData.length > 0">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">运营助理月度积分明细 ({{ new Date().getFullYear() }})</span></div>
            </template>
            <el-table :data="operatorAssistantMonthlyData" stripe size="small" style="width:100%;">
              <el-table-column prop="assistant_name" label="助理" fixed="left" min-width="80" />
              <el-table-column v-for="m in months" :key="m" :prop="m" :label="m" sortable align="center" />
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <!-- 运营助理日统计 -->
      <el-row :gutter="20" class="chart-row" v-if="operatorAssistantDailyData.length > 0">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">运营助理日统计 ({{ currentMonthTitle }}，完成 / 待审核)</span></div>
            </template>
            <el-table :data="operatorAssistantDailyData" stripe size="small" class="dashboard-wide-table" style="width:100%;">
              <el-table-column prop="name" label="助理" fixed="left" min-width="90" />
              <el-table-column v-for="d in monthDays" :key="d.key" :prop="d.key" :label="d.label" width="92" align="center">
                <template #default="{ row }">
                  <div class="daily-score-cell">
                    <el-button link type="primary" @click="openDailyTasks('operator', d.day, row, 'finished')">{{ row[`${d.key}_finished`] }}</el-button>
                    <span>/</span>
                    <el-button link type="warning" @click="openDailyTasks('operator', d.day, row, 'doing')">{{ row[`${d.key}_pending`] }}</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <!-- 运营发布统计 -->
      <el-row :gutter="20" class="chart-row" v-if="operatorPublishData.length > 0">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">运营发布统计 ({{ new Date().getFullYear() }})</span></div>
            </template>
            <el-table :data="operatorPublishData" stripe size="small" style="width:100%;">
              <el-table-column prop="operator_name" label="运营" fixed="left" min-width="80" />
              <el-table-column v-for="m in months" :key="m" :prop="m" :label="m" sortable align="center" />
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <!-- ==================== 客服 & 基础美工 ==================== -->
    <el-card v-if="showCsSection" shadow="never" class="page-card section-rose" style="margin-top:16px;">
      <template #header>
        <div class="card-header"><span class="card-title section-title-red">客服 & 基础美工</span></div>
      </template>

      <!-- 统计卡片 -->
      <el-row :gutter="20">
        <el-col :xs="12" :sm="8" :md="4" v-for="item in statCards" :key="item.key">
          <el-card shadow="never" class="stat-card">
            <div class="stat-value" :style="{ color: item.color }">{{ csStats[item.key] ?? 0 }}</div>
            <div class="stat-label">{{ item.label }}</div>
            <div class="stat-icon-bg" :style="{ background: item.color }"></div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 基础美工本月积分排行 -->
      <el-row :gutter="20" class="chart-row">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">基础美工本月积分排行</span></div>
            </template>
            <div ref="basicCurrentMonthRef" style="height:300px;"></div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 基础美工上月积分排行 -->
      <el-row :gutter="20" class="chart-row">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">基础美工上月积分排行</span></div>
            </template>
            <div ref="basicLastMonthRef" style="height:300px;"></div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 基础美工综合统计表 -->
      <el-row :gutter="20" class="chart-row" v-if="detailStats.basicDesignerStats?.length">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">基础美工综合统计 ({{ new Date().getFullYear() }})</span></div>
            </template>
            <el-table :data="detailStats.basicDesignerStats" stripe size="small" style="width:100%;" :default-sort="{ prop: 'total_score', order: 'descending' }">
              <el-table-column prop="name" label="基础美工" sortable />
              <el-table-column prop="total_score" label="总积分" sortable />
              <el-table-column prop="current_month_score" label="当月积分" sortable />
              <el-table-column prop="today_score" label="今日积分" sortable />
              <el-table-column prop="yesterday_score" label="昨日积分" sortable />
              <el-table-column prop="finished_count" label="已完成" sortable />
              <el-table-column prop="total_count" label="总任务" sortable />
              <el-table-column label="完成率" sortable prop="completion_rate" align="center">
                <template #default="{ row }">
                  <div style="display:flex;justify-content:center;">
                    <el-progress :percentage="row.completion_rate" :stroke-width="6" :color="row.completion_rate >= 80 ? '#67c23a' : row.completion_rate >= 60 ? '#e6a23c' : '#f56c6c'" style="width:100px;" />
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <!-- 基础美工日统计 -->
      <el-row :gutter="20" class="chart-row" v-if="basicDesignerDailyData.length > 0">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">基础美工日统计 ({{ currentMonthTitle }}，完成 / 待审核)</span></div>
            </template>
            <el-table :data="basicDesignerDailyData" stripe size="small" class="dashboard-wide-table" style="width:100%;">
              <el-table-column prop="name" label="基础美工" fixed="left" min-width="90" />
              <el-table-column v-for="d in monthDays" :key="d.key" :prop="d.key" :label="d.label" width="92" align="center">
                <template #default="{ row }">
                  <div class="daily-score-cell">
                    <el-button link type="primary" @click="openDailyTasks('cs', d.day, row, 'finished')">{{ row[`${d.key}_finished`] }}</el-button>
                    <span>/</span>
                    <el-button link type="warning" @click="openDailyTasks('cs', d.day, row, 'doing')">{{ row[`${d.key}_pending`] }}</el-button>
                  </div>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <!-- 客服发布统计（按月） -->
      <el-row :gutter="20" class="chart-row" v-if="csMonthlyData.length > 0">
        <el-col :span="24">
          <el-card shadow="never" class="chart-card">
            <template #header>
              <div class="card-header"><span class="card-title">客服发布统计 ({{ new Date().getFullYear() }})</span></div>
            </template>
            <el-table :data="csMonthlyData" stripe size="small" style="width:100%;">
              <el-table-column prop="agent_name" label="客服" fixed="left" min-width="80" />
              <el-table-column v-for="m in months" :key="m" :prop="m" :label="m" sortable align="center" />
            </el-table>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import * as echarts from 'echarts/core'
import { PieChart, LineChart, BarChart } from 'echarts/charts'
import { TitleComponent, TooltipComponent, LegendComponent, GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([PieChart, LineChart, BarChart, TitleComponent, TooltipComponent, LegendComponent, GridComponent, CanvasRenderer])
import { getDashboardStatsApi, getAdminDetailStatsApi } from '@/api'
import { exportDashboardApi } from '@/api/export'
import { getUser } from '@/utils/auth'
import { hasPermission } from '@/utils/permissions'

const route = useRoute()
const router = useRouter()

const designStats = ref({})
const csStats = ref({})
const operatorStats = ref({})
const detailStats = ref({})
const loading = ref(false)
const designerCurrentMonthRef = ref(null)
const designerLastMonthRef = ref(null)
const basicCurrentMonthRef = ref(null)
const basicLastMonthRef = ref(null)
const opAssistantCurrentMonthRef = ref(null)
const opAssistantLastMonthRef = ref(null)
const designerChartRef = ref(null)

let designerCurrentMonthChart = null
let designerLastMonthChart = null
let basicCurrentMonthChart = null
let basicLastMonthChart = null
let opAssistantCurrentMonthChart = null
let opAssistantLastMonthChart = null
let designerChart = null
let refreshTimer = null

function disposeCharts() {
  ;[designerCurrentMonthChart, designerLastMonthChart, basicCurrentMonthChart, basicLastMonthChart, opAssistantCurrentMonthChart, opAssistantLastMonthChart, designerChart].forEach(chart => {
    chart?.dispose()
  })
  designerCurrentMonthChart = null
  designerLastMonthChart = null
  basicCurrentMonthChart = null
  basicLastMonthChart = null
  opAssistantCurrentMonthChart = null
  opAssistantLastMonthChart = null
  designerChart = null
}

const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const allowedGroups = computed(() => route.meta.dashboardGroups || ['design', 'operator', 'cs'])
const showDesignSection = computed(() => allowedGroups.value.includes('design'))
const showOperatorSection = computed(() => allowedGroups.value.includes('operator'))
const showCsSection = computed(() => allowedGroups.value.includes('cs'))
const nowForView = new Date()
const currentMonthTitle = `${nowForView.getFullYear()}年${nowForView.getMonth() + 1}月`
const monthDays = computed(() => {
  const count = new Date(nowForView.getFullYear(), nowForView.getMonth() + 1, 0).getDate()
  return Array.from({ length: count }, (_, i) => ({ key: `d${i + 1}`, label: `${i + 1}日` }))
})

const statCards = [
  { key: 'total', label: '任务总量', color: '#4361ee' },
  { key: 'wait_count', label: '待接单', color: '#7b8ba3' },
  { key: 'accepted_count', label: '已接单', color: '#f7931a' },
  { key: 'doing_count', label: '作图中', color: '#4361ee' },
  { key: 'finished_count', label: '已完成', color: '#2ec4b6' },
  { key: 'rejected_count', label: '已驳回', color: '#e63946' }
]

const operatorStatCards = [
  { key: 'total', label: '任务总量', color: '#7c3aed' },
  { key: 'wait_count', label: '待接单', color: '#8b5cf6' },
  { key: 'accepted_count', label: '已接单', color: '#f7931a' },
  { key: 'doing_count', label: '进行中', color: '#6366f1' },
  { key: 'finished_count', label: '已完成', color: '#10b981' }
]

// 月度明细 → 宽表
const monthlyFlatData = computed(() => {
  const rows = []
  if (!detailStats.value.designerStats) return rows
  for (const d of detailStats.value.designerStats) {
    const row = { designer_name: d.name }
    if (d.monthly_stats) {
      for (const m of d.monthly_stats) {
        row[m.month] = m.score
      }
    }
    for (const m of months) {
      if (!(m in row)) row[m] = 0
    }
    rows.push(row)
  }
  return rows
})

const allProjectNames = computed(() => {
  const names = new Set()
  if (!detailStats.value.designerStats) return []
  for (const d of detailStats.value.designerStats) {
    if (!d.project_stats) continue
    for (const p of d.project_stats) {
      if (p.project_name) names.add(p.project_name)
    }
  }
  return [...names]
})

const projectFlatData = computed(() => {
  const rows = []
  if (!detailStats.value.designerStats) return rows
  for (const d of detailStats.value.designerStats) {
    const row = { designer_name: d.name }
    if (d.project_stats) {
      for (const p of d.project_stats) {
        row[p.project_name] = p.count
      }
    }
    for (const p of allProjectNames.value) {
      if (!(p in row)) row[p] = 0
    }
    rows.push(row)
  }
  return rows
})

const operatorMonthlyData = computed(() => {
  const rows = []
  if (!detailStats.value.operatorStats) return rows
  for (const o of detailStats.value.operatorStats) {
    const row = { operator_name: o.name }
    if (o.monthly_stats) {
      for (const m of o.monthly_stats) {
        row[m.month] = m.count
      }
    }
    for (const m of months) {
      if (!(m in row)) row[m] = 0
    }
    rows.push(row)
  }
  return rows
})

const csMonthlyData = computed(() => {
  const rows = []
  if (!detailStats.value.csAgentStats) return rows
  for (const a of detailStats.value.csAgentStats) {
    const row = { agent_name: a.name }
    if (a.monthly_stats) {
      for (const m of a.monthly_stats) {
        row[m.month] = m.count
      }
    }
    for (const m of months) {
      if (!(m in row)) row[m] = 0
    }
    rows.push(row)
  }
  return rows
})

const operatorAssistantMonthlyData = computed(() => {
  const rows = []
  if (!detailStats.value.operatorAssistantStats) return rows
  for (const d of detailStats.value.operatorAssistantStats) {
    const row = { assistant_name: d.name }
    if (d.monthly_stats) {
      for (const m of d.monthly_stats) {
        row[m.month] = m.score
      }
    }
    for (const m of months) {
      if (!(m in row)) row[m] = 0
    }
    rows.push(row)
  }
  return rows
})

const operatorPublishData = computed(() => {
  const rows = []
  if (!detailStats.value.operatorPublishStats) return rows
  for (const o of detailStats.value.operatorPublishStats) {
    const row = { operator_name: o.name }
    if (o.monthly_stats) {
      for (const m of o.monthly_stats) {
        row[m.month] = m.count
      }
    }
    for (const m of months) {
      if (!(m in row)) row[m] = 0
    }
    rows.push(row)
  }
  return rows
})

function buildDailyRows(source, nameKey = 'name') {
  if (!source?.length) return []
  return source.map(item => {
    const row = { id: item.id, name: item[nameKey] || item.name }
    for (const day of monthDays.value) {
      row[day.key] = '0 / 0'
      row[`${day.key}_finished`] = 0
      row[`${day.key}_pending`] = 0
    }
    for (const stat of item.daily_stats || []) {
      const key = `d${stat.day}`
      row[key] = `${stat.finished_score || 0} / ${stat.pending_review_score || 0}`
      row[`${key}_finished`] = stat.finished_score || 0
      row[`${key}_pending`] = stat.pending_review_score || 0
    }
    return row
  })
}

const designerDailyData = computed(() => buildDailyRows(detailStats.value.designerDailyStats))
const operatorAssistantDailyData = computed(() => buildDailyRows(detailStats.value.operatorAssistantDailyStats))
const basicDesignerDailyData = computed(() => buildDailyRows(detailStats.value.basicDesignerDailyStats))

async function exportDashboardReport() {
  const blob = await exportDashboardApi({ groups: allowedGroups.value.join(',') })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${route.meta.title || '仪表盘'}_${new Date().toISOString().slice(0, 10)}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

const dailyTaskTargets = {
  design: [
    { permission: 'admin.tasks.design', path: '/admin/tasks/design', query: row => ({ designerId: row?.id }) },
    { permission: 'designer.tasks.design', path: '/designer/tasks', query: () => ({}) },
    { permission: 'operator.tasks.design', path: '/operator/tasks', query: row => ({ designerId: row?.id }) }
  ],
  operator: [
    { permission: 'admin.tasks.operator', path: '/admin/tasks/operator', query: row => ({ designerId: row?.id }) },
    { permission: 'assistant.tasks.operator', path: '/operator-assistant/tasks', query: () => ({}) },
    { permission: 'operator.tasks.assistant', path: '/operator/op-tasks', query: row => ({ designerId: row?.id }) }
  ],
  cs: [
    { permission: 'admin.tasks.cs', path: '/admin/tasks/cs', query: row => ({ designerId: row?.id }) },
    { permission: 'basic.tasks.cs', path: '/basic/tasks', query: () => ({}) },
    { permission: 'cs.tasks.basic', path: '/cs/tasks', query: row => ({ designerId: row?.id }) }
  ]
}

function pickDailyTaskTarget(group) {
  const user = getUser()
  if (user?.role === 'admin') return dailyTaskTargets[group]?.[0]
  return dailyTaskTargets[group]?.find(target => hasPermission(target.permission, user))
}

function openDailyTasks(group, day, row, status = 'finished') {
  const target = pickDailyTaskTarget(group)
  if (!target) {
    ElMessage.warning('当前账号没有该分区的任务列表权限')
    return
  }
  const date = `${nowForView.getFullYear()}-${String(nowForView.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const extraQuery = target.query?.(row) || {}
  const dateField = status === 'doing' ? 'submit' : 'finish'
  router.push({
    path: target.path,
    query: {
      dateStart: date,
      dateEnd: date,
      startDate: date,
      endDate: date,
      status,
      dateField,
      ...Object.fromEntries(Object.entries(extraQuery).filter(([, value]) => value !== undefined && value !== null && value !== ''))
    }
  })
}

function initCharts(data) {
  nextTick(() => {
    // 美工本月积分排行
    if (designerCurrentMonthRef.value && data.designerCurrentMonthRank?.length) {
      designerCurrentMonthChart = designerCurrentMonthChart || echarts.init(designerCurrentMonthRef.value)
      designerCurrentMonthChart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
        xAxis: {
          type: 'category',
          data: data.designerCurrentMonthRank.map(d => d.name),
          axisLabel: { fontSize: 11 }
        },
        yAxis: { type: 'value', minInterval: 1 },
        series: [{
          type: 'bar',
          name: '本月积分',
          data: data.designerCurrentMonthRank.map(d => d.current_month_score),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#4361ee' },
              { offset: 1, color: '#6c83f5' }
            ]),
            borderRadius: [4, 4, 0, 0]
          },
          barMaxWidth: 36
        }]
      })
    }

    // 美工上月积分排行
    if (designerLastMonthRef.value && data.designerLastMonthRank?.length) {
      designerLastMonthChart = designerLastMonthChart || echarts.init(designerLastMonthRef.value)
      designerLastMonthChart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
        xAxis: {
          type: 'category',
          data: data.designerLastMonthRank.map(d => d.name),
          axisLabel: { fontSize: 11 }
        },
        yAxis: { type: 'value', minInterval: 1 },
        series: [{
          type: 'bar',
          name: '上月积分',
          data: data.designerLastMonthRank.map(d => d.last_month_score),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#2ec4b6' },
              { offset: 1, color: '#5ddbd0' }
            ]),
            borderRadius: [4, 4, 0, 0]
          },
          barMaxWidth: 36
        }]
      })
    }

    // 基础美工本月积分排行
    if (basicCurrentMonthRef.value && data.basicDesignerCurrentMonthRank?.length) {
      basicCurrentMonthChart = basicCurrentMonthChart || echarts.init(basicCurrentMonthRef.value)
      basicCurrentMonthChart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
        xAxis: {
          type: 'category',
          data: data.basicDesignerCurrentMonthRank.map(d => d.name),
          axisLabel: { fontSize: 11 }
        },
        yAxis: { type: 'value', minInterval: 1 },
        series: [{
          type: 'bar',
          name: '本月积分',
          data: data.basicDesignerCurrentMonthRank.map(d => d.current_month_score),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#f72585' },
              { offset: 1, color: '#f970a5' }
            ]),
            borderRadius: [4, 4, 0, 0]
          },
          barMaxWidth: 36
        }]
      })
    }

    // 基础美工上月积分排行
    if (basicLastMonthRef.value && data.basicDesignerLastMonthRank?.length) {
      basicLastMonthChart = basicLastMonthChart || echarts.init(basicLastMonthRef.value)
      basicLastMonthChart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
        xAxis: {
          type: 'category',
          data: data.basicDesignerLastMonthRank.map(d => d.name),
          axisLabel: { fontSize: 11 }
        },
        yAxis: { type: 'value', minInterval: 1 },
        series: [{
          type: 'bar',
          name: '上月积分',
          data: data.basicDesignerLastMonthRank.map(d => d.last_month_score),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#f7931a' },
              { offset: 1, color: '#f9b84e' }
            ]),
            borderRadius: [4, 4, 0, 0]
          },
          barMaxWidth: 36
        }]
      })
    }

    // 运营助理本月积分排行
    if (opAssistantCurrentMonthRef.value && data.operatorAssistantCurrentMonthRank?.length) {
      opAssistantCurrentMonthChart = opAssistantCurrentMonthChart || echarts.init(opAssistantCurrentMonthRef.value)
      opAssistantCurrentMonthChart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
        xAxis: {
          type: 'category',
          data: data.operatorAssistantCurrentMonthRank.map(d => d.name),
          axisLabel: { fontSize: 11 }
        },
        yAxis: { type: 'value', minInterval: 1 },
        series: [{
          type: 'bar',
          name: '本月积分',
          data: data.operatorAssistantCurrentMonthRank.map(d => d.current_month_score),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#7c3aed' },
              { offset: 1, color: '#a78bfa' }
            ]),
            borderRadius: [4, 4, 0, 0]
          },
          barMaxWidth: 36
        }]
      })
    }

    // 运营助理上月积分排行
    if (opAssistantLastMonthRef.value && data.operatorAssistantLastMonthRank?.length) {
      opAssistantLastMonthChart = opAssistantLastMonthChart || echarts.init(opAssistantLastMonthRef.value)
      opAssistantLastMonthChart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
        xAxis: {
          type: 'category',
          data: data.operatorAssistantLastMonthRank.map(d => d.name),
          axisLabel: { fontSize: 11 }
        },
        yAxis: { type: 'value', minInterval: 1 },
        series: [{
          type: 'bar',
          name: '上月积分',
          data: data.operatorAssistantLastMonthRank.map(d => d.last_month_score),
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#8b5cf6' },
              { offset: 1, color: '#c4b5fd' }
            ]),
            borderRadius: [4, 4, 0, 0]
          },
          barMaxWidth: 36
        }]
      })
    }

    // 美工完成效率排行
    if (designerChartRef.value && data.designerRank?.length) {
      designerChart = designerChart || echarts.init(designerChartRef.value)
      designerChart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
        xAxis: {
          type: 'category',
          data: data.designerRank.map(d => d.name),
          axisLabel: { fontSize: 11 }
        },
        yAxis: { type: 'value', minInterval: 1 },
        series: [
          {
            name: '完成',
            type: 'bar',
            data: data.designerRank.map(d => d.finished_count),
            itemStyle: { color: '#2ec4b6', borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 28
          },
          {
            name: '驳回',
            type: 'bar',
            data: data.designerRank.map(d => d.rejected_count),
            itemStyle: { color: '#e63946', borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 28
          }
        ],
        legend: { bottom: 0 }
      })
    }

  })
}

async function loadData(options = {}) {
  if (!options.silent) loading.value = true
  try {
    const res = await getDashboardStatsApi()
    if (res.code === 0) {
      designStats.value = res.data.designStats
      csStats.value = res.data.csStats
      operatorStats.value = res.data.operatorStats
      initCharts(res.data)
    }
  } catch (e) {
    console.warn('[Dashboard] 加载失败:', e.message)
  } finally { if (!options.silent) loading.value = false }
}

async function loadDetailStats() {
  try {
    const res = await getAdminDetailStatsApi()
    if (res.code === 0) detailStats.value = res.data
  } catch (e) {
    console.warn('[Dashboard] 加载综合统计失败:', e.message)
  }
}

function handleResize() {
  [designerCurrentMonthChart, designerLastMonthChart, basicCurrentMonthChart, basicLastMonthChart, opAssistantCurrentMonthChart, opAssistantLastMonthChart, designerChart].forEach(chart => {
    chart?.resize()
  })
}

function handleVisibility() {
  if (document.hidden) {
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null }
  } else {
    if (!refreshTimer) {
      loadData({ silent: true }); loadDetailStats()
      refreshTimer = setInterval(() => { loadData({ silent: true }); loadDetailStats() }, 60000)
    }
  }
}

onMounted(() => {
  loadData()
  loadDetailStats()
  window.addEventListener('resize', handleResize)
  document.addEventListener('visibilitychange', handleVisibility)
  refreshTimer = setInterval(() => { loadData({ silent: true }); loadDetailStats() }, 60000)
})

watch(() => route.meta.dashboardGroups, async () => {
  disposeCharts()
  await nextTick()
  loadData({ silent: true })
  loadDetailStats()
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('visibilitychange', handleVisibility)
  if (refreshTimer) clearInterval(refreshTimer)
  disposeCharts()
})
</script>

<style scoped>
.stat-card {
  text-align: center;
  border-radius: var(--dd-radius-lg) !important;
  transition: all var(--dd-transition-normal);
  cursor: default;
  position: relative;
  overflow: hidden;
}
.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--dd-shadow-lg) !important;
}

.stat-icon-bg {
  position: absolute;
  bottom: -15px;
  right: -15px;
  width: 60px;
  height: 60px;
  border-radius: 50%;
  opacity: 0.08;
}

.stat-value {
  font-size: 36px;
  font-weight: 800;
  line-height: 1.2;
}

.stat-label {
  font-size: 14px;
  color: var(--dd-text-muted);
  margin-top: 8px;
  font-weight: 500;
}

.chart-row {
  margin-top: 20px;
}

.dashboard-wide-table {
  width: 100%;
}

.dashboard-wide-table :deep(.el-table__header-wrapper) {
  overflow: hidden;
}

.dashboard-wide-table :deep(.el-scrollbar__bar.is-horizontal) {
  display: block;
  opacity: 1;
}

.daily-score-cell {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 56px;
}

.daily-score-cell :deep(.el-button) {
  padding: 0;
  min-height: 20px;
}

/* 分区底色区分 */
.section-blue {
  background: #f5f8fe;
}
.section-blue :deep(.el-card__header) {
  background: #eef3fc;
}

.section-title-red {
  color: #e63946;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  font-weight: 800;
  font-size: 18px;
  letter-spacing: 1px;
  text-shadow: 0 1px 2px rgba(230, 57, 70, 0.15);
}

.section-rose {
  background: #fef8f9;
}
.section-rose :deep(.el-card__header) {
  background: #fdf1f3;
}

.section-purple {
  background: #f8f6fe;
}
.section-purple :deep(.el-card__header) {
  background: #f3effe;
}

.section-title-purple {
  color: #7c3aed;
  font-family: "Microsoft YaHei", "PingFang SC", sans-serif;
  font-weight: 800;
  font-size: 18px;
  letter-spacing: 1px;
  text-shadow: 0 1px 2px rgba(124, 58, 237, 0.15);
}
</style>
