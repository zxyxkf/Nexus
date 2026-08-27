<template>
  <el-form ref="formRef" :model="model" :rules="rules" label-position="top" class="stage-form">
    <section class="form-section">
      <h2>运营动作</h2>
      <div class="form-grid">
        <el-form-item label="改内销件数">
          <el-input-number v-model="model.domesticSalesCount" :min="0" :precision="0" :controls="false" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="补评价条数">
          <el-input-number v-model="model.addedReviews" :min="0" :precision="0" :controls="false" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="标题优化时间">
          <el-date-picker v-model="model.titleOptimizedAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="问大家数量">
          <el-input-number v-model="model.qaCount" :min="0" :precision="0" :controls="false" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="详情页优化时间">
          <el-date-picker v-model="model.detailOptimizedAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="素材是否精选">
          <el-radio-group v-model="model.materialSelected" :disabled="readonly">
            <el-radio :value="true">是</el-radio>
            <el-radio :value="false">否</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="SKU 优化时间">
          <el-date-picker v-model="model.skuOptimizedAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="营销活动名称">
          <el-select v-model="model.campaignName" clearable :disabled="readonly" placeholder="可选">
            <el-option v-for="item in MARKETING_CAMPAIGNS" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="让利比例">
          <el-select v-model="model.concessionRate" clearable :disabled="readonly" placeholder="可选">
            <el-option
              v-for="item in CONCESSION_RATES"
              :key="item"
              :label="item"
              :value="item"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="20天内新品运营快速冲顶是否完成" class="span-2">
          <el-radio-group v-model="model.quickPeakDone" :disabled="readonly">
            <el-radio :value="true">是</el-radio>
            <el-radio :value="false">否</el-radio>
          </el-radio-group>
        </el-form-item>
      </div>
    </section>

    <section class="form-section">
      <h2>阶段判断</h2>
      <div class="form-grid branch-grid">
        <el-form-item label="潜力款后是否放弃">
          <el-radio-group v-model="model.abandoned" :disabled="readonly">
            <el-radio :value="true">放弃</el-radio>
            <el-radio :value="false">继续</el-radio>
          </el-radio-group>
        </el-form-item>
        <template v-if="model.abandoned === true">
          <el-form-item label="放弃原因" prop="abandonReason" class="span-2">
            <el-input v-model="model.abandonReason" :disabled="readonly" maxlength="500" />
          </el-form-item>
          <el-form-item label="放弃时间" prop="abandonAt">
            <el-date-picker v-model="model.abandonAt" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" :disabled="readonly" />
          </el-form-item>
        </template>
      </div>
    </section>

    <section class="form-section">
      <PromotionAdjustments v-model="model.adjustments" :readonly="readonly" />
    </section>
  </el-form>
</template>

<script setup>
import { ref } from 'vue'
import PromotionAdjustments from '@/components/payment-tracking/PromotionAdjustments.vue'
import { CONCESSION_RATES, MARKETING_CAMPAIGNS } from '@/config/payment-tracking'

const model = defineModel({ type: Object, required: true })
defineProps({ readonly: Boolean })
const formRef = ref(null)

const rules = {
  abandonReason: [{
    validator: (_rule, value, callback) => model.value.abandoned === true && !String(value || '').trim()
      ? callback(new Error('请填写放弃原因'))
      : callback(),
    trigger: 'blur'
  }],
  abandonAt: [{
    validator: (_rule, value, callback) => model.value.abandoned === true && !value
      ? callback(new Error('请选择放弃时间'))
      : callback(),
    trigger: 'change'
  }]
}

async function validateForAdvance() {
  if (model.value.abandoned === true) throw new Error('潜力款后放弃不能进入下一阶段')
  return true
}

async function validateForEnd() {
  await formRef.value.validate()
  return true
}

defineExpose({ validateForAdvance, validateForEnd })
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
