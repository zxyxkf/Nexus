<template>
  <div class="month-filter">
    <el-select :model-value="value.year" size="small" style="width:96px" @change="update('year', $event)">
      <el-option v-for="year in years" :key="year" :label="`${year}年`" :value="year" />
    </el-select>
    <el-select :model-value="value.month" size="small" style="width:82px" @change="update('month', $event)">
      <el-option v-for="month in 12" :key="month" :label="`${month}月`" :value="month" />
    </el-select>
  </div>
</template>

<script setup>
const props = defineProps({ value: { type: Object, required: true } })
const emit = defineEmits(['change'])
const currentYear = new Date().getFullYear()
const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1]

function update(key, value) {
  emit('change', { year: Number(key === 'year' ? value : props.value.year), month: Number(key === 'month' ? value : props.value.month) })
}
</script>

<style scoped>
.month-filter { display: flex; align-items: center; gap: 6px; }
</style>
