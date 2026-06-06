<template>
  <el-popover
    trigger="click"
    placement="bottom-start"
    :width="popoverWidth"
    :visible="visible"
    :teleported="true"
    popper-class="person-select-popper"
    @show="onShow"
    @hide="visible = false"
  >
    <template #reference>
      <div class="ps-trigger" :class="{ 'is-open': visible, 'is-empty': !modelValue }" @click.stop="visible = !visible">
        <span v-if="selectedItem" class="ps-trigger-text">{{ selectedItem.real_name || selectedItem.username }}</span>
        <span v-else class="ps-trigger-placeholder">{{ placeholder }}</span>
        <el-icon class="ps-trigger-arrow" :class="{ 'is-up': visible }"><ArrowDown /></el-icon>
        <el-icon v-if="modelValue && clearable" class="ps-trigger-clear" @click.stop="clear"><CircleClose /></el-icon>
      </div>
    </template>

    <div v-if="filterable" class="ps-search">
      <el-input v-model="filterText" placeholder="搜索..." size="small" clearable class="ps-search-input" />
    </div>

    <div class="ps-list" :class="{ 'ps-list--has-search': filterable }">
      <div
        v-for="d in filteredItems"
        :key="d.id"
        class="ps-item"
        :class="{ 'is-selected': modelValue === d.id }"
        @click="select(d)"
        @mouseenter="refreshItem(d)"
      >
        <el-tooltip
          v-if="d._activeTasks && d._activeTasks.length"
          placement="right-start"
          trigger="hover"
          :show-after="200"
          :hide-after="100"
          :offset="8"
          popper-class="ps-tooltip-popper"
        >
          <template #content>
            <div class="pst-inner">
              <div class="pst-header">
                <span class="pst-title">进行中的任务</span>
                <span class="pst-count">{{ d._activeTasks.length }}</span>
              </div>
              <div class="pst-divider"></div>
              <div class="pst-items">
                <div v-for="t in d._activeTasks" :key="t.id" class="pst-row">
                  <span class="pst-dot"></span>
                  <span class="pst-task-title">{{ t.title }}</span>
                </div>
              </div>
            </div>
          </template>
          <div class="ps-item-inner">
            <span class="ps-item-name">{{ d.real_name || d.username }}</span>
            <span class="ps-item-badge">{{ d._activeTasks.length }}</span>
          </div>
        </el-tooltip>
        <div v-else class="ps-item-inner">
          <span class="ps-item-name">{{ d.real_name || d.username }}</span>
          <span class="ps-item-idle">空闲</span>
        </div>
      </div>
      <div v-if="!filteredItems.length" class="ps-empty">无匹配结果</div>
    </div>
  </el-popover>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ArrowDown, CircleClose } from '@element-plus/icons-vue'

const props = defineProps({
  modelValue: { type: [Number, String], default: null },
  items: { type: Array, required: true },
  placeholder: { type: String, default: '请选择' },
  filterable: { type: Boolean, default: false },
  clearable: { type: Boolean, default: false },
  popoverWidth: { type: Number, default: 280 }
})

const emit = defineEmits(['update:modelValue', 'refresh'])

const visible = ref(false)
const filterText = ref('')

const selectedItem = computed(() => props.items.find(d => d.id === props.modelValue) || null)

const filteredItems = computed(() => {
  if (!props.filterable || !filterText.value) return props.items
  const kw = filterText.value.toLowerCase()
  return props.items.filter(d => (d.real_name || d.username || '').toLowerCase().includes(kw))
})

function onShow() {
  filterText.value = ''
  emit('refresh')
}

function refreshItem(item) {
  emit('refresh', item)
}

function select(d) {
  emit('update:modelValue', d.id)
  visible.value = false
}

function clear() {
  emit('update:modelValue', null)
  visible.value = false
}
</script>

<style scoped>
.ps-trigger {
  display: flex; align-items: center; gap: 6px;
  height: 32px; padding: 0 12px;
  background: #fff; border: 1px solid #dcdfe6; border-radius: 6px;
  cursor: pointer; font-size: 14px; transition: border-color .2s;
  user-select: none; min-width: 160px;
}
.ps-trigger:hover, .ps-trigger.is-open { border-color: #6366f1; }
.ps-trigger.is-open { box-shadow: 0 0 0 2px rgba(99,102,241,.15); }
.ps-trigger-placeholder { color: #c0c4cc; flex: 1; }
.ps-trigger-text { color: #303133; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ps-trigger-arrow { color: #c0c4cc; font-size: 12px; transition: transform .2s; flex-shrink: 0; }
.ps-trigger-arrow.is-up { transform: rotate(180deg); }
.ps-trigger-clear { color: #c0c4cc; font-size: 14px; flex-shrink: 0; cursor: pointer; }
.ps-trigger-clear:hover { color: #909399; }

.ps-search { padding: 8px 10px 4px; }
.ps-search-input :deep(.el-input__wrapper) { border-radius: 6px; }

.ps-list { max-height: 260px; overflow-y: auto; padding: 4px; }
.ps-list--has-search { max-height: 220px; }

.ps-item { border-radius: 6px; cursor: pointer; transition: background .15s; }
.ps-item:hover { background: #f4f4f5; }
.ps-item.is-selected { background: #eef2ff; }

.ps-item-inner {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 10px; gap: 8px;
}
.ps-item-name { font-size: 14px; color: #303133; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ps-item-badge {
  font-size: 11px; color: #6366f1; background: #eef2ff;
  padding: 1px 6px; border-radius: 999px; flex-shrink: 0;
}
.ps-item-idle { font-size: 12px; color: #67c23a; flex-shrink: 0; }
.ps-empty { padding: 16px; text-align: center; font-size: 13px; color: #c0c4cc; }
</style>

<style>
.ps-tooltip-popper {
  padding: 0 !important;
  max-width: 240px;
  border-radius: 10px !important;
  box-shadow: 0 8px 30px rgba(0,0,0,.12) !important;
}
.pst-inner { padding: 14px 16px; background: #f5f3ff; border-radius: 10px; }
.pst-header { display: flex; align-items: center; gap: 8px; }
.pst-title { font-size: 13px; font-weight: 600; color: #1e293b; }
.pst-count {
  font-size: 11px; color: #fff; background: #6366f1;
  padding: 1px 6px; border-radius: 999px; margin-left: auto;
}
.pst-divider { height: 1px; background: #f1f5f9; margin: 10px 0; }
.pst-items { display: flex; flex-direction: column; gap: 2px; }
.pst-row {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 8px; border-radius: 6px;
}
.pst-row:hover { background: #ede9fe; }
.pst-dot {
  width: 5px; height: 5px; border-radius: 50%; background: #cbd5e1; flex-shrink: 0;
}
.pst-task-title {
  font-size: 13px; color: #334155; flex: 1;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
</style>
