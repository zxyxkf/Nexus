const AppError = require('../../utils/AppError');
const { executeTransaction } = require('../../config/database');
const repository = require('./repository');
const recordService = require('./record.service');
const { PERMISSIONS } = require('./constants');
const { assertPermission, assertStoreAccess } = require('./access');
const { conflictError, requireVersion, assertVersion } = require('./optimistic-lock');

const OWNER_STAGES = ['testing', 'monitoring'];
const FLASH_SALE_GROUPS = [
  'new_product_cold_start',
  'potential_breakout',
  'bestseller_sustain'
];
const PRODUCT_BURST_MODES = ['trade_price_for_volume', 'super_breakout'];

function fieldError(field, message) {
  const error = new AppError(400, message);
  error.data = { errors: { [field]: message } };
  return error;
}

function normalizeTriState(value, field) {
  if (value === null || value === undefined || value === '') return null;
  if (value === true || value === 1 || value === '1') return 1;
  if (value === false || value === 0 || value === '0') return 0;
  throw fieldError(field, '请选择是或否');
}

function normalizeOption(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeLinkStatus(input = {}) {
  const data = {
    flashSaleRegistered: normalizeTriState(input.flashSaleRegistered, 'flashSaleRegistered'),
    flashSaleGroup: normalizeOption(input.flashSaleGroup),
    rapidOrderEntered: normalizeTriState(input.rapidOrderEntered, 'rapidOrderEntered'),
    newProductOperationRegistered: normalizeTriState(
      input.newProductOperationRegistered,
      'newProductOperationRegistered'
    ),
    newProductPeak: normalizeTriState(input.newProductPeak, 'newProductPeak'),
    productBurst: normalizeTriState(input.productBurst, 'productBurst'),
    productBurstMode: normalizeOption(input.productBurstMode)
  };

  if (data.flashSaleRegistered === 1) {
    if (!FLASH_SALE_GROUPS.includes(data.flashSaleGroup)) {
      throw fieldError('flashSaleGroup', '请选择秒杀类型');
    }
  } else {
    data.flashSaleGroup = '';
    data.rapidOrderEntered = null;
  }

  if (data.newProductOperationRegistered !== 1) data.newProductPeak = null;

  if (data.productBurst === 1) {
    if (!PRODUCT_BURST_MODES.includes(data.productBurstMode)) {
      throw fieldError('productBurstMode', '请选择商品速爆类型');
    }
  } else {
    data.productBurstMode = '';
  }

  return data;
}

async function loadEditableRecord(conn, recordId, stageCode, version, user) {
  if (!OWNER_STAGES.includes(stageCode)) throw new AppError(400, '链接状态只支持第二或第三阶段');
  const record = await repository.findRecordById(recordId, { conn, forUpdate: true });
  if (!record) throw new AppError(404, '选品记录不存在');
  assertStoreAccess(record, user);
  if (record.process_status !== 'in_progress') throw new AppError(400, '流程已结束，请先恢复流程');
  assertVersion(record, version);
  const stage = await repository.findStage(record.id, stageCode, conn);
  if (!stage) throw new AppError(403, '该阶段尚未进入');
  if (record.current_stage !== stageCode && !Number(stage.is_reopened)) {
    throw new AppError(403, '该历史阶段未重开，链接状态只能查看');
  }
  return record;
}

async function saveLinkStatus(recordId, stageCode, payload, user) {
  assertPermission(user, PERMISSIONS.selection);
  const version = requireVersion(payload?.version);
  const clear = payload?.clear === true;
  const normalized = clear ? null : normalizeLinkStatus(payload?.data || {});

  await executeTransaction(async conn => {
    const record = await loadEditableRecord(conn, recordId, stageCode, version, user);
    const existing = await repository.findLinkStatus(record.id, conn);
    if (existing && existing.stage_code !== stageCode) {
      throw new AppError(400, '链接状态已填写在其他阶段，请先重开原阶段并清空');
    }

    if (clear) {
      if (!existing) return;
      await repository.deleteLinkStatus(conn, record.id);
    } else {
      await repository.upsertLinkStatus(conn, record.id, stageCode, normalized);
    }

    const updated = await repository.updateRecordWithVersion(conn, record.id, version);
    if (!updated) throw conflictError();
  });

  return recordService.getRecord(recordId, user, { skipViewPermission: true });
}

module.exports = {
  OWNER_STAGES,
  FLASH_SALE_GROUPS,
  PRODUCT_BURST_MODES,
  normalizeLinkStatus,
  saveLinkStatus
};
