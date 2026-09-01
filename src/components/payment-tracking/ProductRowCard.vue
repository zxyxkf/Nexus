<template>
  <article class="product-row-card">
    <div class="cover-wrap">
      <el-image
        v-if="productImages.length"
        class="cover-image"
        :src="previewUrls[0]"
        :preview-src-list="previewUrls"
        :initial-index="0"
        fit="cover"
        preview-teleported
      />
      <div v-else class="cover-empty" aria-label="暂无产品主图">
        <el-icon :size="24"><Picture /></el-icon>
      </div>
      <span v-if="productImages.length > 1" class="image-count">{{ productImages.length }}</span>
    </div>

    <div class="product-summary">
      <div class="product-heading">
        <strong>{{ record.styleNumber || '未填写货号' }}</strong>
        <span class="sequence">#{{ String(record.storeSeq || 0).padStart(3, '0') }}</span>
      </div>
      <div class="product-meta">
        <span>店铺 {{ record.store || '-' }}</span>
        <span>策划 {{ record.plannerName || '-' }}</span>
        <span>产品 ID {{ record.productId || '-' }}</span>
        <SourceTaskLink
          :source-task-id="record.sourceTaskId"
          :source-task-no="record.sourceTaskNo"
        />
      </div>
      <div class="product-metrics">
        <span>毛利 <strong>{{ grossMarginText }}</strong></span>
        <span>选品日期 {{ record.selectionDate || '-' }}</span>
      </div>
    </div>

    <div class="workflow-summary">
      <div v-if="record.managerReviewPending" class="pending-review-summary">
        <el-tag type="danger" effect="light">第二阶段 · 待店长审核</el-tag>
      </div>
      <div v-if="record.processStatus === 'ended'" class="end-summary">
        <strong>结束于：{{ stageLabel(record.endStage) }}</strong>
        <span>{{ record.endReason || '流程已结束' }}</span>
      </div>
      <div class="timeline-scroll">
        <StageTimeline
          :stages="record.stages"
          :current-stage="record.currentStage"
          :end-stage="record.endStage"
          :link-status="record.linkStatus"
          :readonly="record.processStatus === 'ended'"
          @select="emit('select-stage', $event)"
        />
      </div>
    </div>

    <div class="card-actions">
      <slot name="actions" :record="record">
        <el-button
          v-if="record.processStatus === 'in_progress'"
          type="primary"
          :plain="record.managerReviewPending"
          :icon="record.managerReviewPending ? View : EditPen"
          @click="emit('continue')"
        >{{ record.managerReviewPending ? '查看记录' : '继续填写' }}</el-button>
        <el-button
          v-else
          type="primary"
          plain
          :icon="View"
          @click="emit('select-stage', endedStage)"
        >查看记录</el-button>
        <el-button
          v-if="record.allowedActions?.restore"
          :icon="RefreshRight"
          @click="emit('restore')"
        >恢复流程</el-button>
        <el-button
          v-if="record.allowedActions?.delete"
          type="danger"
          plain
          :icon="Delete"
          @click="emit('delete')"
        >删除</el-button>
      </slot>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { Delete, EditPen, Picture, RefreshRight, View } from '@element-plus/icons-vue'
import { getPaymentImageUrl } from '@/api'
import { PAYMENT_STAGE_BY_CODE } from '@/config/payment-tracking'
import StageTimeline from './StageTimeline.vue'
import SourceTaskLink from './SourceTaskLink.vue'

const props = defineProps({
  record: { type: Object, required: true }
})

const emit = defineEmits(['continue', 'restore', 'delete', 'select-stage'])

const productImages = computed(() => (props.record.images || []).filter(image => image.category === 'product_main'))
const previewUrls = computed(() => productImages.value.map(getPaymentImageUrl))
const grossMarginText = computed(() => {
  const value = props.record.grossMargin
  return value === null || value === undefined ? '-' : `${(Number(value) * 100).toFixed(2)}%`
})
const endedStage = computed(() => (
  props.record.stages?.find(stage => stage.stageCode === props.record.endStage)
  || props.record.stages?.at(-1)
  || { stageCode: props.record.currentStage }
))

function stageLabel(code) {
  return PAYMENT_STAGE_BY_CODE[code]?.label || code || '-'
}
</script>

<style scoped>
.product-row-card {
  display: grid;
  grid-template-columns: 72px minmax(210px, 0.8fr) minmax(360px, 2fr) 118px;
  align-items: center;
  gap: 16px;
  min-height: 112px;
  padding: 16px;
  border: 1px solid var(--dd-border-light, #e4e7ed);
  border-radius: 7px;
  background: var(--dd-bg-card, #fff);
}

.cover-wrap {
  position: relative;
  width: 72px;
  height: 72px;
}

.cover-image,
.cover-empty {
  width: 72px;
  height: 72px;
  border-radius: 6px;
  border: 1px solid var(--dd-border-light, #e4e7ed);
}

.cover-image {
  cursor: zoom-in;
}

.cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a8abb2;
  background: #f5f7fa;
}

.image-count {
  position: absolute;
  right: 4px;
  bottom: 4px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 10px;
  background: rgba(31, 41, 55, 0.82);
  color: #fff;
  font-size: 11px;
  line-height: 20px;
  text-align: center;
}

.product-summary,
.workflow-summary {
  min-width: 0;
}

.product-heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
}

.product-heading strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--dd-text-primary, #303133);
  font-size: 16px;
}

.sequence {
  color: var(--dd-text-secondary, #909399);
  font-size: 12px;
  white-space: nowrap;
}

.product-meta,
.product-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 5px 12px;
  color: var(--dd-text-secondary, #909399);
  font-size: 12px;
  line-height: 1.5;
}

.product-metrics {
  margin-top: 4px;
  color: var(--dd-text-regular, #606266);
}

.timeline-scroll {
  max-width: 100%;
  overflow-x: auto;
  padding: 2px 0 5px;
}

.end-summary {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 9px;
  color: #9a6417;
  font-size: 13px;
}

.pending-review-summary {
  margin-bottom: 8px;
}

.end-summary span {
  color: var(--dd-text-regular, #606266);
  overflow-wrap: anywhere;
}

.card-actions {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.card-actions :deep(.el-button) {
  width: 100%;
  margin-left: 0;
}

@media (max-width: 1180px) {
  .product-row-card {
    grid-template-columns: 72px minmax(190px, 1fr) 118px;
  }

  .workflow-summary {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}

@media (max-width: 720px) {
  .product-row-card {
    grid-template-columns: 64px minmax(0, 1fr);
    gap: 12px;
    padding: 12px;
  }

  .cover-wrap,
  .cover-image,
  .cover-empty {
    width: 64px;
    height: 64px;
  }

  .workflow-summary,
  .card-actions {
    grid-column: 1 / -1;
  }

  .card-actions {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .card-actions :deep(.el-button) {
    width: auto;
    flex: 1 1 112px;
  }

  .end-summary {
    align-items: flex-start;
    flex-direction: column;
    gap: 3px;
  }
}
</style>
