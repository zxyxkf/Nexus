const AppError = require('../../utils/AppError');
const { executeTransaction } = require('../../config/database');
const { ownsPermission } = require('../../middleware/auth');
const repository = require('./repository');
const promotionService = require('./promotion.service');
const recordService = require('./record.service');
const { STAGES, NEXT_STAGE, PERMISSIONS } = require('./constants');
const {
  validateAdvance,
  validateEnd,
  deriveEndSnapshot,
  deriveExplicitTerminalSnapshot
} = require('./rules');
const { conflictError, requireVersion, assertVersion } = require('./optimistic-lock');
const {
  assertPermission,
  assertAnyPermission,
  assertStoreAccess,
  canManageOwnerRecord
} = require('./access');

const FIELD_MAP = {
  selection: {
    selectionDate: 'selection_date',
    styleNumber: 'style_number',
    cost: 'cost',
    salePrice: 'sale_price',
    productId: 'product_id',
    selectionMethod: 'selection_method',
    detailText: 'detail_text',
    listingDate: 'listing_date',
    listingCategory: 'listing_category'
  },
  testing: {
    paidEnabled: 'paid_enabled',
    paidAt: 'paid_at',
    promotionMethod: 'promotion_method',
    potentialStatus: 'potential_status',
    unqualifiedAction: 'unqualified_action',
    managerReportDate: 'manager_report_date',
    weiStockReported: 'wei_stock_reported'
  },
  monitoring: {
    linkOptimized: 'link_optimized',
    linkStatus: 'link_status'
  },
  summary: {
    exploded: 'exploded',
    linkMaintenance: 'link_maintenance',
    styleDefinition: 'style_definition',
    summaryText: 'summary_text',
    notes: 'notes'
  }
};

const BOOLEAN_FIELDS = new Set([
  'paid_enabled', 'wei_stock_reported', 'link_optimized',
  'exploded'
]);

const NUMBER_FIELDS = new Set([
  'cost', 'sale_price'
]);

const DATE_FIELDS = new Set([
  'selection_date', 'listing_date', 'paid_at', 'manager_report_date',
  'adjusted_at'
]);

function validationError(errors) {
  const error = new AppError(400, Object.values(errors)[0] || '请检查填写内容');
  error.data = { errors };
  return error;
}

function localDateTime(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
    + `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function normalizeBoolean(value, field) {
  if (value === null || value === undefined || value === '') return null;
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  throw validationError({ [field]: '请选择是或否' });
}

function normalizeValue(field, value) {
  if (BOOLEAN_FIELDS.has(field)) return normalizeBoolean(value, field);
  if (NUMBER_FIELDS.has(field)) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      throw validationError({ [field]: '请输入非负数字' });
    }
    if (field === 'sale_price' && number <= 0) {
      throw validationError({ sale_price: '售价必须大于0' });
    }
    return number;
  }
  if (DATE_FIELDS.has(field)) return value || null;
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeAdjustments(value) {
  if (!Array.isArray(value)) throw validationError({ adjustments: '推广调整格式不正确' });
  const normalized = value.map(item => ({
    id: item?.id ? Number(item.id) : null,
    client_key: normalizeValue('client_key', item?.clientKey ?? item?.client_key),
    reason: normalizeValue('reason', item?.reason),
    adjusted_at: normalizeValue('adjusted_at', item?.adjustedAt ?? item?.adjusted_at),
    detail_text: normalizeValue('detail_text', item?.detailText ?? item?.detail_text),
    feedback_text: normalizeValue('feedback_text', item?.feedbackText ?? item?.feedback_text)
  }));
  const ids = normalized.filter(item => item.id).map(item => item.id);
  const clientKeys = normalized.filter(item => item.client_key).map(item => item.client_key);
  if (ids.some(id => !Number.isInteger(id) || id < 1)
    || new Set(ids).size !== ids.length
    || new Set(clientKeys).size !== clientKeys.length) {
    throw validationError({ adjustments: '推广调整标识重复或无效' });
  }
  return normalized;
}

async function assertAdjustmentOwnership(conn, recordId, adjustments = []) {
  for (const item of adjustments) {
    if (!item.id) continue;
    const existing = await repository.findAdjustmentById(recordId, item.id, conn);
    if (!existing) throw validationError({ adjustments: '推广调整不存在或不属于当前记录' });
  }
}

function normalizeStageInput(stageCode, input = {}) {
  const map = FIELD_MAP[stageCode];
  if (!map) throw new AppError(400, '无效阶段');
  const result = {};
  for (const [camelField, snakeField] of Object.entries(map)) {
    if (Object.prototype.hasOwnProperty.call(input, camelField)) {
      result[snakeField] = normalizeValue(snakeField, input[camelField]);
    } else if (Object.prototype.hasOwnProperty.call(input, snakeField)) {
      result[snakeField] = normalizeValue(snakeField, input[snakeField]);
    }
  }
  if (stageCode === 'monitoring' && Object.prototype.hasOwnProperty.call(input, 'adjustments')) {
    result.adjustments = normalizeAdjustments(input.adjustments);
  }
  return result;
}

function assertInProgress(record) {
  if (record.process_status !== 'in_progress') throw new AppError(400, '流程已结束，请先恢复流程');
}

async function loadRecordForUpdate(conn, recordId, user) {
  const record = await repository.findRecordById(recordId, { conn, forUpdate: true });
  if (!record) throw new AppError(404, '选品记录不存在');
  assertStoreAccess(record, user);
  return record;
}

async function assertEditableStage(conn, record, stageCode) {
  const stage = await repository.findStage(record.id, stageCode, conn);
  if (!stage) throw new AppError(403, '该阶段尚未进入');
  if (record.current_stage !== stageCode && !Number(stage.is_reopened)) {
    throw new AppError(403, '该历史阶段未重开，当前不可编辑');
  }
  return stage;
}

function managerFieldsChanged(existing, changes) {
  return ['paid_enabled', 'paid_at'].some(field => (
    Object.prototype.hasOwnProperty.call(changes, field)
    && String(changes[field] ?? '') !== String(existing[field] ?? '')
  ));
}

async function saveStage(recordId, stageCode, payload, user) {
  assertPermission(user, PERMISSIONS.selection);
  if (!STAGES.includes(stageCode)) throw new AppError(400, '无效阶段');
  const version = requireVersion(payload?.version);
  const changes = normalizeStageInput(stageCode, payload?.data || {});

  await executeTransaction(async conn => {
    const record = await loadRecordForUpdate(conn, recordId, user);
    assertInProgress(record);
    assertVersion(record, version);
    const stage = await assertEditableStage(conn, record, stageCode);
    const existing = await repository.loadStageData(record.id, stageCode, conn) || {};
    const merged = { ...existing, ...changes };

    if (stageCode === 'selection' && Object.prototype.hasOwnProperty.call(changes, 'listing_category')) {
      await recordService.assertListingCategoryAllowed(changes.listing_category, {
        allowHistorical: true,
        historicalValue: existing.listing_category
      });
    }

    if (stageCode === 'testing' && Object.prototype.hasOwnProperty.call(changes, 'promotion_method')) {
      changes.promotion_method = await promotionService.assertConfiguredPromotionMethod(changes.promotion_method, {
        existingValue: existing.promotion_method
      });
    }

    if (stageCode === 'testing'
      && managerFieldsChanged(existing, changes)
      && !ownsPermission(user, PERMISSIONS.managerReview)) {
      throw new AppError(403, '只有拥有店长审核权限的用户可以修改付费审核');
    }

    if (stageCode === 'monitoring' && changes.adjustments) {
      await assertAdjustmentOwnership(conn, record.id, changes.adjustments);
    }

    const terminalSnapshot = Number(stage.is_reopened)
      ? deriveExplicitTerminalSnapshot(stageCode, merged)
      : null;
    const requiresInvalidation = Boolean(
      terminalSnapshot && record.current_stage !== stageCode
    );
    if (requiresInvalidation && payload?.confirmDownstreamInvalidation !== true) {
      const error = new AppError(400, '该修改会作废后续阶段，请确认后重试');
      error.data = { requiresDownstreamInvalidation: true, stageCode };
      throw error;
    }

    await repository.saveStageData(conn, record.id, stageCode, changes);
    if (requiresInvalidation) {
      await repository.invalidateStagesAfter(conn, record.id, stageCode);
      await repository.markStageEnded(conn, record.id, stageCode);
      const updated = await repository.updateRecordWithVersion(conn, record.id, version, {
        current_stage: stageCode,
        process_status: 'ended',
        end_stage: stageCode,
        end_type: terminalSnapshot.endType,
        end_reason: terminalSnapshot.endReason,
        ended_at: localDateTime()
      });
      if (!updated) throw conflictError();
      return;
    }

    const updated = await repository.updateRecordWithVersion(conn, record.id, version);
    if (!updated) throw conflictError();
    if (Number(stage.is_reopened)) await repository.lockStage(conn, record.id, stageCode);
  });

  return recordService.getRecord(recordId, user, { skipViewPermission: true });
}

async function advanceStage(recordId, payload, user) {
  assertPermission(user, PERMISSIONS.selection);
  const version = requireVersion(payload?.version);
  let alreadyAdvanced = false;

  await executeTransaction(async conn => {
    const record = await loadRecordForUpdate(conn, recordId, user);
    assertInProgress(record);
    const requestedStage = payload?.stageCode;
    if (requestedStage && requestedStage !== record.current_stage) {
      const stage = await repository.findStage(record.id, requestedStage, conn);
      if (stage?.stage_status === 'completed') {
        alreadyAdvanced = true;
        return;
      }
      throw new AppError(400, '当前阶段已变化，请刷新后重试');
    }
    assertVersion(record, version);

    const stageCode = record.current_stage;
    const stage = await repository.findStage(record.id, stageCode, conn);
    if (!stage) throw new AppError(403, '当前阶段尚未进入');
    const data = await repository.loadStageData(record.id, stageCode, conn) || {};
    if (stageCode === 'selection') {
      const images = await repository.listImages(record.id, 'product_main', conn);
      data.product_image_count = images.length;
    }
    const validation = validateAdvance(stageCode, data);
    if (!validation.ok) throw validationError(validation.errors);

    const nextStage = NEXT_STAGE[stageCode];
    await repository.markStageCompleted(conn, record.id, stageCode);
    await repository.insertStage(conn, record.id, nextStage);
    const updated = await repository.updateRecordWithVersion(conn, record.id, version, {
      current_stage: nextStage
    });
    if (!updated) throw conflictError();
  });

  const result = await recordService.getRecord(recordId, user, { skipViewPermission: true });
  if (alreadyAdvanced) result.alreadyAdvanced = true;
  return result;
}

async function endProcess(recordId, payload, user) {
  assertPermission(user, PERMISSIONS.selection);
  const version = requireVersion(payload?.version);

  await executeTransaction(async conn => {
    const record = await loadRecordForUpdate(conn, recordId, user);
    if (record.process_status === 'ended') {
      if (!canManageOwnerRecord(record, user)) throw new AppError(403, '只有填写人或阶段管理人可以结束流程');
      return;
    }
    assertVersion(record, version);
    if (!canManageOwnerRecord(record, user)) throw new AppError(403, '只有填写人或阶段管理人可以结束流程');

    const data = await repository.loadStageData(record.id, record.current_stage, conn) || {};
    const endValidation = validateEnd(record.current_stage, data);
    if (!endValidation.ok) throw validationError(endValidation.errors);
    const snapshot = deriveEndSnapshot(record.current_stage, data);
    await repository.markStageEnded(conn, record.id, record.current_stage);
    const updated = await repository.updateRecordWithVersion(conn, record.id, version, {
      process_status: 'ended',
      end_stage: record.current_stage,
      end_type: snapshot.endType,
      end_reason: snapshot.endReason,
      ended_at: localDateTime()
    });
    if (!updated) throw conflictError();
  });

  return recordService.getRecord(recordId, user, { skipViewPermission: true });
}

async function restoreProcess(recordId, payload, user) {
  assertAnyPermission(user, [PERMISSIONS.selection, PERMISSIONS.records]);
  const version = requireVersion(payload?.version);

  await executeTransaction(async conn => {
    const record = await loadRecordForUpdate(conn, recordId, user);
    if (record.process_status === 'in_progress'
      && Number(record.version) === version + 1
      && !record.end_stage
      && !record.ended_at) {
      if (!canManageOwnerRecord(record, user)) throw new AppError(403, '只有填写人或阶段管理人可以恢复流程');
      return;
    }
    if (record.process_status !== 'ended') throw new AppError(400, '流程尚未结束');
    assertVersion(record, version);
    if (!canManageOwnerRecord(record, user)) throw new AppError(403, '只有填写人或阶段管理人可以恢复流程');

    await repository.restoreCurrentStage(conn, record.id, record.current_stage);
    const updated = await repository.updateRecordWithVersion(conn, record.id, version, {
      process_status: 'in_progress',
      end_stage: null,
      end_type: null,
      end_reason: '',
      ended_at: null
    });
    if (!updated) throw conflictError();
  });

  return recordService.getRecord(recordId, user, { skipViewPermission: true });
}

async function reopenStage(recordId, stageCode, payload, user) {
  assertPermission(user, PERMISSIONS.reopen);
  if (!STAGES.includes(stageCode)) throw new AppError(400, '无效阶段');
  const version = requireVersion(payload?.version);

  await executeTransaction(async conn => {
    const record = await loadRecordForUpdate(conn, recordId, user);
    assertInProgress(record);
    assertVersion(record, version);
    if (record.current_stage === stageCode) throw new AppError(400, '当前阶段无需重开');
    const stage = await repository.findStage(record.id, stageCode, conn);
    if (!stage) throw new AppError(403, '该阶段尚未进入');
    if (stage.stage_status !== 'completed') throw new AppError(400, '只有已完成的历史阶段可以重开');

    await repository.reopenStage(conn, record.id, stageCode);
    const updated = await repository.updateRecordWithVersion(conn, record.id, version);
    if (!updated) throw conflictError();
  });

  return recordService.getRecord(recordId, user, { skipViewPermission: true });
}

module.exports = {
  saveStage,
  advanceStage,
  endProcess,
  restoreProcess,
  reopenStage,
  normalizeStageInput
};
