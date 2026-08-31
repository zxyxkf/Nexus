<template>
  <el-form ref="formRef" :model="model" :rules="rules" label-position="top" class="stage-form">
    <section class="form-section">
      <div class="section-heading">
        <h2>店长付费确认</h2>
        <span v-if="!canReview" class="permission-hint">仅店长审核权限可修改</span>
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
            :disabled="readonly || !canReview"
            placeholder="请选择付费时间"
          />
        </el-form-item>
      </div>
    </section>

    <section class="form-section">
      <h2>推广信息</h2>
      <div class="form-grid">
        <el-form-item label="推广方式" prop="promotionMethod" class="span-2">
          <el-select
            v-model="model.promotionMethod"
            clearable
            filterable
            :disabled="readonly"
            :loading="promotionLoading"
            placeholder="请选择推广方式"
          >
            <el-option
              v-for="item in promotionOptions"
              :key="item.id || item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </div>
    </section>

    <section class="form-section">
      <h2>潜力款判断</h2>
      <div class="form-grid">
        <el-form-item label="是否符合潜力款" prop="potentialStatus" class="span-2">
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

    <section class="form-section image-section">
      <h2>潜力款判断图片</h2>
      <ImageGallery
        :record-id="record.id"
        :version="record.version"
        :images="record.images"
        category="potential_judgment"
        label="潜力款判断图片"
        :readonly="readonly"
        @record-updated="emit('record-updated', $event)"
        @reload-requested="emit('reload-requested')"
      />
    </section>
  </el-form>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import ImageGallery from '@/components/payment-tracking/ImageGallery.vue'
import { listPaymentPromotionMethodsApi } from '@/api'
import { UNQUALIFIED_ACTIONS } from '@/config/payment-tracking'

const model = defineModel({ type: Object, required: true })
const props = defineProps({
  record: { type: Object, required: true },
  readonly: Boolean,
  canReview: Boolean
})
const emit = defineEmits(['record-updated', 'reload-requested'])
const formRef = ref(null)
const promotionMethods = ref([])
const promotionLoading = ref(false)

const promotionOptions = computed(() => {
  const options = promotionMethods.value
    .filter(item => item && (item.active === undefined || Number(item.active) === 1))
    .map(item => ({ id: item.id, value: item.name, label: item.name }))
  const current = String(model.value.promotionMethod || '').trim()
  if (current && !options.some(item => item.value === current)) {
    options.unshift({ id: `legacy-${current}`, value: current, label: `${current}（历史方式）` })
  }
  return options
})

async function loadPromotionMethods() {
  promotionLoading.value = true
  try {
    const response = await listPaymentPromotionMethodsApi()
    const rows = Array.isArray(response?.data) ? response.data : response?.data?.list
    if (Array.isArray(rows)) promotionMethods.value = rows
  } catch (error) {
    console.error('[PaymentTracking] 加载推广方式失败:', error)
  } finally {
    promotionLoading.value = false
  }
}

const rules = {
  paidEnabled: [{
    validator: (_rule, value, callback) => value === true
      ? callback()
      : callback(new Error('店长必须确认开启付费')),
    trigger: 'change'
  }],
  paidAt: [{ required: true, message: '请选择付费时间', trigger: 'change' }],
  potentialStatus: [{
    validator: (_rule, value, callback) => value === '符合潜力款标准'
      ? callback()
      : callback(new Error('只有符合潜力款标准才能进入下一阶段')),
    trigger: 'change'
  }]
}

async function validateForAdvance() {
  await formRef.value.validate()
  return true
}

defineExpose({ validateForAdvance })
onMounted(loadPromotionMethods)
</script>

<style scoped>
.stage-form {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.form-section {
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--dd-border-light, #dfe4ec);
  border-radius: 6px;
  background: #fff;
}

.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

h2 {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 0 0 18px;
  color: #253047;
  font-size: 16px;
}

h2::before {
  width: 3px;
  height: 18px;
  border-radius: 2px;
  background: #409eff;
  content: '';
}

.permission-hint {
  margin-bottom: 18px;
  color: var(--dd-text-secondary, #909399);
  font-size: 12px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 20px;
}

.span-2 {
  grid-column: span 2;
}

.image-section h2 {
  margin-bottom: 14px;
}

:deep(.el-date-editor.el-input),
:deep(.el-select) {
  width: 100%;
}

:deep(.el-form-item) {
  margin-bottom: 18px;
}

:deep(.el-form-item__label) {
  color: #4b5565;
  font-weight: 600;
}

@media (max-width: 900px) {
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
