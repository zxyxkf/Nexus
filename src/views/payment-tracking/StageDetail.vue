<template>
  <main class="payment-page" v-loading="loading">
    <h1>{{ stageTitle }}</h1>
    <el-empty v-if="!loading && !record" description="未找到选品记录" />
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getPaymentRecordApi } from '@/api'
import { PAYMENT_STAGE_BY_CODE } from '@/config/payment-tracking'

const route = useRoute()
const loading = ref(false)
const record = ref(null)
const stageTitle = computed(() => PAYMENT_STAGE_BY_CODE[route.params.stageCode]?.label || '选品阶段详情')

async function loadRecord() {
  loading.value = true
  try {
    const response = await getPaymentRecordApi(route.params.id)
    record.value = response.data || null
  } finally {
    loading.value = false
  }
}

onMounted(loadRecord)
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
