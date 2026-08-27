const AppError = require('../../utils/AppError');
const { executeTransaction } = require('../../config/database');
const { ownsPermission } = require('../../middleware/auth');
const repository = require('./repository');
const { PERMISSIONS } = require('./constants');
const { calculateGrossMargin, calculateSearchShare } = require('./rules');
const {
  isAdmin,
  assertPermission,
  assertAnyPermission,
  assertStoreAccess,
  buildAllowedActions
} = require('./access');

function presentStage(stage) {
  return {
    id: stage.id,
    stageCode: stage.stage_code,
    stageStatus: stage.stage_status,
    isReopened: Boolean(stage.is_reopened),
    enteredAt: stage.entered_at,
    completedAt: stage.completed_at
  };
}

function presentImage(image) {
  return {
    id: image.id,
    category: image.category,
    originalName: image.original_name,
    mimeType: image.mime_type,
    fileSize: image.file_size,
    sortOrder: image.sort_order,
    sourceTaskFileId: image.source_task_file_id,
    createdAt: image.create_time
  };
}

function snakeToCamel(value) {
  if (Array.isArray(value)) return value.map(snakeToCamel);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase()),
    snakeToCamel(item)
  ]));
}

function presentRecord(record, stages = [], images = [], user, stageData = {}) {
  const presentedStageData = snakeToCamel(stageData);
  if (presentedStageData.testing) {
    presentedStageData.testing.searchVisitorShare = calculateSearchShare(
      presentedStageData.testing.searchVisitors,
      presentedStageData.testing.overallVisitors
    );
  }
  return {
    id: record.id,
    store: record.store,
    storeSeq: record.store_seq,
    plannerId: record.planner_id,
    plannerName: record.planner_name,
    sourceTaskId: record.source_task_id,
    sourceTaskNo: record.source_task_no,
    selectionDate: record.selection_date,
    styleNumber: record.style_number,
    cost: record.cost,
    salePrice: record.sale_price,
    grossMargin: calculateGrossMargin(record.cost, record.sale_price),
    productId: record.product_id,
    selectionMethod: record.selection_method,
    detailText: record.detail_text,
    designMainImage: Boolean(record.design_main_image),
    skuLe200: record.sku_le_200 === null ? null : Boolean(record.sku_le_200),
    listingDate: record.listing_date,
    listingCategory: record.listing_category,
    currentStage: record.current_stage,
    processStatus: record.process_status,
    endStage: record.end_stage,
    endType: record.end_type,
    endReason: record.end_reason,
    endedAt: record.ended_at,
    version: record.version,
    createdAt: record.create_time,
    updatedAt: record.update_time,
    stages: stages.map(presentStage),
    stageData: presentedStageData,
    images: images.map(presentImage),
    allowedActions: buildAllowedActions(record, user)
  };
}

function resolveListStatus(query, user) {
  const requested = query.processStatus || query.status;
  if (requested && !['in_progress', 'ended'].includes(requested)) {
    throw new AppError(400, '无效的流程状态');
  }
  const status = requested || (ownsPermission(user, PERMISSIONS.selection) ? 'in_progress' : 'ended');
  assertPermission(user, status === 'ended' ? PERMISSIONS.records : PERMISSIONS.selection);
  return status;
}

async function listRecords(query, user) {
  assertAnyPermission(user, [PERMISSIONS.selection, PERMISSIONS.records]);
  const processStatus = resolveListStatus(query, user);
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(query.pageSize, 10) || 20));
  const filters = {
    store: isAdmin(user) ? (query.store || '') : user.store,
    processStatus,
    keyword: String(query.keyword || '').trim(),
    page,
    pageSize
  };
  if (!isAdmin(user) && !filters.store) throw new AppError(400, '当前账号未配置店铺');

  const [records, total] = await Promise.all([
    repository.listRecords(filters),
    repository.countRecords(filters)
  ]);
  return {
    list: records.map(record => presentRecord(record, [], [], user)),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize)
  };
}

async function getRecord(id, user) {
  assertAnyPermission(user, [PERMISSIONS.selection, PERMISSIONS.records]);
  const record = await repository.findRecordById(id);
  if (!record) throw new AppError(404, '选品记录不存在');
  assertStoreAccess(record, user);
  const [stages, images] = await Promise.all([
    repository.listEnteredStages(record.id),
    repository.listImages(record.id)
  ]);
  const entries = await Promise.all(stages.map(async stage => [
    stage.stage_code,
    await repository.loadStageData(record.id, stage.stage_code)
  ]));
  return presentRecord(record, stages, images, user, Object.fromEntries(entries));
}

function isStoreSequenceConflict(error) {
  const message = String(error?.message || '');
  return message.includes('uk_payment_store_seq')
    || message.includes('payment_selection_record.store, payment_selection_record.store_seq');
}

async function createManualRecord(data, user) {
  assertPermission(user, PERMISSIONS.selection);
  if (!user?.store) throw new AppError(400, '当前账号未配置店铺，无法新增选品记录');

  let recordId;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      recordId = await executeTransaction(async conn => {
        const storeSeq = await repository.allocateStoreSeq(conn, user.store);
        const id = await repository.insertRecord(conn, {
          ...data,
          store: user.store,
          storeSeq,
          plannerId: user.id,
          plannerName: user.realName || user.username || ''
        });
        await repository.insertInitialStage(conn, id);
        return id;
      });
      break;
    } catch (error) {
      if (!isStoreSequenceConflict(error) || attempt === 2) throw error;
    }
  }

  return getRecord(recordId, user);
}

async function deleteRecord(id, user) {
  assertPermission(user, PERMISSIONS.delete);
  const record = await repository.findRecordById(id);
  if (!record) throw new AppError(404, '选品记录不存在');
  assertStoreAccess(record, user);
  await repository.softDeleteRecord(record.id);
}

module.exports = {
  presentRecord,
  listRecords,
  getRecord,
  createManualRecord,
  deleteRecord
};
