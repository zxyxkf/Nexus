<template>
  <el-dialog
    :model-value="modelValue"
    title="审核打分"
    width="min(440px, calc(100vw - 32px))"
    append-to-body
    destroy-on-close
    :close-on-click-modal="!loading"
    class="manual-score-review-dialog"
    @update:model-value="handleVisibleChange"
  >
    <div class="manual-score-task">
      <span>任务编号</span>
      <strong>{{ task?.task_no || '-' }}</strong>
    </div>
    <el-form label-position="top" @submit.prevent>
      <el-form-item label="最终分值" :error="validationError" required>
        <el-input
          v-model="scoreText"
          inputmode="decimal"
          autocomplete="off"
          placeholder="请输入最终分值"
          @input="validationError = ''"
          @keyup.enter="confirm"
        />
      </el-form-item>
    </el-form>
    <p class="manual-score-hint">允许填写 0 和小数，最多保留两位小数。</p>

    <template #footer>
      <div class="manual-score-actions">
        <el-button type="danger" :disabled="loading" @click="reject">驳回</el-button>
        <span class="manual-score-actions-spacer" />
        <el-button :disabled="loading" @click="close">取消</el-button>
        <el-button type="primary" :loading="loading" @click="confirm">审核通过</el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  task: { type: Object, default: null },
  loading: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'confirm', 'reject'])
const scoreText = ref('')
const validationError = ref('')

watch(
  () => [props.modelValue, props.task?.id],
  ([visible]) => {
    if (!visible) return
    scoreText.value = ''
    validationError.value = ''
  },
  { immediate: true }
)

function validateScore() {
  const value = String(scoreText.value ?? '').trim()
  if (!value) return { error: '请输入最终分值' }
  if (value.startsWith('-')) return { error: '分值不能为负数' }

  const decimalPart = value.includes('.') ? value.split('.')[1] : ''
  if (decimalPart.length > 2) return { error: '分值最多保留两位小数' }
  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(value)) return { error: '请输入有效分值' }

  const score = Number(value)
  if (!Number.isFinite(score)) return { error: '请输入有效分值' }
  return { score }
}

function confirm() {
  if (props.loading) return
  const result = validateScore()
  if (result.error) {
    validationError.value = result.error
    return
  }
  validationError.value = ''
  emit('confirm', result.score)
}

function reject() {
  if (!props.loading) emit('reject')
}

function close() {
  if (!props.loading) emit('update:modelValue', false)
}

function handleVisibleChange(value) {
  if (!props.loading || value) emit('update:modelValue', value)
}
</script>

<style scoped>
.manual-score-task { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding: 10px 12px; border: 1px solid #e4e7ed; border-radius: 6px; background: #f7f8fa; color: #606266; font-size: 13px; }
.manual-score-task strong { color: #303133; font-weight: 600; }
.manual-score-hint { margin: -5px 0 0; color: #909399; font-size: 12px; }
.manual-score-actions { display: flex; align-items: center; gap: 8px; width: 100%; }
.manual-score-actions-spacer { flex: 1; }
</style>
