<template>
  <el-form ref="formRef" :model="model" :rules="rules" label-position="top" class="stage-form">
    <div class="testing-grid">
      <section class="form-section testing-section">
        <h2>直通车测点率</h2>
        <el-form-item label="推广方式">
          <el-input v-model="model.carPromotionMethod" :disabled="readonly" maxlength="100" />
        </el-form-item>
        <div class="field-pair">
          <el-form-item label="点击量">
            <el-input-number v-model="model.carClicks" :min="0" :precision="0" :controls="false" :disabled="readonly" />
          </el-form-item>
          <el-form-item label="点击率">
            <div class="number-with-unit">
              <el-input-number v-model="model.carCtr" :min="0" :precision="2" :controls="false" :disabled="readonly" />
              <span>%</span>
            </div>
          </el-form-item>
        </div>
        <el-form-item label="是否符合直通车测试标准">
          <el-radio-group v-model="model.carQualifies" :disabled="readonly">
            <el-radio :value="true">是</el-radio>
            <el-radio :value="false">否</el-radio>
          </el-radio-group>
        </el-form-item>
      </section>

      <section class="form-section testing-section">
        <h2>全站推广</h2>
        <el-form-item label="推广方式">
          <el-input v-model="model.sitePromotionMethod" :disabled="readonly" maxlength="100" />
        </el-form-item>
        <div class="field-pair">
          <el-form-item label="整体访客数">
            <el-input-number v-model="model.overallVisitors" :min="0" :precision="0" :controls="false" :disabled="readonly" />
          </el-form-item>
          <el-form-item label="搜索访客数">
            <el-input-number v-model="model.searchVisitors" :min="0" :precision="0" :controls="false" :disabled="readonly" />
          </el-form-item>
          <el-form-item label="搜索访客占比">
            <el-input :model-value="searchShareText" disabled />
          </el-form-item>
          <el-form-item label="付款人数">
            <el-input-number v-model="model.buyers" :min="0" :precision="0" :controls="false" :disabled="readonly" />
          </el-form-item>
          <el-form-item label="平均点击率">
            <div class="number-with-unit">
              <el-input-number v-model="model.averageCtr" :min="0" :precision="2" :controls="false" :disabled="readonly" />
              <span>%</span>
            </div>
          </el-form-item>
        </div>
      </section>
    </div>

    <section class="form-section result-section">
      <h2>潜力款判断</h2>
      <div class="result-grid">
        <el-form-item label="是否符合潜力款" prop="potentialStatus">
          <el-radio-group v-model="model.potentialStatus" :disabled="readonly">
            <el-radio value="符合潜力款标准">符合潜力款标准</el-radio>
            <el-radio value="不符合">不符合</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="model.potentialStatus === '不符合'" label="不符合后续操作">
          <el-select v-model="model.unqualifiedAction" :disabled="readonly" clearable placeholder="可选">
            <el-option v-for="item in UNQUALIFIED_ACTIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="店长提报日期">
          <el-date-picker v-model="model.managerReportDate" type="date" value-format="YYYY-MM-DD" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="微库存是否提报">
          <el-radio-group v-model="model.weiStockReported" :disabled="readonly">
            <el-radio :value="true">是</el-radio>
            <el-radio :value="false">否</el-radio>
          </el-radio-group>
        </el-form-item>
      </div>
    </section>
  </el-form>
</template>

<script setup>
import { computed, ref } from 'vue'
import { UNQUALIFIED_ACTIONS } from '@/config/payment-tracking'

const model = defineModel({ type: Object, required: true })
defineProps({ readonly: Boolean })
const formRef = ref(null)

const rules = {
  potentialStatus: [{
    validator: (_rule, value, callback) => value === '符合潜力款标准'
      ? callback()
      : callback(new Error('只有符合潜力款标准才能进入下一阶段')),
    trigger: 'change'
  }]
}

const searchShareText = computed(() => {
  const total = Number(model.value.overallVisitors)
  const search = Number(model.value.searchVisitors)
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(search)) return '-'
  return `${((search / total) * 100).toFixed(2)}%`
})

async function validateForAdvance() {
  await formRef.value.validate()
  return true
}

defineExpose({ validateForAdvance })
</script>

<style scoped>
.testing-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.form-section {
  min-width: 0;
  padding: 20px 0;
  border-top: 1px solid var(--dd-border-light, #e4e7ed);
}

.testing-section {
  padding-top: 4px;
  border-top: 0;
}

h2 {
  margin: 0 0 16px;
  font-size: 16px;
}

.field-pair,
.result-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

.result-section {
  margin-top: 4px;
}

.result-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.number-with-unit {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 28px;
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
  .testing-grid,
  .result-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .testing-grid,
  .field-pair,
  .result-grid {
    grid-template-columns: 1fr;
  }
}
</style>
