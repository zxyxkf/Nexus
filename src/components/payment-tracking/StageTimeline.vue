<template>
  <div class="stage-timeline" :aria-readonly="readonly">
    <template v-for="(stage, index) in orderedStages" :key="stage.stageCode">
      <div class="stage-column">
        <button
          type="button"
          class="stage-node"
          :class="stageClass(stage)"
          :title="stageLabel(stage.stageCode)"
          @click="emit('select', stage)"
        >
          <span class="stage-index">{{ index + 1 }}</span>
          <span class="stage-label">{{ stageLabel(stage.stageCode) }}</span>
        </button>
        <div v-if="statusForStage(stage.stageCode)" class="link-status-row" aria-label="链接状态">
          <span
            v-for="item in LINK_STATUS_FRAMES"
            :key="item.key"
            class="link-status-frame"
            :class="{ active: statusForStage(stage.stageCode)[item.key] === true }"
            :title="item.label"
          >
            <span v-for="line in item.lines" :key="line">{{ line }}</span>
          </span>
        </div>
      </div>
      <span
        v-if="index < orderedStages.length - 1"
        class="stage-connector"
        :class="{ complete: stage.stageStatus === 'completed' }"
      />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { PAYMENT_STAGES, PAYMENT_STAGE_BY_CODE } from '@/config/payment-tracking'

const props = defineProps({
  stages: { type: Array, default: () => [] },
  currentStage: { type: String, default: '' },
  endStage: { type: String, default: '' },
  linkStatus: { type: Object, default: null },
  readonly: Boolean
})

const emit = defineEmits(['select'])
const stageOrder = new Map(PAYMENT_STAGES.map((stage, index) => [stage.code, index]))
const LINK_STATUS_FRAMES = [
  { key: 'flashSaleRegistered', label: '秒杀', lines: ['秒杀'] },
  { key: 'rapidOrderEntered', label: '极速爆单', lines: ['极速', '爆单'] },
  { key: 'newProductOperationRegistered', label: '新品运营', lines: ['新品', '运营'] },
  { key: 'productBurst', label: '速爆', lines: ['速爆'] }
]

const orderedStages = computed(() => [...props.stages].sort((a, b) => (
  (stageOrder.get(a.stageCode) ?? 999) - (stageOrder.get(b.stageCode) ?? 999)
)))

function stageLabel(code) {
  return PAYMENT_STAGE_BY_CODE[code]?.label || code
}

function stageClass(stage) {
  if (stage.stageCode === props.endStage) return 'is-ended'
  if (stage.stageCode === props.currentStage) return 'is-current'
  if (stage.stageStatus === 'completed') return 'is-complete'
  return 'is-entered'
}

function statusForStage(code) {
  return props.linkStatus?.stageCode === code ? props.linkStatus : null
}
</script>

<style scoped>
.stage-timeline {
  display: flex;
  align-items: flex-start;
  min-width: max-content;
  padding: 2px 0;
}

.stage-column {
  width: 160px;
  flex: 0 0 160px;
}

.stage-node {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: 160px;
  height: 36px;
  padding: 0 9px;
  border: 1px solid var(--dd-border, #dcdfe6);
  border-radius: 6px;
  background: var(--dd-bg-card, #fff);
  color: var(--dd-text-regular, #606266);
  cursor: pointer;
  overflow: hidden;
}

.stage-node:hover {
  border-color: var(--dd-primary, #409eff);
}

.stage-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: 7px;
  border-radius: 50%;
  background: #eef1f5;
  color: #606266;
  font-size: 12px;
  flex: 0 0 auto;
}

.stage-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}

.stage-node.is-complete {
  border-color: #a8d8bd;
  color: #237a4b;
  background: #f2faf5;
}

.stage-node.is-complete .stage-index {
  background: #2d9d62;
  color: #fff;
}

.stage-node.is-current {
  border-color: var(--dd-primary, #409eff);
  color: #2468a2;
  background: #edf6ff;
}

.stage-node.is-current .stage-index {
  background: var(--dd-primary, #409eff);
  color: #fff;
}

.stage-node.is-ended {
  border-color: #e6a23c;
  color: #9a6417;
  background: #fdf6ec;
}

.stage-node.is-ended .stage-index {
  background: #e6a23c;
  color: #fff;
}

.stage-connector {
  width: 18px;
  height: 2px;
  background: #dcdfe6;
  flex: 0 0 auto;
  margin-top: 17px;
}

.stage-connector.complete {
  background: #67c23a;
}

.link-status-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 3px;
  width: 160px;
  margin-top: 7px;
}

.link-status-frame {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 30px;
  border: 1px solid #d8dde5;
  border-radius: 4px;
  background: #f5f7fa;
  color: #a0a7b2;
  font-size: 10px;
  line-height: 1.1;
  text-align: center;
}

.link-status-frame.active {
  border-color: #75b991;
  background: #edf8f1;
  color: #237a4b;
  font-weight: 600;
}
</style>
