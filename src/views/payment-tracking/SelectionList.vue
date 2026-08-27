<template>
  <main class="payment-page" v-loading="loading">
    <h1>选品收集</h1>
    <el-empty v-if="!loading && records.length === 0" description="暂无进行中的选品记录" />
  </main>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { listPaymentRecordsApi } from '@/api'

const loading = ref(false)
const records = ref([])

async function loadRecords() {
  loading.value = true
  try {
    const response = await listPaymentRecordsApi({ processStatus: 'in_progress' })
    records.value = response.data?.list || []
  } finally {
    loading.value = false
  }
}

onMounted(loadRecords)
</script>

<style scoped>
.payment-page {
  min-height: 240px;
}

h1 {
  margin: 0 0 20px;
  font-size: 24px;
}
</style>
