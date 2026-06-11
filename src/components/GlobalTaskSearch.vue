<template>
  <div class="global-task-search">
    <el-input
      v-model="keyword"
      class="global-search-input"
      placeholder="搜索编号/旺旺/款号/人员/文件"
      clearable
      @focus="openPanel"
      @keyup.enter="searchNow"
      @clear="clearResults"
    >
      <template #prefix><el-icon><Search /></el-icon></template>
    </el-input>

    <div v-if="visible" class="search-popover" @mousedown.prevent>
      <div class="search-header">
        <span>全局搜索</span>
        <el-button link size="small" @click="visible = false">关闭</el-button>
      </div>
      <div class="search-body" v-loading="loading">
        <el-empty v-if="!loading && hasSearched && results.length === 0" description="没有匹配任务" :image-size="72" />
        <div v-if="!hasSearched && !loading" class="search-hint">输入任务编号、旺旺ID、款号、发布人、接单人或文件名</div>
        <div
          v-for="item in results"
          :key="item.id"
          class="search-result"
          @click="selectTask(item)"
        >
          <div class="result-main">
            <span class="result-no">#{{ item.task_no }}</span>
            <span class="result-title">{{ item.title || item.style_number || item.wangwang_id || '-' }}</span>
          </div>
          <div class="result-meta">
            <el-tag size="small" effect="plain">{{ groupLabel(item.task_group) }}</el-tag>
            <el-tag size="small" :type="statusType(item.status)" effect="plain">{{ statusLabel(item.status) }}</el-tag>
            <span>{{ item.publisher_name || '-' }} → {{ item.designer_name || '未接单' }}</span>
          </div>
          <div class="result-extra">
            <span v-if="item.wangwang_id">旺旺: {{ item.wangwang_id }}</span>
            <span v-if="item.style_number">款号: {{ item.style_number }}</span>
            <span v-if="item.shop_name">店铺: {{ item.shop_name }}</span>
            <span>{{ formatTime(item.update_time || item.create_time) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { searchTasksApi } from '@/api'
import { STATUS_MAP, STATUS_TAG_TYPE } from '@/utils/format'
import { openTask } from '@/utils/task-navigation'

const keyword = ref('')
const visible = ref(false)
const loading = ref(false)
const results = ref([])
const hasSearched = ref(false)
let searchTimer = null

function statusLabel(status) {
  return STATUS_MAP[status] || status
}

function statusType(status) {
  return STATUS_TAG_TYPE[status] || 'info'
}

function groupLabel(group) {
  if (group === 'operator') return '运营助理'
  if (group === 'cs') return '基础美工'
  return '高级美工'
}

function openPanel() {
  visible.value = true
}

function clearResults() {
  results.value = []
  hasSearched.value = false
  loading.value = false
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
}

async function searchNow() {
  const text = keyword.value.trim()
  visible.value = true
  if (!text) {
    clearResults()
    return
  }
  loading.value = true
  hasSearched.value = true
  try {
    const res = await searchTasksApi({ keyword: text, pageSize: 12 })
    if (res.code === 0) {
      results.value = res.data?.list || []
    }
  } finally {
    loading.value = false
  }
}

function formatTime(value) {
  if (!value) return '-'
  return String(value).replace('T', ' ').slice(0, 16)
}

function selectTask(item) {
  visible.value = false
  openTask(item)
}

watch(keyword, (value) => {
  if (searchTimer) clearTimeout(searchTimer)
  const text = value.trim()
  if (!text) {
    clearResults()
    return
  }
  if (text.length < 2) return
  searchTimer = setTimeout(searchNow, 300)
})

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer)
})
</script>

<style scoped>
.global-task-search {
  position: relative;
  width: 280px;
}
.global-search-input :deep(.el-input__wrapper) {
  border-radius: 8px;
}
.search-popover {
  position: absolute;
  top: 42px;
  right: 0;
  width: 520px;
  max-width: calc(100vw - 32px);
  background: var(--dd-bg-card, #fff);
  border: 1px solid var(--dd-border, #e5e7eb);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
  z-index: 2000;
  overflow: hidden;
}
.search-header {
  height: 42px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--dd-border-light, #eef2f7);
  font-size: 13px;
  font-weight: 600;
}
.search-body {
  max-height: 420px;
  overflow-y: auto;
  padding: 8px;
}
.search-hint {
  padding: 24px 12px;
  text-align: center;
  color: var(--dd-text-muted, #909399);
  font-size: 13px;
}
.search-result {
  padding: 10px;
  border-radius: 8px;
  cursor: pointer;
}
.search-result:hover {
  background: var(--dd-primary-lighter, #eef4ff);
}
.result-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.result-no {
  font-size: 12px;
  color: var(--dd-primary, #4361ee);
  font-weight: 600;
}
.result-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--dd-text-primary, #1f2937);
}
.result-meta {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--dd-text-muted, #909399);
  font-size: 12px;
}
.result-meta span,
.result-extra span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.result-extra {
  margin-top: 6px;
  display: flex;
  gap: 10px;
  min-width: 0;
  color: var(--dd-text-muted, #909399);
  font-size: 12px;
}
</style>
