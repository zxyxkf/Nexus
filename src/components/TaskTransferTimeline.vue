<template>
  <div v-if="items.length" class="transfer-panel">
    <div class="transfer-title">转移记录</div>
    <div class="transfer-flow">
      <span class="flow-node">{{ initialName }}</span>
      <template v-for="record in items" :key="record.id">
        <span class="flow-arrow">→</span>
        <span class="flow-node is-target">{{ record.to_designer_name || '未命名' }}</span>
      </template>
    </div>
    <div class="transfer-list">
      <div v-for="(record, index) in items" :key="record.id" class="transfer-item">
        <div class="transfer-step">第 {{ index + 1 }} 次转移</div>
        <div class="transfer-main">
          <span>{{ record.from_designer_name || '未命名' }}</span>
          <span class="transfer-arrow">→</span>
          <span>{{ record.to_designer_name || '未命名' }}</span>
        </div>
        <div class="transfer-meta">
          <span>{{ formatDate(record.create_time) }}</span>
          <span v-if="record.operator_name">操作人：{{ record.operator_name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { formatDate } from '@/utils/format'

const props = defineProps({
  records: {
    type: Array,
    default: () => []
  }
})

const items = computed(() => props.records || [])
const initialName = computed(() => items.value[0]?.from_designer_name || '首次接单人')
</script>

<style scoped>
.transfer-panel {
  grid-column: 1 / -1;
  background: #f0f8f6;
  border: 1px solid #b9e4d8;
  border-radius: 8px;
  padding: 12px 14px;
  margin-bottom: 12px;
}
.transfer-title {
  font-size: 13px;
  font-weight: 700;
  color: #176b5a;
  margin-bottom: 10px;
}
.transfer-flow {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.flow-node {
  max-width: 160px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #ffffff;
  border: 1px solid #9dd8c9;
  color: #1f4f46;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.flow-node.is-target {
  background: #dff4ef;
  color: #0d5f4f;
}
.flow-arrow,
.transfer-arrow {
  color: #16806a;
  font-weight: 700;
}
.transfer-list {
  display: grid;
  gap: 8px;
}
.transfer-item {
  display: grid;
  grid-template-columns: 90px minmax(160px, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 6px;
}
.transfer-step {
  font-size: 12px;
  font-weight: 700;
  color: #176b5a;
}
.transfer-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
}
.transfer-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  color: #5b7f77;
  font-size: 12px;
}
@media (max-width: 768px) {
  .transfer-item {
    grid-template-columns: 1fr;
    align-items: flex-start;
  }
  .transfer-meta {
    justify-content: flex-start;
  }
}
</style>
