<template>
  <StatsPanel :cards="cards" show-project-monthly />
</template>

<script setup>
import { computed } from 'vue'
import StatsPanel from '@/components/StatsPanel.vue'

const cards = computed(() => [
  { key: 'pending_review_score', label: '待审核分数', color: '#fa8c16' },
  { key: 'current_month_score', label: '当月分值', color: '#1890ff' },
  { key: 'today_score', label: '今日分值', color: '#fa8c16' },
  { key: 'yesterday_score', label: '昨日分值', color: '#13c2c2' },
  { key: 'completion_rate', label: '完成率', color: '#52c41a', suffix: '%' }
])
</script>
