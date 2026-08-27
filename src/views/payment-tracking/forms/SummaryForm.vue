<template>
  <el-form :model="model" label-position="top" class="stage-form">
    <section class="form-section">
      <h2>生命周期总结</h2>
      <div class="form-grid">
        <el-form-item label="是否打爆">
          <el-radio-group v-model="model.exploded" :disabled="readonly">
            <el-radio :value="true">是</el-radio>
            <el-radio :value="false">否</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="链接维护">
          <el-select v-model="model.linkMaintenance" clearable :disabled="readonly" placeholder="可选">
            <el-option v-for="item in LIFECYCLE_OPTIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="款式定义">
          <el-select v-model="model.styleDefinition" clearable :disabled="readonly" placeholder="可选">
            <el-option v-for="item in LIFECYCLE_OPTIONS" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="总结" class="span-2">
          <el-input v-model="model.summaryText" type="textarea" :rows="5" :disabled="readonly" maxlength="3000" show-word-limit />
        </el-form-item>
        <el-form-item label="备注" class="span-2">
          <el-input v-model="model.notes" type="textarea" :rows="5" :disabled="readonly" maxlength="3000" show-word-limit />
        </el-form-item>
      </div>
    </section>
  </el-form>
</template>

<script setup>
import { LIFECYCLE_OPTIONS } from '@/config/payment-tracking'

const model = defineModel({ type: Object, required: true })
defineProps({ readonly: Boolean })

async function validateForAdvance() {
  return true
}

defineExpose({ validateForAdvance })
</script>

<style scoped>
.form-section {
  padding-top: 4px;
}

h2 {
  margin: 0 0 16px;
  font-size: 16px;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 18px;
}

.span-2 {
  grid-column: span 2;
}

:deep(.el-select) {
  width: 100%;
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
