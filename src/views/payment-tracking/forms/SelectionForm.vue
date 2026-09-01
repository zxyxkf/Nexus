<template>
  <el-form ref="formRef" :model="model" :rules="rules" label-position="top" class="stage-form">
    <section class="form-section">
      <h2>基础信息</h2>
      <div class="form-grid">
        <el-form-item label="选品日期" prop="selectionDate">
          <el-date-picker
            v-if="record.sourceTaskId"
            v-model="model.selectionDate"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm:ss"
            disabled
          />
          <el-date-picker
            v-else
            v-model="model.selectionDate"
            type="date"
            value-format="YYYY-MM-DD"
            :disabled="readonly"
          />
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
          <el-select
            v-model="model.listingCategory"
            :disabled="readonly"
            :loading="categoryLoading"
            filterable
            placeholder="请选择上架类目"
          >
            <el-option
              v-for="item in categoryOptions"
              :key="item.id || item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
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
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import ImageGallery from '@/components/payment-tracking/ImageGallery.vue'
import { SELECTION_METHODS } from '@/config/payment-tracking'
import { listPaymentListingCategoriesApi } from '@/api'

const model = defineModel({ type: Object, required: true })
const props = defineProps({
  record: { type: Object, required: true },
  readonly: Boolean
})
const emit = defineEmits(['record-updated', 'reload-requested'])
const formRef = ref(null)
const listingCategories = ref([])
const categoryLoading = ref(false)

const categoryOptions = computed(() => {
  const options = listingCategories.value
    .filter(item => item && (item.active === undefined || Number(item.active) === 1))
    .map(item => ({
      id: item.id,
      value: item.name,
      label: item.name
    }))
  const current = String(model.value.listingCategory || '').trim()
  if (current && !options.some(item => item.value === current)) {
    options.unshift({ id: `legacy-${current}`, value: current, label: `${current}（历史类目）` })
  }
  return options
})

async function loadListingCategories() {
  categoryLoading.value = true
  try {
    const response = await listPaymentListingCategoriesApi()
    const rows = Array.isArray(response?.data) ? response.data : response?.data?.list
    if (Array.isArray(rows)) listingCategories.value = rows
  } catch (error) {
    console.error('[PaymentTracking] 加载上架类目失败:', error)
  } finally {
    categoryLoading.value = false
  }
}

const positivePrice = (_rule, value, callback) => {
  if (value === null || value === undefined || value === '') return callback()
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) return callback(new Error('售价必须大于 0'))
  callback()
}
const nonNegative = (_rule, value, callback) => {
  if (value === null || value === undefined || value === '') return callback()
  if (!Number.isFinite(Number(value)) || Number(value) < 0) return callback(new Error('请输入非负数字'))
  callback()
}

const rules = {
  selectionDate: [{ required: true, message: '请选择选品日期', trigger: 'change' }],
  styleNumber: [{ required: true, message: '请填写货号', trigger: 'blur' }],
  cost: [{ validator: nonNegative, trigger: 'change' }],
  salePrice: [{ validator: positivePrice, trigger: 'change' }],
  productId: [{ required: true, message: '请填写产品 ID', trigger: 'blur' }],
  selectionMethod: [{ required: true, message: '请选择选品方式', trigger: 'change' }],
  listingDate: [{ required: true, message: '请选择上架日期', trigger: 'change' }],
  listingCategory: [{ required: true, message: '请填写上架类目', trigger: 'blur' }]
}

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

onMounted(loadListingCategories)
</script>

<style scoped>
.stage-form,
.form-section {
  min-width: 0;
}

.form-section {
  padding: 20px;
  border: 1px solid var(--dd-border-light, #dfe4ec);
  border-radius: 6px;
  background: #fff;
}

.form-section:first-child {
  padding-top: 20px;
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

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 20px;
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

:deep(.el-form-item) {
  margin-bottom: 18px;
}

:deep(.el-form-item__label) {
  color: #4b5565;
  font-weight: 600;
}

:deep(.el-input__wrapper),
:deep(.el-textarea__inner),
:deep(.el-select__wrapper) {
  border-radius: 5px;
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
