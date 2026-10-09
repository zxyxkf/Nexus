<template>
  <div class="range-filter">
    <el-popover v-model:visible="visible" placement="bottom-end" :width="340" trigger="click">
      <template #reference>
        <el-button size="small" :icon="Calendar">{{ rangeLabel }}</el-button>
      </template>
      <div class="range-picker">
        <el-radio-group v-model="draftMode" size="small">
          <el-radio-button value="day">日粒度</el-radio-button>
          <el-radio-button value="month">月粒度</el-radio-button>
        </el-radio-group>
        <el-date-picker
          v-model="draftRange"
          :type="draftMode === 'day' ? 'daterange' : 'monthrange'"
          :value-format="draftMode === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM'"
          range-separator="至"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          :clearable="false"
          :teleported="false"
          style="width:100%;"
        />
        <el-button type="primary" size="small" :disabled="!draftRange?.length" @click="applyCustom">确定</el-button>
      </div>
    </el-popover>
    <el-radio-group v-if="showPresets" :model-value="value.preset" size="small" @change="applyPreset">
      <el-radio-button value="all">全部</el-radio-button>
      <el-radio-button value="current">当月</el-radio-button>
      <el-radio-button value="last">上月</el-radio-button>
    </el-radio-group>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { Calendar } from '@element-plus/icons-vue'

const props = defineProps({
  value: { type: Object, required: true },
  showPresets: { type: Boolean, default: true }
})
const emit = defineEmits(['change'])
const visible = ref(false)
const draftMode = ref('day')
const draftRange = ref([])

const rangeLabel = computed(() => {
  if (!props.showPresets) return '自定义时间'
  if (props.value.preset === 'all') return '自定义时间'
  if (props.value.preset === 'current') return '本月时间'
  if (props.value.preset === 'last') return '上月时间'
  return `${props.value.start} 至 ${props.value.end}`
})

watch(visible, open => {
  if (!open) return
  draftMode.value = props.value.mode || 'day'
  draftRange.value = props.value.preset === 'custom'
    ? [props.value.start, props.value.end]
    : []
})

watch(draftMode, () => { draftRange.value = [] })

function applyPreset(preset) {
  emit('change', { preset })
  visible.value = false
}

function applyCustom() {
  if (!draftRange.value || draftRange.value.length !== 2) return
  emit('change', {
    preset: 'custom', mode: draftMode.value,
    start: draftRange.value[0], end: draftRange.value[1]
  })
  visible.value = false
}
</script>

<style scoped>
.range-filter, .range-picker { display: flex; align-items: center; gap: 8px; }
.range-filter { flex-wrap: wrap; justify-content: flex-end; }
.range-picker { flex-direction: column; align-items: stretch; }
.range-picker > .el-button { align-self: flex-end; }
</style>
