<template>
  <el-form ref="formRef" :model="model" :rules="rules" label-position="top" class="stage-form">
    <section class="form-section">
      <h2>准备工作</h2>
      <div class="form-grid">
        <el-form-item label="评价数量" prop="reviewCount">
          <el-input-number v-model="model.reviewCount" :min="0" :precision="0" :controls="false" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="新品运营报名是否成功">
          <el-radio-group v-model="model.newOpsRegistered" :disabled="readonly">
            <el-radio v-for="item in YES_NO_OPTIONS" :key="String(item.value)" :value="item.value">{{ item.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
      </div>
    </section>

    <section class="form-section">
      <div class="section-heading">
        <h2>店长付费确认</h2>
        <el-tag v-if="!canReview" type="info" effect="plain">仅店长审核权限可修改</el-tag>
      </div>
      <div class="form-grid">
        <el-form-item label="确认开启付费" prop="paidEnabled">
          <el-radio-group v-model="model.paidEnabled" :disabled="readonly || !canReview">
            <el-radio :value="true">是</el-radio>
            <el-radio :value="false">否</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="付费时间" prop="paidAt">
          <el-date-picker
            v-model="model.paidAt"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            :disabled="readonly || !canReview || model.paidEnabled !== true"
          />
        </el-form-item>
      </div>
    </section>
  </el-form>
</template>

<script setup>
import { ref } from 'vue'
import { YES_NO_OPTIONS } from '@/config/payment-tracking'

const model = defineModel({ type: Object, required: true })
defineProps({
  readonly: Boolean,
  canReview: Boolean
})
const formRef = ref(null)

const rules = {
  reviewCount: [{ type: 'integer', min: 0, message: '请输入非负整数', trigger: 'change' }],
  paidEnabled: [{
    validator: (_rule, value, callback) => value === true
      ? callback()
      : callback(new Error('店长必须确认开启付费')),
    trigger: 'change'
  }],
  paidAt: [{
    validator: (_rule, value, callback) => model.value.paidEnabled === true && !value
      ? callback(new Error('请选择付费时间'))
      : callback(),
    trigger: 'change'
  }]
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

.section-heading {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
  max-width: 760px;
}

:deep(.el-input-number),
:deep(.el-date-editor.el-input) {
  width: 100%;
}

@media (max-width: 640px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
}
</style>
