<template>
  <el-form ref="formRef" :model="model" label-position="top" class="stage-form">
    <section class="form-section">
      <h2>链接优化</h2>
      <div class="link-optimization-layout">
        <div class="link-optimization-fields">
          <el-form-item label="是否做链接优化">
            <el-radio-group v-model="model.linkOptimized" :disabled="readonly">
              <el-radio :value="true">是</el-radio>
              <el-radio :value="false">否</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="model.linkOptimized === true" label="链接优化项目" :required="!readonly" class="link-optimization-items">
            <el-select
              v-model="model.linkOptimizationItems"
              multiple
              filterable
              clearable
              collapse-tags
              collapse-tags-tooltip
              :max-collapse-tags="1"
              :disabled="readonly || !linkOptimizationOptions.length"
              :placeholder="linkOptimizationOptions.length ? '请选择链接优化项目' : '暂无可选项目'"
              class="link-optimization-select"
            >
              <el-option v-for="item in linkOptimizationOptions" :key="item.name" :label="item.name" :value="item.name" />
            </el-select>
          </el-form-item>
        </div>
        <ImageGallery
          v-if="model.linkOptimized === true"
          :record-id="record.id"
          :version="record.version"
          :images="record.images"
          :source-task-no="record.sourceTaskNo"
          category="link_optimization"
          label="图片上传区"
          :readonly="readonly"
          @record-updated="emit('record-updated', $event)"
          @reload-requested="emit('reload-requested')"
        />
      </div>
    </section>

    <section class="form-section">
      <h2>链接状态</h2>
      <el-form-item label="当前链接状态">
        <el-radio-group v-model="model.linkStatus" :disabled="readonly">
          <el-radio value="protect_roi">保投产</el-radio>
          <el-radio value="keep_breaking">持续打爆</el-radio>
        </el-radio-group>
      </el-form-item>
    </section>

    <section class="form-section">
      <PromotionAdjustments
        v-model="model.adjustments"
        :record="record"
        :readonly="readonly"
        :prepare-upload="prepareAdjustmentUpload"
        @record-updated="emit('record-updated', $event)"
        @reload-requested="emit('reload-requested')"
      />
    </section>
  </el-form>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { listPaymentLinkOptimizationItemsApi } from '@/api'
import ImageGallery from '@/components/payment-tracking/ImageGallery.vue'
import PromotionAdjustments from '@/components/payment-tracking/PromotionAdjustments.vue'

const model = defineModel({ type: Object, required: true })
defineProps({
  record: { type: Object, required: true },
  readonly: Boolean,
  prepareAdjustmentUpload: { type: Function, required: true }
})
const emit = defineEmits(['record-updated', 'reload-requested'])
const formRef = ref(null)
const configuredLinkOptimizationItems = ref([])
const linkOptimizationOptions = computed(() => {
  const options = new Map(configuredLinkOptimizationItems.value.map(item => [item.name, item]))
  for (const name of model.value.linkOptimizationItems || []) {
    if (!options.has(name)) options.set(name, { name, historical: true })
  }
  return [...options.values()]
})

async function loadLinkOptimizationItems() {
  try {
    const response = await listPaymentLinkOptimizationItemsApi()
    if (response.code === 0) configuredLinkOptimizationItems.value = response.data || []
  } catch (error) {
    console.error('[PaymentTracking] 加载链接优化项目失败:', error)
  }
}

watch(() => model.value.linkOptimized, value => {
  if (value !== true) model.value.linkOptimizationItems = []
})

onMounted(loadLinkOptimizationItems)

function validationError(message) {
  ElMessage.error(message)
  throw new Error(message)
}

function validateForSave() {
  if (model.value.linkOptimized === true && !model.value.linkOptimizationItems?.length) {
    ElMessage.error('请至少选择一个链接优化项目')
    return false
  }
  return true
}

async function validateForAdvance() {
  if (model.value.linkStatus !== 'keep_breaking') {
    validationError('只有持续打爆才能进入总结阶段')
  }
  return true
}

async function validateForEnd() {
  if (model.value.linkStatus !== 'protect_roi') {
    validationError('只有保投产才能结束流程')
  }
  return true
}

defineExpose({ validateForSave, validateForAdvance, validateForEnd })
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

.link-optimization-layout {
  display: grid;
  grid-template-columns: minmax(180px, 0.42fr) minmax(320px, 1fr);
  align-items: start;
  gap: 28px;
  min-width: 0;
}

.link-optimization-fields {
  min-width: 0;
}

.link-optimization-items {
  margin-top: 14px;
}

.link-optimization-select {
  width: 100%;
}

:deep(.el-form-item) {
  margin-bottom: 0;
}

:deep(.el-form-item__label) {
  color: #4b5565;
  font-weight: 600;
}

@media (max-width: 1100px) {
  .link-optimization-layout {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
</style>
