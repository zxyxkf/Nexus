<template>
  <div class="promotion-adjustments">
    <div class="adjustment-header">
      <div>
        <h2>推广调整</h2>
        <span>{{ model.length }} 次</span>
      </div>
      <el-button v-if="!readonly" type="primary" plain size="small" :icon="Plus" @click="addAdjustment">新增调整</el-button>
    </div>

    <el-collapse v-if="model.length" v-model="activeNames">
      <el-collapse-item
        v-for="(item, index) in model"
        :key="item.clientKey"
        :name="item.clientKey"
      >
        <template #title>
          <div class="adjustment-title">
            <strong>第 {{ index + 1 }} 次调整</strong>
            <span>{{ item.adjustedAt || '未填写日期' }}</span>
            <span>{{ item.reason || '未填写原因' }}</span>
          </div>
        </template>

        <div class="adjustment-fields">
          <el-form-item label="调整原因">
            <el-input v-model="item.reason" :disabled="readonly" maxlength="200" />
          </el-form-item>
          <el-form-item label="调整日期">
            <el-date-picker
              v-model="item.adjustedAt"
              type="datetime"
              value-format="YYYY-MM-DD HH:mm:ss"
              :disabled="readonly"
            />
          </el-form-item>
          <el-form-item label="操作概述" class="span-2">
            <el-input v-model="item.detailText" type="textarea" :rows="3" :disabled="readonly" maxlength="2000" />
          </el-form-item>
          <el-form-item label="备注" class="span-2">
            <el-input v-model="item.feedbackText" type="textarea" :rows="3" :disabled="readonly" maxlength="2000" />
          </el-form-item>
        </div>

        <ImageGallery
          :record-id="record.id"
          :version="record.version"
          :images="record.images"
          category="adjustment_feedback"
          label="数据反馈"
          :owner-id="item.id"
          :before-upload="item.id ? null : () => prepareUpload(item.clientKey)"
          :readonly="readonly"
          @record-updated="emit('record-updated', $event)"
          @reload-requested="emit('reload-requested')"
        />

        <div v-if="!readonly" class="adjustment-actions">
          <el-button type="danger" plain size="small" :icon="Delete" @click="removeAdjustment(index)">删除本次调整</el-button>
        </div>
      </el-collapse-item>
    </el-collapse>
    <div v-else class="adjustment-empty">暂无推广调整</div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'
import ImageGallery from './ImageGallery.vue'

const model = defineModel({ type: Array, required: true })
defineProps({
  record: { type: Object, required: true },
  readonly: Boolean,
  prepareUpload: { type: Function, required: true }
})
const emit = defineEmits(['record-updated', 'reload-requested'])
const activeNames = ref([])

function newClientKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `adjustment-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function addAdjustment() {
  const clientKey = newClientKey()
  model.value.push({
    id: null,
    clientKey,
    reason: '',
    adjustedAt: null,
    detailText: '',
    feedbackText: ''
  })
  activeNames.value = [...new Set([...activeNames.value, clientKey])]
}

function removeAdjustment(index) {
  const [removed] = model.value.splice(index, 1)
  activeNames.value = activeNames.value.filter(name => name !== removed?.clientKey)
}
</script>

<style scoped>
.promotion-adjustments {
  min-width: 0;
}

.adjustment-header,
.adjustment-header > div,
.adjustment-title,
.adjustment-actions {
  display: flex;
  align-items: center;
}

.adjustment-header {
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.adjustment-header > div {
  align-items: baseline;
  gap: 8px;
}

h2 {
  margin: 0;
  font-size: 16px;
}

.adjustment-header span,
.adjustment-title span,
.adjustment-empty {
  color: var(--dd-text-secondary, #909399);
  font-size: 12px;
}

.adjustment-title {
  gap: 10px;
  min-width: 0;
  overflow: hidden;
}

.adjustment-title span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.adjustment-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
  padding: 6px 2px 0;
}

.span-2 {
  grid-column: span 2;
}

.adjustment-actions {
  justify-content: flex-end;
  padding-top: 12px;
  padding-bottom: 12px;
}

.adjustment-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72px;
  border: 1px dashed var(--dd-border, #dcdfe6);
  border-radius: 6px;
}

:deep(.el-date-editor.el-input) {
  width: 100%;
}

@media (max-width: 640px) {
  .adjustment-fields {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: auto;
  }
}
</style>
