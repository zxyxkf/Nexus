<template>
  <div class="dd-pagination">
    <span class="dd-pagination__total">共 {{ total }} 条</span>

    <div class="dd-pagination__sizes">
      <el-select
        :model-value="pageSize"
        @update:model-value="handleSizeChange"
        size="default"
        style="width: 100px;"
      >
        <el-option
          v-for="size in pageSizes"
          :key="size"
          :label="`${size} 条/页`"
          :value="size"
        />
      </el-select>
    </div>

    <button
      class="dd-pagination__btn"
      :disabled="currentPage <= 1"
      @click="handlePageChange(currentPage - 1)"
    >
      <el-icon><ArrowLeft /></el-icon>
    </button>

    <ul class="dd-pagination__pagers">
      <li
        v-for="pager in displayedPages"
        :key="pager"
        class="dd-pagination__pager"
        :class="{ active: pager === currentPage, 'is-ellipsis': pager === '...' }"
        @click="pager !== '...' && handlePageChange(pager)"
      >
        <span v-if="pager === '...'">...</span>
        <span v-else>{{ pager }}</span>
      </li>
    </ul>

    <button
      class="dd-pagination__btn"
      :disabled="currentPage >= totalPages"
      @click="handlePageChange(currentPage + 1)"
    >
      <el-icon><ArrowRight /></el-icon>
    </button>

    <div class="dd-pagination__jumper">
      <span>前往</span>
      <el-input
        :model-value="jumperInput"
        @update:model-value="onJumperInput"
        @keyup.enter="handleJumper"
        size="default"
        style="width: 56px;"
      />
      <span>页</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue'

const props = defineProps({
  currentPage: { type: Number, default: 1 },
  pageSize: { type: Number, default: 15 },
  total: { type: Number, default: 0 },
  pageSizes: { type: Array, default: () => [10, 15, 20, 50] },
  layout: { type: String, default: 'total, sizes, prev, pager, next, jumper' }
})

const emit = defineEmits([
  'update:currentPage',
  'update:pageSize',
  'current-change',
  'size-change'
])

const jumperInput = ref('')

const totalPages = computed(() => {
  if (props.total <= 0) return 1
  return Math.max(1, Math.ceil(props.total / props.pageSize))
})

const displayedPages = computed(() => {
  const pages = []
  const total = totalPages.value
  const current = props.currentPage

  if (total <= 7) {
    for (let i = 1; i <= total; i++) pages.push(i)
    return pages
  }

  pages.push(1)
  if (current > 3) pages.push('...')

  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  for (let i = start; i <= end; i++) pages.push(i)

  if (current < total - 2) pages.push('...')
  pages.push(total)

  return pages
})

function onJumperInput(val) {
  jumperInput.value = val
}

function handleJumper() {
  const num = parseInt(jumperInput.value, 10)
  if (!isNaN(num) && num >= 1 && num <= totalPages.value) {
    handlePageChange(num)
  }
  jumperInput.value = ''
}

function handlePageChange(page) {
  const p = Math.max(1, Math.min(page, totalPages.value))
  if (p !== props.currentPage) {
    emit('update:currentPage', p)
    emit('current-change', p)
  }
}

function handleSizeChange(size) {
  if (size !== props.pageSize) {
    emit('update:pageSize', size)
    emit('size-change', size)
  }
}

watch(() => props.currentPage, () => {
  jumperInput.value = ''
})
</script>

<style scoped>
.dd-pagination {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 0 4px;
  font-size: 13px;
  color: var(--dd-text-regular);
  flex-wrap: wrap;
  user-select: none;
}

.dd-pagination__total {
  margin-right: 8px;
  color: var(--dd-text-secondary);
  font-size: 13px;
  white-space: nowrap;
}

.dd-pagination__sizes {
  margin-right: 4px;
}

.dd-pagination__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--dd-border);
  border-radius: 6px;
  background: var(--dd-bg-card);
  color: var(--dd-text-regular);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.dd-pagination__btn:hover:not(:disabled) {
  color: var(--dd-primary, #409eff);
  border-color: var(--dd-primary, #409eff);
}

.dd-pagination__btn:disabled {
  color: var(--dd-text-disabled, #c0c4cc);
  cursor: not-allowed;
  opacity: 0.5;
}

.dd-pagination__pagers {
  display: flex;
  align-items: center;
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}

.dd-pagination__pager {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  border: 1px solid var(--dd-border);
  border-radius: 6px;
  background: var(--dd-bg-card);
  color: var(--dd-text-regular);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  font-weight: 500;
}

.dd-pagination__pager:hover:not(.active):not(.is-ellipsis) {
  color: var(--dd-primary, #409eff);
  border-color: var(--dd-primary, #409eff);
}

.dd-pagination__pager.active {
  background: var(--dd-primary, #409eff);
  border-color: var(--dd-primary, #409eff);
  color: #fff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.3);
}

.dd-pagination__pager.is-ellipsis {
  border-color: transparent;
  background: transparent;
  cursor: default;
  color: var(--dd-text-secondary);
}

.dd-pagination__jumper {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 4px;
  font-size: 13px;
  color: var(--dd-text-regular);
  white-space: nowrap;
}

.dd-pagination__jumper :deep(.el-input__inner) {
  text-align: center;
}
</style>
