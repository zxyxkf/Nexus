<template>
  <el-form ref="formRef" :model="model" :rules="rules" label-position="top" class="stage-form">
    <section class="form-section">
      <h2>基础信息</h2>
      <div class="form-grid">
        <el-form-item label="店铺序号">
          <el-input :model-value="`#${String(record.storeSeq || 0).padStart(3, '0')}`" disabled />
        </el-form-item>
        <el-form-item label="策划人">
          <el-input :model-value="record.plannerName || '-'" disabled />
        </el-form-item>
        <el-form-item label="选品日期" prop="selectionDate">
          <el-date-picker v-model="model.selectionDate" type="date" value-format="YYYY-MM-DD" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="货号" prop="styleNumber">
          <el-input v-model="model.styleNumber" :disabled="readonly" maxlength="100" />
        </el-form-item>
        <el-form-item label="成本" prop="cost">
          <el-input-number v-model="model.cost" :min="0" :precision="2" :controls="false" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="售价" prop="salePrice">
          <el-input-number v-model="model.salePrice" :min="0" :precision="2" :controls="false" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="毛利">
          <el-input :model-value="grossMarginText" disabled />
        </el-form-item>
        <el-form-item label="产品 ID" prop="productId">
          <el-input v-model="model.productId" :disabled="readonly" maxlength="100" />
        </el-form-item>
      </div>
    </section>

    <section class="form-section">
      <h2>选品及上架</h2>
      <div class="form-grid">
        <el-form-item label="选品方式" prop="selectionMethod" class="span-2">
          <el-select v-model="model.selectionMethod" :disabled="readonly" placeholder="请选择选品方式">
            <el-option v-for="item in SELECTION_METHODS" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="上架日期" prop="listingDate">
          <el-date-picker v-model="model.listingDate" type="date" value-format="YYYY-MM-DD" :disabled="readonly" />
        </el-form-item>
        <el-form-item label="上架类目" prop="listingCategory">
          <el-input v-model="model.listingCategory" :disabled="readonly" maxlength="100" />
        </el-form-item>
        <el-form-item label="通过并设计主图">
          <el-checkbox v-model="model.designMainImage" :disabled="readonly">通过并设计主图</el-checkbox>
        </el-form-item>
        <el-form-item label="SKU 数是否不超过 200" prop="skuLe200">
          <el-radio-group v-model="model.skuLe200" :disabled="readonly">
            <el-radio :value="true">是</el-radio>
            <el-radio :value="false">否</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="详细说明" class="span-2">
          <el-input v-model="model.detailText" type="textarea" :rows="4" :disabled="readonly" maxlength="2000" show-word-limit />
        </el-form-item>
      </div>
    </section>

    <section class="form-section image-sections">
      <h2>图片资料</h2>
      <ImageGallery
        :record-id="record.id"
        :version="record.version"
        :images="record.images"
        category="product_main"
        label="产品主图"
        :readonly="readonly"
        @record-updated="emit('record-updated', $event)"
        @reload-requested="emit('reload-requested')"
      />
      <ImageGallery
        :record-id="record.id"
        :version="record.version"
        :images="record.images"
        category="detail_screenshot"
        label="说明截图"
        :readonly="readonly"
        @record-updated="emit('record-updated', $event)"
        @reload-requested="emit('reload-requested')"
      />
      <ImageGallery
        :record-id="record.id"
        :version="record.version"
        :images="record.images"
        category="competitor"
        label="竞品主图"
        :readonly="readonly"
        @record-updated="emit('record-updated', $event)"
        @reload-requested="emit('reload-requested')"
      />
    </section>
  </el-form>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ImageGallery from '@/components/payment-tracking/ImageGallery.vue'
import { SELECTION_METHODS } from '@/config/payment-tracking'

const model = defineModel({ type: Object, required: true })
const props = defineProps({
  record: { type: Object, required: true },
  readonly: Boolean
})
const emit = defineEmits(['record-updated', 'reload-requested'])
const formRef = ref(null)

const positivePrice = (_rule, value, callback) => {
  if (value === null || value === undefined || Number(value) <= 0) callback(new Error('售价必须大于 0'))
  else callback()
}
const nonNegative = (_rule, value, callback) => {
  if (value === null || value === undefined || Number(value) < 0) callback(new Error('请输入非负数字'))
  else callback()
}

const rules = {
  selectionDate: [{ required: true, message: '请选择选品日期', trigger: 'change' }],
  styleNumber: [{ required: true, message: '请填写货号', trigger: 'blur' }],
  cost: [{ validator: nonNegative, trigger: 'change' }],
  salePrice: [{ validator: positivePrice, trigger: 'change' }],
  productId: [{ required: true, message: '请填写产品 ID', trigger: 'blur' }],
  selectionMethod: [{ required: true, message: '请选择选品方式', trigger: 'change' }],
  skuLe200: [{ required: true, message: '请选择 SKU 数是否不超过 200', trigger: 'change' }],
  listingDate: [{ required: true, message: '请选择上架日期', trigger: 'change' }],
  listingCategory: [{ required: true, message: '请填写上架类目', trigger: 'blur' }]
}

const grossMarginText = computed(() => {
  const cost = Number(model.value.cost)
  const salePrice = Number(model.value.salePrice)
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(salePrice) || salePrice <= 0) return '-'
  return `${(((salePrice - cost) / salePrice) * 100).toFixed(2)}%`
})

async function validateForAdvance() {
  await formRef.value.validate()
  const hasProductImage = props.record.images?.some(image => image.category === 'product_main')
  if (!hasProductImage) {
    ElMessage.error('至少上传一张产品主图')
    throw new Error('至少上传一张产品主图')
  }
  return true
}

defineExpose({ validateForAdvance })
</script>

<style scoped>
.stage-form,
.form-section {
  min-width: 0;
}

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

.image-sections {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
}

.image-sections h2 {
  grid-column: 1 / -1;
  margin-bottom: -2px;
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

  .image-sections {
    grid-template-columns: 1fr;
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
