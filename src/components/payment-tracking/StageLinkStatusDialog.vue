<template>
  <el-dialog
    v-model="visible"
    title="链接状态"
    width="560px"
    align-center
    append-to-body
    destroy-on-close
    class="link-status-dialog"
  >
    <div class="dialog-scroll">
      <section class="status-section">
        <div class="status-row">
          <div>
            <strong>是否报名秒杀</strong>
            <span>选择后记录当前阶段的秒杀状态</span>
          </div>
          <el-radio-group
            v-model="form.flashSaleRegistered"
            class="compact-choice"
            :disabled="readonly"
            @change="handleParentChange('flashSaleRegistered')"
          >
            <el-radio-button :value="true">是</el-radio-button>
            <el-radio-button :value="false">否</el-radio-button>
          </el-radio-group>
        </div>
        <template v-if="form.flashSaleRegistered === true">
          <el-form-item label="秒杀类型" required>
            <el-radio-group v-model="form.flashSaleGroup" :disabled="readonly" @change="clearRequested = false">
              <el-radio-button value="new_product_cold_start">新品冷启团</el-radio-button>
              <el-radio-button value="potential_breakout">潜力打爆团</el-radio-button>
              <el-radio-button value="bestseller_sustain">爆品续航团</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <div class="status-row child-row">
            <strong>是否进入极速爆单</strong>
            <el-radio-group
              v-model="form.rapidOrderEntered"
              class="compact-choice"
              :disabled="readonly"
              @change="clearRequested = false"
            >
              <el-radio-button :value="true">是</el-radio-button>
              <el-radio-button :value="false">否</el-radio-button>
            </el-radio-group>
          </div>
        </template>
      </section>

      <section class="status-section">
        <div class="status-row">
          <div>
            <strong>是否报名新品运营</strong>
            <span>冲顶选项会在报名后显示</span>
          </div>
          <el-radio-group
            v-model="form.newProductOperationRegistered"
            class="compact-choice"
            :disabled="readonly"
            @change="handleParentChange('newProductOperationRegistered')"
          >
            <el-radio-button :value="true">是</el-radio-button>
            <el-radio-button :value="false">否</el-radio-button>
          </el-radio-group>
        </div>
        <div v-if="form.newProductOperationRegistered === true" class="status-row child-row">
          <strong>新品运营是否冲顶</strong>
          <el-radio-group
            v-model="form.newProductPeak"
            class="compact-choice"
            :disabled="readonly"
            @change="clearRequested = false"
          >
            <el-radio-button :value="true">是</el-radio-button>
            <el-radio-button :value="false">否</el-radio-button>
          </el-radio-group>
        </div>
      </section>

      <section class="status-section">
        <div class="status-row">
          <div>
            <strong>商品速爆</strong>
            <span>开启后请选择具体方式</span>
          </div>
          <el-radio-group
            v-model="form.productBurst"
            class="compact-choice"
            :disabled="readonly"
            @change="handleParentChange('productBurst')"
          >
            <el-radio-button :value="true">是</el-radio-button>
            <el-radio-button :value="false">否</el-radio-button>
          </el-radio-group>
        </div>
        <el-form-item v-if="form.productBurst === true" label="商品速爆类型" required>
          <el-radio-group v-model="form.productBurstMode" :disabled="readonly" @change="clearRequested = false">
            <el-radio-button value="trade_price_for_volume">以价换量</el-radio-button>
            <el-radio-button value="super_breakout">超级打爆</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </section>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <div>
          <el-button v-if="!readonly" text type="danger" @click="clearForm">清空</el-button>
          <span v-if="clearRequested" class="clear-hint">保存后生效</span>
        </div>
        <div>
          <el-button @click="visible = false">{{ readonly ? '关闭' : '取消' }}</el-button>
          <el-button v-if="!readonly" type="primary" :loading="saving" @click="submit">保存</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  modelValue: Boolean,
  status: { type: Object, default: null },
  readonly: Boolean,
  saving: Boolean
})
const emit = defineEmits(['update:modelValue', 'save'])

const visible = ref(false)
const clearRequested = ref(false)
const form = reactive(emptyForm())

function emptyForm() {
  return {
    flashSaleRegistered: null,
    flashSaleGroup: '',
    rapidOrderEntered: null,
    newProductOperationRegistered: null,
    newProductPeak: null,
    productBurst: null,
    productBurstMode: ''
  }
}

function resetForm() {
  Object.assign(form, emptyForm(), props.status || {})
  clearRequested.value = false
}

function handleParentChange(field) {
  clearRequested.value = false
  if (field === 'flashSaleRegistered' && form.flashSaleRegistered !== true) {
    form.flashSaleGroup = ''
    form.rapidOrderEntered = null
  }
  if (field === 'newProductOperationRegistered' && form.newProductOperationRegistered !== true) {
    form.newProductPeak = null
  }
  if (field === 'productBurst' && form.productBurst !== true) {
    form.productBurstMode = ''
  }
}

function clearForm() {
  Object.assign(form, emptyForm())
  clearRequested.value = true
}

function submit() {
  if (clearRequested.value) {
    emit('save', { clear: true })
    return
  }
  if (form.flashSaleRegistered === true && !form.flashSaleGroup) {
    ElMessage.error('请选择秒杀类型')
    return
  }
  if (form.productBurst === true && !form.productBurstMode) {
    ElMessage.error('请选择商品速爆类型')
    return
  }
  emit('save', { data: { ...form } })
}

watch(() => props.modelValue, value => {
  visible.value = value
  if (value) resetForm()
}, { immediate: true })

watch(visible, value => emit('update:modelValue', value))
</script>

<style scoped>
.dialog-scroll {
  max-height: min(62vh, 560px);
  margin: -8px -20px;
  padding: 0 20px;
  overflow-y: auto;
}

.status-section {
  padding: 18px 0;
  border-bottom: 1px solid var(--dd-border-light, #e4e7ed);
}

.status-section:last-child {
  border-bottom: 0;
}

.status-row,
.dialog-footer,
.dialog-footer > div {
  display: flex;
  align-items: center;
}

.status-row {
  justify-content: space-between;
  gap: 20px;
}

.status-row > div:first-child {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.status-row strong {
  color: var(--dd-text-primary, #303133);
  font-size: 14px;
}

.status-row span,
.clear-hint {
  color: var(--dd-text-secondary, #909399);
  font-size: 12px;
}

.child-row,
:deep(.el-form-item) {
  margin-top: 16px;
}

:deep(.el-form-item) {
  margin-bottom: 0;
}

:deep(.el-form-item__label) {
  color: #4b5565;
  font-weight: 600;
}

.compact-choice :deep(.el-radio-button__inner) {
  min-width: 48px;
  padding: 7px 15px;
}

.dialog-footer {
  justify-content: space-between;
  gap: 12px;
}

.dialog-footer > div {
  gap: 8px;
}

@media (max-width: 640px) {
  .status-row {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }
}
</style>

<style>
.link-status-dialog {
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  margin: 0;
}
</style>
