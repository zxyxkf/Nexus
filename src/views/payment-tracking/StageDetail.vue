<template>
  <main class="payment-page" v-loading="loading">
    <template v-if="record && currentStageEntry">
      <header class="detail-header">
        <div class="detail-heading">
          <el-tooltip content="返回列表" placement="top">
            <el-button circle :icon="ArrowLeft" aria-label="返回列表" @click="goBack" />
          </el-tooltip>
          <div>
            <div class="heading-line">
              <h1>{{ stageTitle }}</h1>
              <el-tag v-if="record.processStatus === 'ended'" type="warning" effect="plain">已结束</el-tag>
              <el-tag v-else-if="isEditable" type="primary" effect="plain">进行中</el-tag>
              <el-tag v-else type="info" effect="plain">只读</el-tag>
            </div>
            <div class="record-meta">
              <strong>{{ record.styleNumber || '未填写货号' }}</strong>
              <span>#{{ String(record.storeSeq || 0).padStart(3, '0') }}</span>
              <span>{{ record.store }}</span>
              <span>{{ record.plannerName || '-' }}</span>
              <span>毛利 {{ grossMarginText }}</span>
              <SourceTaskLink
                :source-task-id="record.sourceTaskId"
                :source-task-no="record.sourceTaskNo"
              />
            </div>
          </div>
        </div>
        <div class="stage-header-actions">
          <span v-if="!isEditable && record.processStatus === 'in_progress'" class="readonly-hint">
            历史阶段需重开后才能修改
          </span>
          <div class="action-buttons">
            <el-tooltip
              v-if="supportsLinkStatus"
              :disabled="!linkStatusBlocked"
              content="链接状态已填写在其他阶段，请先重开原阶段并清空"
              placement="top"
            >
              <span class="tooltip-button-wrap">
                <el-button
                  :icon="Link"
                  :disabled="linkStatusBlocked"
                  @click="linkStatusDialogVisible = true"
                >链接状态</el-button>
              </span>
            </el-tooltip>
            <el-button
              v-if="isEditable"
              :icon="Check"
              :loading="saving"
              @click="saveCurrentStage()"
            >保存本阶段</el-button>
            <el-button
              v-if="showAdvance"
              type="primary"
              :icon="Right"
              :loading="advancing"
              @click="advanceStage"
            >进入下一阶段</el-button>
            <el-button
              v-if="showEnd"
              type="danger"
              plain
              :icon="CircleClose"
              :loading="ending"
              @click="endProcess"
            >{{ endActionLabel }}</el-button>
            <el-button
              v-if="showReopen"
              type="warning"
              :icon="RefreshRight"
              :loading="reopening"
              @click="reopenStage"
            >重开此阶段</el-button>
            <el-button
              v-if="record.allowedActions?.restore"
              type="warning"
              :icon="RefreshRight"
              :loading="restoring"
              @click="restoreProcess"
            >恢复流程</el-button>
          </div>
        </div>
      </header>

      <section class="timeline-band" aria-label="已进入阶段">
        <StageTimeline
          :stages="record.stages"
          :current-stage="record.currentStage"
          :end-stage="record.endStage"
          :link-status="record.linkStatus"
          :readonly="record.processStatus === 'ended'"
          @select="openStage($event.stageCode)"
        />
      </section>

      <div v-if="record.processStatus === 'ended'" class="end-banner">
        <strong>结束于：{{ stageLabel(record.endStage) }}</strong>
        <span>{{ record.endReason || '流程已结束' }}</span>
      </div>

      <section class="form-shell">
        <component
          :is="currentFormComponent"
          v-if="currentFormComponent"
          ref="formRef"
          v-model="formData"
          :record="record"
          :readonly="!isEditable"
          v-bind="currentFormProps"
          @record-updated="applyImageUpdate"
          @reload-requested="loadRecord"
        />
        <el-empty v-else description="该阶段表单即将开放" />
      </section>

      <StageLinkStatusDialog
        v-model="linkStatusDialogVisible"
        :status="linkStatusForCurrentStage"
        :readonly="!isEditable"
        :saving="linkStatusSaving"
        @save="saveLinkStatus"
      />

    </template>

    <el-empty v-else-if="!loading" description="未找到选品记录" />
  </main>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Check, CircleClose, Link, RefreshRight, Right } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  advancePaymentStageApi,
  endPaymentProcessApi,
  getPaymentRecordApi,
  reopenPaymentStageApi,
  restorePaymentProcessApi,
  savePaymentLinkStatusApi,
  savePaymentStageApi
} from '@/api'
import StageLinkStatusDialog from '@/components/payment-tracking/StageLinkStatusDialog.vue'
import StageTimeline from '@/components/payment-tracking/StageTimeline.vue'
import SourceTaskLink from '@/components/payment-tracking/SourceTaskLink.vue'
import { PAYMENT_STAGE_BY_CODE } from '@/config/payment-tracking'
import SelectionForm from './forms/SelectionForm.vue'
import TestingForm from './forms/TestingForm.vue'
import MonitoringForm from './forms/MonitoringForm.vue'
import SummaryForm from './forms/SummaryForm.vue'

const FORM_COMPONENTS = {
  selection: SelectionForm,
  testing: TestingForm,
  monitoring: MonitoringForm,
  summary: SummaryForm
}

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const advancing = ref(false)
const ending = ref(false)
const reopening = ref(false)
const restoring = ref(false)
const linkStatusSaving = ref(false)
const linkStatusDialogVisible = ref(false)
const record = ref(null)
const formData = ref({})
const formRef = ref(null)

const stageCode = computed(() => String(route.params.stageCode || ''))
const stageTitle = computed(() => stageLabel(stageCode.value))
const grossMarginText = computed(() => {
  const value = record.value?.grossMargin
  if (value !== null && value !== undefined && Number.isFinite(Number(value))) {
    return `${(Number(value) * 100).toFixed(2)}%`
  }
  const cost = Number(record.value?.cost)
  const salePrice = Number(record.value?.salePrice)
  if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(salePrice) || salePrice <= 0) return '-'
  return `${(((salePrice - cost) / salePrice) * 100).toFixed(2)}%`
})
const endActionLabel = computed(() => stageCode.value === 'summary' ? '完成流程' : '结束流程')
const currentStageEntry = computed(() => record.value?.stages?.find(stage => stage.stageCode === stageCode.value) || null)
const currentFormComponent = computed(() => FORM_COMPONENTS[stageCode.value] || null)
const currentFormProps = computed(() => {
  if (stageCode.value === 'testing') {
    return { canReview: Boolean(record.value?.allowedActions?.managerReview) }
  }
  if (stageCode.value === 'monitoring') {
    return { prepareAdjustmentUpload }
  }
  return {}
})
const supportsLinkStatus = computed(() => ['testing', 'monitoring'].includes(stageCode.value))
const linkStatusBlocked = computed(() => Boolean(
  record.value?.linkStatus?.stageCode
  && record.value.linkStatus.stageCode !== stageCode.value
))
const linkStatusForCurrentStage = computed(() => (
  record.value?.linkStatus?.stageCode === stageCode.value ? record.value.linkStatus : null
))
const isCurrentStage = computed(() => record.value?.currentStage === stageCode.value)
const isEditable = computed(() => Boolean(
  record.value?.processStatus === 'in_progress'
  && record.value?.allowedActions?.edit
  && (isCurrentStage.value || currentStageEntry.value?.isReopened)
))
const canAdvanceByBranch = computed(() => {
  if (stageCode.value === 'testing') {
    return formData.value.paidEnabled === true
      && formData.value.potentialStatus === '符合潜力款标准'
  }
  if (stageCode.value === 'monitoring') return formData.value.linkStatus === 'keep_breaking'
  return true
})
const showAdvance = computed(() => Boolean(
  isEditable.value
  && isCurrentStage.value
  && PAYMENT_STAGE_BY_CODE[stageCode.value]
  && stageCode.value !== 'summary'
  && canAdvanceByBranch.value
))
const showEnd = computed(() => Boolean(
  isEditable.value
  && isCurrentStage.value
  && record.value?.allowedActions?.end
  && (stageCode.value !== 'monitoring' || formData.value.linkStatus === 'protect_roi')
))
const showReopen = computed(() => Boolean(
  record.value?.processStatus === 'in_progress'
  && !isCurrentStage.value
  && currentStageEntry.value?.stageStatus === 'completed'
  && !currentStageEntry.value?.isReopened
  && record.value?.allowedActions?.reopen
))

function stageLabel(code) {
  return PAYMENT_STAGE_BY_CODE[code]?.label || code || '选品阶段详情'
}

function createStageModel(data, code) {
  const stageData = data.stageData?.[code] || {}
  if (code === 'selection') {
    return {
      selectionDate: stageData.selectionDate ?? data.selectionDate ?? null,
      styleNumber: stageData.styleNumber ?? data.styleNumber ?? '',
      cost: stageData.cost ?? data.cost ?? null,
      salePrice: stageData.salePrice ?? data.salePrice ?? null,
      productId: stageData.productId ?? data.productId ?? '',
      selectionMethod: stageData.selectionMethod ?? data.selectionMethod ?? '',
      detailText: stageData.detailText ?? data.detailText ?? '',
      listingDate: stageData.listingDate ?? data.listingDate ?? null,
      listingCategory: stageData.listingCategory ?? data.listingCategory ?? ''
    }
  }
  if (code === 'testing') {
    return {
      paidEnabled: stageData.paidEnabled ?? null,
      paidAt: stageData.paidAt ?? null,
      promotionMethod: stageData.promotionMethod ?? '',
      potentialStatus: stageData.potentialStatus ?? '',
      unqualifiedAction: stageData.unqualifiedAction ?? '',
      managerReportDate: stageData.managerReportDate ?? null,
      weiStockReported: stageData.weiStockReported ?? null
    }
  }
  if (code === 'monitoring') {
    return {
      linkOptimized: stageData.linkOptimized ?? null,
      linkStatus: stageData.linkStatus ?? '',
      adjustments: (stageData.adjustments || []).map((item, index) => ({
        ...item,
        clientKey: item.clientKey || `legacy-${item.id || index}`
      }))
    }
  }
  if (code === 'summary') {
    return {
      exploded: stageData.exploded ?? null,
      linkMaintenance: stageData.linkMaintenance ?? '',
      styleDefinition: stageData.styleDefinition ?? '',
      summaryText: stageData.summaryText ?? '',
      notes: stageData.notes ?? ''
    }
  }
  return { ...stageData }
}

function applyRecord(data, resetForm = true) {
  record.value = data
  if (resetForm) formData.value = createStageModel(data, stageCode.value)
}

function applyImageUpdate(data) {
  applyRecord(data, false)
}

async function loadRecord() {
  loading.value = true
  record.value = null
  try {
    const response = await getPaymentRecordApi(route.params.id)
    const data = response.data
    const entered = data?.stages?.some(stage => stage.stageCode === stageCode.value)
    if (!entered) {
      ElMessage.warning('该阶段尚未进入')
      await router.replace(data?.processStatus === 'ended'
        ? '/payment-tracking/records'
        : '/payment-tracking/selections')
      return
    }
    applyRecord(data)
  } catch (error) {
    console.error('[PaymentTracking] 加载阶段详情失败:', error)
  } finally {
    loading.value = false
  }
}

function openStage(code) {
  if (!code || code === stageCode.value) return
  router.push(`/payment-tracking/records/${record.value.id}/stages/${code}`)
}

function goBack() {
  router.push(record.value?.processStatus === 'ended'
    ? '/payment-tracking/records'
    : '/payment-tracking/selections')
}

async function reloadOnVersionConflict(result) {
  const responseCode = Number(result?.code)
  const httpStatus = Number(result?.response?.status)
  if (responseCode !== 409 && httpStatus !== 409) return false
  if (responseCode === 409) {
    ElMessage.warning(result.msg || '记录已被其他人更新，请刷新后重试')
  }
  await loadRecord()
  return true
}

async function saveCurrentStage(options = {}) {
  saving.value = true
  try {
    const response = await savePaymentStageApi(record.value.id, stageCode.value, {
      version: record.value.version,
      data: formData.value
    })
    if (await reloadOnVersionConflict(response)) return null
    if (response.code === 0) {
      applyRecord(response.data)
      if (!options.silent) ElMessage.success('本阶段已保存')
      return response.data
    }
  } catch (error) {
    if (await reloadOnVersionConflict(error)) return null
    throw error
  } finally {
    saving.value = false
  }
  return null
}

async function prepareAdjustmentUpload(clientKey) {
  const saved = await saveCurrentStage({ silent: true })
  if (!saved) return null
  const adjustment = saved.stageData?.monitoring?.adjustments?.find(
    item => item.clientKey === clientKey
  )
  if (!adjustment?.id) {
    ElMessage.error('推广调整保存失败，请重试')
    return null
  }
  return { ownerId: adjustment.id, version: saved.version }
}

async function saveLinkStatus(payload) {
  linkStatusSaving.value = true
  try {
    const response = await savePaymentLinkStatusApi(record.value.id, stageCode.value, {
      version: record.value.version,
      ...payload
    })
    if (await reloadOnVersionConflict(response)) return
    if (response.code === 0) {
      applyRecord(response.data, false)
      linkStatusDialogVisible.value = false
      ElMessage.success(payload.clear ? '链接状态已清空' : '链接状态已保存')
    }
  } catch (error) {
    if (await reloadOnVersionConflict(error)) return
    throw error
  } finally {
    linkStatusSaving.value = false
  }
}

async function advanceStage() {
  try {
    await formRef.value?.validateForAdvance?.()
    await ElMessageBox.confirm(`确认完成“${stageTitle.value}”并进入下一阶段？`, '进入下一阶段', {
      confirmButtonText: '确认进入',
      type: 'warning'
    })
    advancing.value = true
    const saved = await saveCurrentStage({ silent: true })
    if (!saved) return
    const response = await advancePaymentStageApi(saved.id, {
      version: saved.version,
      stageCode: stageCode.value
    })
    if (await reloadOnVersionConflict(response)) return
    if (response.code === 0) {
      applyRecord(response.data)
      ElMessage.success('已进入下一阶段')
      await router.replace(`/payment-tracking/records/${saved.id}/stages/${response.data.currentStage}`)
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') await reloadOnVersionConflict(error)
  } finally {
    advancing.value = false
  }
}

async function endProcess() {
  try {
    await formRef.value?.validateForEnd?.()
    await ElMessageBox.confirm(
      stageCode.value === 'summary'
        ? '确认完成该商品的打款流程？完成后会进入打款记录。'
        : '确认结束该商品的打款流程？结束后会进入打款记录。',
      endActionLabel.value,
      {
        confirmButtonText: stageCode.value === 'summary' ? '确认完成' : '确认结束',
        type: 'warning'
      }
    )
    ending.value = true
    const saved = await saveCurrentStage({ silent: true })
    if (!saved) return
    const response = await endPaymentProcessApi(saved.id, { version: saved.version })
    if (await reloadOnVersionConflict(response)) return
    if (response.code === 0) {
      ElMessage.success('流程已结束')
      await router.replace('/payment-tracking/records')
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') await reloadOnVersionConflict(error)
  } finally {
    ending.value = false
  }
}

async function reopenStage() {
  try {
    await ElMessageBox.confirm(`确认重开“${stageTitle.value}”？保存后该历史阶段会重新锁定。`, '重开历史阶段', {
      confirmButtonText: '确认重开',
      type: 'warning'
    })
    reopening.value = true
    const response = await reopenPaymentStageApi(record.value.id, stageCode.value, {
      version: record.value.version
    })
    if (await reloadOnVersionConflict(response)) return
    if (response.code === 0) {
      applyRecord(response.data)
      ElMessage.success('历史阶段已重开')
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') await reloadOnVersionConflict(error)
  } finally {
    reopening.value = false
  }
}

async function restoreProcess() {
  try {
    await ElMessageBox.confirm('确认恢复该商品的打款流程？', '恢复流程', {
      confirmButtonText: '确认恢复',
      type: 'warning'
    })
    restoring.value = true
    const response = await restorePaymentProcessApi(record.value.id, { version: record.value.version })
    if (await reloadOnVersionConflict(response)) return
    if (response.code === 0) {
      ElMessage.success('流程已恢复')
      await router.replace(`/payment-tracking/records/${record.value.id}/stages/${response.data.currentStage}`)
      applyRecord(response.data)
    }
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') await reloadOnVersionConflict(error)
  } finally {
    restoring.value = false
  }
}

watch(
  () => [route.params.id, route.params.stageCode],
  loadRecord,
  { immediate: true }
)
</script>

<style scoped>
.payment-page {
  box-sizing: border-box;
  min-width: 0;
  min-height: calc(100vh - 60px);
  margin: -24px;
  padding: 44px 46px 52px;
  background: #fff;
}

.detail-header,
.detail-heading,
.heading-line,
.record-meta,
.stage-header-actions,
.action-buttons {
  display: flex;
  align-items: center;
}

.tooltip-button-wrap {
  display: inline-flex;
}

.detail-header {
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.detail-heading {
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.heading-line {
  gap: 9px;
}

h1 {
  margin: 0;
  font-size: 22px;
}

.record-meta {
  flex-wrap: wrap;
  gap: 6px 12px;
  margin-top: 6px;
  color: var(--dd-text-secondary, #909399);
  font-size: 12px;
}

.record-meta strong {
  color: var(--dd-text-primary, #303133);
  font-size: 14px;
}

.timeline-band {
  max-width: 100%;
  margin-bottom: 18px;
  padding: 12px 0;
  border-top: 1px solid var(--dd-border-light, #e4e7ed);
  border-bottom: 1px solid var(--dd-border-light, #e4e7ed);
  overflow-x: auto;
}

.end-banner {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 18px;
  padding: 11px 14px;
  border-left: 3px solid #e6a23c;
  background: #fdf6ec;
  color: #9a6417;
  font-size: 13px;
}

.end-banner span {
  color: var(--dd-text-regular, #606266);
}

.form-shell {
  min-width: 0;
}

.stage-header-actions {
  flex: 0 0 auto;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
  min-height: 36px;
}

.readonly-hint {
  color: var(--dd-text-secondary, #909399);
  font-size: 12px;
}

.action-buttons {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 9px;
}

.action-buttons :deep(.el-button + .el-button) {
  margin-left: 0;
}

@media (max-width: 1360px) {
  .detail-header {
    align-items: stretch;
    flex-direction: column;
  }

  .stage-header-actions {
    justify-content: space-between;
    width: 100%;
  }
}

@media (max-width: 640px) {
  .payment-page {
    padding: 40px;
  }

  .end-banner,
  .stage-header-actions {
    align-items: flex-start;
    flex-direction: column;
  }

  .action-buttons {
    width: 100%;
  }

  .action-buttons :deep(.el-button) {
    flex: 1 1 130px;
  }
}
</style>
