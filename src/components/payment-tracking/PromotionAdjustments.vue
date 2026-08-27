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
        :key="item.id || `new-${index}`"
        :name="index"
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
          <el-form-item label="当前费比（7天）">
            <div class="number-with-unit">
              <el-input-number v-model="item.feeRatio7d" :min="0" :precision="2" :controls="false" :disabled="readonly" />
              <span>%</span>
            </div>
          </el-form-item>
          <el-form-item label="当前付款人数（7天）">
            <el-input-number v-model="item.payers7d" :min="0" :precision="0" :controls="false" :disabled="readonly" />
          </el-form-item>
          <el-form-item label="总预算">
            <el-input-number v-model="item.totalBudget" :min="0" :precision="2" :controls="false" :disabled="readonly" />
          </el-form-item>
          <el-form-item label="投产 / 调整细节" class="span-2">
            <el-input v-model="item.detailText" type="textarea" :rows="3" :disabled="readonly" maxlength="2000" />
          </el-form-item>
          <el-form-item label="3-5天后数据反馈" class="span-2">
            <el-input v-model="item.feedbackText" type="textarea" :rows="3" :disabled="readonly" maxlength="2000" />
          </el-form-item>
        </div>

        <div v-if="!readonly && !item.id" class="adjustment-actions">
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

const model = defineModel({ type: Array, required: true })
defineProps({ readonly: Boolean })
const activeNames = ref([])

function addAdjustment() {
  const index = model.value.length
  model.value.push({
    sortOrder: index,
    reason: '',
    adjustedAt: null,
    feeRatio7d: null,
    payers7d: null,
    totalBudget: null,
    detailText: '',
    feedbackText: ''
  })
  activeNames.value = [...new Set([...activeNames.value, index])]
}

function removeAdjustment(index) {
  model.value.splice(index, 1)
  model.value.forEach((item, itemIndex) => { item.sortOrder = itemIndex })
  activeNames.value = activeNames.value.filter(name => name !== index)
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 16px;
  padding: 6px 2px 0;
}

.span-2 {
  grid-column: span 2;
}

.number-with-unit {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24px;
  align-items: center;
  width: 100%;
}

.number-with-unit span {
  text-align: right;
  color: var(--dd-text-secondary, #909399);
}

.adjustment-actions {
  justify-content: flex-end;
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

:deep(.el-input-number),
:deep(.el-date-editor.el-input) {
  width: 100%;
}

@media (max-width: 900px) {
  .adjustment-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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
