<template>
  <StatsPanel :cards="cards" />
</template>

<script setup>
import { computed } from 'vue'
import StatsPanel from '@/components/StatsPanel.vue'

const cards = computed(() => [
  { key: 'total_score', label: '累计分值', color: '#722ed1' },
  { key: 'pending_review_score', label: '待审核分数', color: '#fa8c16' },
  { key: 'total', label: '总接单量', color: '#409eff' },
  { key: 'finished_count', label: '已完成', color: '#67c23a' },
  { key: 'current_month_score', label: '当月分值', color: '#1890ff' },
  { key: 'today_score', label: '今日分值', color: '#fa8c16' },
  { key: 'yesterday_score', label: '昨日分值', color: '#13c2c2' },
  { key: 'completion_rate', label: '完成率', color: '#52c41a', suffix: '%' }
])
</script>
