<template>
  <div class="task-filter-bar">
    <el-input
      v-if="showKeyword"
      v-model="filters.keyword"
      :placeholder="keywordPlaceholder"
      clearable
      class="filter-input"
      @clear="$emit('change')"
      @keyup.enter="$emit('change')"
    >
      <template #prefix><el-icon><Search /></el-icon></template>
    </el-input>

    <el-select
      v-if="showStatus"
      v-model="filters.status"
      placeholder="状态筛选"
      clearable
      class="filter-select"
      @change="$emit('change')"
    >
      <el-option label="全部" value="" />
      <el-option v-for="s in statusOptions" :key="s.value" :label="s.label" :value="s.value" />
    </el-select>

    <el-select
      v-if="showDesigner && designerList.length"
      v-model="filters.designerId"
      :placeholder="designerPlaceholder"
      clearable
      class="filter-select"
      @change="$emit('change')"
    >
      <el-option label="全部" value="" />
      <el-option v-for="d in designerList" :key="d.id" :label="d.real_name || d.username" :value="d.id" />
    </el-select>

    <el-input
      v-if="showStyleNumber"
      v-model="filters.styleNumber"
      placeholder="款号"
      clearable
      class="filter-input"
      style="width:130px"
      @clear="$emit('change')"
      @keyup.enter="$emit('change')"
    />

    <el-input
      v-if="showShopName"
      v-model="filters.shopName"
      placeholder="店铺名称"
      clearable
      class="filter-input"
      style="width:150px"
      @clear="$emit('change')"
      @keyup.enter="$emit('change')"
    />

    <el-date-picker
      v-if="showDateRange"
      v-model="filters.dateRange"
      type="daterange"
      range-separator="至"
      start-placeholder="开始日期"
      end-placeholder="结束日期"
      format="YYYY-MM-DD"
      value-format="YYYY-MM-DD"
      clearable
      class="filter-date"
      @change="$emit('change')"
    />

    <slot name="extra" />
  </div>
</template>

<script setup>
import { Search } from '@element-plus/icons-vue'

const props = defineProps({
  filters: { type: Object, required: true },
  showKeyword: { type: Boolean, default: true },
  showStatus: { type: Boolean, default: true },
  showDesigner: { type: Boolean, default: false },
  showStyleNumber: { type: Boolean, default: false },
  showShopName: { type: Boolean, default: false },
  showDateRange: { type: Boolean, default: false },
  keywordPlaceholder: { type: String, default: '搜索任务' },
  designerPlaceholder: { type: String, default: '筛选人员' },
  designerList: { type: Array, default: () => [] },
  statusOptions: {
    type: Array,
    default: () => [
      { label: '待接单', value: 'wait' },
      { label: '已接单', value: 'accepted' },
      { label: '作图中', value: 'doing' },
      { label: '已完成', value: 'finished' },
      { label: '已驳回', value: 'rejected' },
      { label: '草稿', value: 'draft' }
    ]
  }
})

defineEmits(['change'])
</script>

<style scoped>
.task-filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.filter-input { width: 180px; }
.filter-select { width: 130px; }
.filter-date { width: 240px; }
</style>
