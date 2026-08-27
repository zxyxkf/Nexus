<template>
  <el-form ref="formRef" :model="model" :rules="rules" label-position="top" class="stage-form">
    <section class="form-section">
      <h2>打爆动作</h2>
      <div class="form-grid">
        <el-form-item label="补坑产第一天">
          <el-input-number v-model="model.pitOutputDay1" :min="0" :precision="2" :controls="false" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="补坑产第二天">
          <el-input-number v-model="model.pitOutputDay2" :min="0" :precision="2" :controls="false" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="补坑产第三天">
          <el-input-number v-model="model.pitOutputDay3" :min="0" :precision="2" :controls="false" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="进秒杀时间">
          <el-date-picker v-model="model.flashSaleAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="进超级打爆或极速爆单时间" class="span-2">
          <el-date-picker v-model="model.superBreakoutAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="商品速爆时间">
          <el-date-picker v-model="model.rapidBreakoutAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="是否符合强拉升标准" prop="strongLiftQualified">
          <el-radio-group v-model="model.strongLiftQualified" :disabled="readonly">
            <el-radio :value="true">是</el-radio>
            <el-radio :value="false">否</el-radio>
          </el-radio-group>
        </el-form-item>
      </div>
    </section>

    <section v-if="model.strongLiftQualified === true" class="form-section">
      <h2>强拉升数据</h2>
      <div class="form-grid">
        <el-form-item label="搜索涨幅趋势">
          <el-select v-model="model.searchGrowthTrend" clearable :disabled="readonly">
            <el-option v-for="item in TREND_OPTIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="付款人数趋势">
          <el-select v-model="model.payerTrend" clearable :disabled="readonly">
            <el-option v-for="item in TREND_OPTIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="当前预算">
          <el-input-number v-model="model.currentBudget" :min="0" :precision="2" :controls="false" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="当前费比（7天）">
          <div class="number-with-unit">
            <el-input-number v-model="model.feeRatio7d" :min="0" :precision="2" :controls="false" :disabled="readonly" />
            <span>%</span>
          </div>
        </el-form-item>
        <el-form-item label="当前付款人数（7天）">
          <el-input-number v-model="model.payers7d" :min="0" :precision="0" :controls="false" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="调整日期">
          <el-date-picker v-model="model.adjustedAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="总预算">
          <el-input-number v-model="model.totalBudget" :min="0" :precision="2" :controls="false" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="投产 / 调整细节" class="span-2">
          <el-input v-model="model.detailText" type="textarea" :rows="4" :disabled="readonly" maxlength="2000" />
        </el-form-item>
        <el-form-item label="3-5天后数据反馈" class="span-2">
          <el-input v-model="model.feedbackText" type="textarea" :rows="4" :disabled="readonly" maxlength="2000" />
        </el-form-item>
      </div>
    </section>
  </el-form>
</template>

<script setup>
import { ref } from 'vue'
import { TREND_OPTIONS } from '@/config/payment-tracking'

const model = defineModel({ type: Object, required: true })
defineProps({ readonly: Boolean })
const formRef = ref(null)

const rules = {
  strongLiftQualified: [{ required: true, message: '请选择是否符合强拉升标准', trigger: 'change' }]
}

async function validateForAdvance() {
  await formRef.value.validate()
  return true
}

defineExpose({ validateForAdvance })
</script>

<style scoped>
.form-section {
  padding: 22px 0;
  border-top: 1px solid var(--dd-border-light, #e4e7ed);
}

.form-section:first-child {
  padding-top: 4px;
  border-top: 0;
}

h2 {
  margin: 0 0 16px;
  font-size: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0 18px;
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

:deep(.el-input-number),
:deep(.el-date-editor.el-input),
:deep(.el-select) {
  width: 100%;
}

@media (max-width: 1100px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }

  .span-2 {
    grid-column: auto;
  }
}
</style>
