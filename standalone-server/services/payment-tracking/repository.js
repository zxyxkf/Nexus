const { getPool, getMode } = require('../../config/database');

const STAGE_TABLES = {
  preparation: 'payment_selection_preparation',
  testing: 'payment_selection_testing',
  monitoring: 'payment_selection_monitoring',
  breakout: 'payment_selection_breakout',
  summary: 'payment_selection_summary'
};

const STAGE_FIELDS = {
  selection: [
    'selection_date', 'style_number', 'cost', 'sale_price', 'product_id',
    'selection_method', 'detail_text',
    'listing_date', 'listing_category'
  ],
  testing: [
    'paid_enabled', 'paid_at', 'promotion_method', 'potential_status', 'unqualified_action',
    'manager_report_date', 'wei_stock_reported'
  ],
  monitoring: [
    'link_optimized', 'link_status'
  ],
  breakout: [
    'pit_output_day1', 'pit_output_day2', 'pit_output_day3', 'flash_sale_at',
    'super_breakout_at', 'rapid_breakout_at', 'strong_lift_qualified',
    'search_growth_trend', 'payer_trend', 'current_budget', 'fee_ratio_7d',
    'payers_7d', 'adjusted_at', 'total_budget', 'detail_text', 'feedback_text'
  ],
  summary: ['exploded', 'link_maintenance', 'style_definition', 'summary_text', 'notes']
};

function executor(conn) {
  return conn || getPool();
}

function buildRecordWhere(filters) {
  const clauses = ['deleted_at IS NULL'];
  const params = [];
  if (filters.store) {
    clauses.push('store = ?');
    params.push(filters.store);
  }
  if (filters.processStatus) {
    clauses.push('process_status = ?');
    params.push(filters.processStatus);
  }
  if (filters.plannerId) {
    clauses.push('planner_id = ?');
    params.push(filters.plannerId);
  }
  if (filters.stageCode) {
    clauses.push('current_stage = ?');
    params.push(filters.stageCode);
  }
  if (filters.keyword) {
    const like = `%${filters.keyword}%`;
    clauses.push(`(style_number LIKE ? OR product_id LIKE ? OR planner_name LIKE ? OR source_task_no LIKE ?)`);
    params.push(like, like, like, like);
  }
  return { where: `WHERE ${clauses.join(' AND ')}`, params };
}

async function listRecords(filters) {
  const { where, params } = buildRecordWhere(filters);
  const offset = (filters.page - 1) * filters.pageSize;
  const [rows] = await getPool().execute(
    `SELECT * FROM payment_selection_record ${where}
     ORDER BY create_time DESC, id DESC LIMIT ? OFFSET ?`,
    [...params, filters.pageSize, offset]
  );
  return rows;
}

async function countRecords(filters) {
  const { where, params } = buildRecordWhere(filters);
  const [rows] = await getPool().execute(
    `SELECT COUNT(*) AS total FROM payment_selection_record ${where}`,
    params
  );
  return Number(rows[0]?.total || 0);
}

async function findRecordById(id, options = {}) {
  const deletedClause = options.includeDeleted ? '' : 'AND deleted_at IS NULL';
  const lockClause = options.forUpdate && getMode() === 'mysql' ? 'FOR UPDATE' : '';
  const [rows] = await executor(options.conn).execute(
    `SELECT * FROM payment_selection_record WHERE id = ? ${deletedClause} ${lockClause}`,
    [id]
  );
  return rows[0] || null;
}

async function findRecordBySourceTaskId(sourceTaskId, options = {}) {
  const deletedClause = options.includeDeleted ? '' : 'AND deleted_at IS NULL';
  const lockClause = options.forUpdate && getMode() === 'mysql' ? 'FOR UPDATE' : '';
  const [rows] = await executor(options.conn).execute(
    `SELECT * FROM payment_selection_record
     WHERE source_task_id = ? ${deletedClause} ${lockClause}`,
    [sourceTaskId]
  );
  return rows[0] || null;
}

async function allocateStoreSeq(conn, store) {
  const [rows] = await conn.execute(
    `SELECT COALESCE(MAX(store_seq), 0) + 1 AS next_seq
     FROM payment_selection_record WHERE store = ?`,
    [store]
  );
  return Number(rows[0]?.next_seq || 1);
}

async function insertRecord(conn, data) {
  const [result] = await conn.execute(
    `INSERT INTO payment_selection_record
       (store, store_seq, planner_id, planner_name, source_task_id, source_task_no,
        selection_date, style_number, cost, sale_price, product_id, selection_method,
        detail_text, design_main_image, sku_le_200, listing_date, listing_category)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.store,
      data.storeSeq,
      data.plannerId,
      data.plannerName || '',
      data.sourceTaskId || null,
      data.sourceTaskNo || '',
      data.selectionDate || null,
      data.styleNumber || '',
      data.cost ?? null,
      data.salePrice ?? null,
      data.productId || '',
      data.selectionMethod || '',
      data.detailText || '',
      data.designMainImage ? 1 : 0,
      data.skuLe200 === null || data.skuLe200 === undefined ? null : Number(Boolean(data.skuLe200)),
      data.listingDate || null,
      data.listingCategory || ''
    ]
  );
  return result.insertId;
}

async function softDeleteRecord(id, version, conn) {
  const [result] = await executor(conn).execute(
    `UPDATE payment_selection_record
     SET deleted_at = CURRENT_TIMESTAMP, update_time = CURRENT_TIMESTAMP, version = version + 1
     WHERE id = ? AND version = ? AND deleted_at IS NULL`,
    [id, version]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function restoreDeletedRecord(id, version, conn) {
  const [result] = await executor(conn).execute(
    `UPDATE payment_selection_record
     SET deleted_at = NULL, update_time = CURRENT_TIMESTAMP, version = version + 1
     WHERE id = ? AND version = ? AND deleted_at IS NOT NULL`,
    [id, version]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function listEnteredStages(recordId, conn) {
  const [rows] = await executor(conn).execute(
    `SELECT * FROM payment_selection_stage
     WHERE record_id = ? ORDER BY id ASC`,
    [recordId]
  );
  return rows;
}

async function listEnteredStagesForRecords(recordIds) {
  if (!recordIds.length) return [];
  const placeholders = recordIds.map(() => '?').join(',');
  const [rows] = await getPool().execute(
    `SELECT * FROM payment_selection_stage
     WHERE record_id IN (${placeholders})
     ORDER BY record_id ASC, id ASC`,
    recordIds
  );
  return rows;
}

async function insertInitialStage(conn, recordId) {
  await conn.execute(
    `INSERT INTO payment_selection_stage (record_id, stage_code, stage_status)
     VALUES (?, 'selection', 'active')`,
    [recordId]
  );
}

async function listImages(recordId, category, conn) {
  const params = [recordId];
  const categoryClause = category ? 'AND category = ?' : '';
  if (category) params.push(category);
  const [rows] = await executor(conn).execute(
    `SELECT * FROM payment_selection_image
     WHERE record_id = ? AND deleted_at IS NULL ${categoryClause}
     ORDER BY category ASC, sort_order ASC, id ASC`,
    params
  );
  return rows;
}

async function listProductImagesForRecords(recordIds) {
  if (!recordIds.length) return [];
  const placeholders = recordIds.map(() => '?').join(',');
  const [rows] = await getPool().execute(
    `SELECT * FROM payment_selection_image
     WHERE record_id IN (${placeholders})
       AND category = 'product_main'
       AND deleted_at IS NULL
     ORDER BY record_id ASC, sort_order ASC, id ASC`,
    recordIds
  );
  return rows;
}

async function insertImage(conn, data) {
  const [result] = await conn.execute(
    `INSERT INTO payment_selection_image
       (record_id, category, storage_root, relative_path, original_name, mime_type,
        file_size, sort_order, source_task_file_id, uploader_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.recordId,
      data.category,
      data.storageRoot,
      data.relativePath,
      data.originalName || '',
      data.mimeType || '',
      data.fileSize || 0,
      data.sortOrder || 0,
      data.sourceTaskFileId || null,
      data.uploaderId || null
    ]
  );
  return result.insertId;
}

async function softDeleteImage(imageId, conn) {
  const [result] = await executor(conn).execute(
    `UPDATE payment_selection_image SET deleted_at = CURRENT_TIMESTAMP
     WHERE id = ? AND deleted_at IS NULL`,
    [imageId]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function findImageById(imageId, conn) {
  const [rows] = await executor(conn).execute(
    `SELECT * FROM payment_selection_image
     WHERE id = ? AND deleted_at IS NULL`,
    [imageId]
  );
  return rows[0] || null;
}

async function getNextImageSortOrder(recordId, category, conn) {
  const [rows] = await executor(conn).execute(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
     FROM payment_selection_image
     WHERE record_id = ? AND category = ? AND deleted_at IS NULL`,
    [recordId, category]
  );
  return Number(rows[0]?.next_order || 0);
}

async function updateImageOrder(conn, imageId, sortOrder) {
  await conn.execute(
    `UPDATE payment_selection_image SET sort_order = ?
     WHERE id = ? AND deleted_at IS NULL`,
    [sortOrder, imageId]
  );
}

async function findStage(recordId, stageCode, conn) {
  const [rows] = await executor(conn).execute(
    `SELECT * FROM payment_selection_stage
     WHERE record_id = ? AND stage_code = ?`,
    [recordId, stageCode]
  );
  return rows[0] || null;
}

async function loadStageData(recordId, stageCode, conn) {
  const fields = STAGE_FIELDS[stageCode];
  if (!fields) return null;
  if (stageCode === 'selection') {
    const [rows] = await executor(conn).execute(
      `SELECT ${fields.join(', ')} FROM payment_selection_record WHERE id = ?`,
      [recordId]
    );
    return rows[0] || null;
  }

  const table = STAGE_TABLES[stageCode];
  const [rows] = await executor(conn).execute(
    `SELECT ${fields.join(', ')} FROM ${table} WHERE record_id = ?`,
    [recordId]
  );
  const data = rows[0] || {};
  if (stageCode === 'monitoring') {
    const [adjustments] = await executor(conn).execute(
      `SELECT id, client_key, sort_order, reason, adjusted_at, detail_text, feedback_text
       FROM payment_selection_adjustment
       WHERE record_id = ? ORDER BY sort_order ASC, id ASC`,
      [recordId]
    );
    data.adjustments = adjustments;
  }
  return data;
}

async function ensureStageDataRow(conn, recordId, stageCode) {
  if (stageCode === 'selection') return;
  const table = STAGE_TABLES[stageCode];
  const [rows] = await conn.execute(`SELECT record_id FROM ${table} WHERE record_id = ?`, [recordId]);
  if (!rows.length) {
    await conn.execute(`INSERT INTO ${table} (record_id) VALUES (?)`, [recordId]);
  }
}

async function replaceAdjustments(conn, recordId, adjustments) {
  await conn.execute('DELETE FROM payment_selection_adjustment WHERE record_id = ?', [recordId]);
  for (let index = 0; index < adjustments.length; index += 1) {
    const item = adjustments[index] || {};
    await conn.execute(
      `INSERT INTO payment_selection_adjustment
         (record_id, sort_order, reason, adjusted_at, fee_ratio_7d, payers_7d,
          total_budget, detail_text, feedback_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        recordId,
        index,
        item.reason || '',
        item.adjusted_at || null,
        item.fee_ratio_7d ?? null,
        item.payers_7d ?? null,
        item.total_budget ?? null,
        item.detail_text || '',
        item.feedback_text || ''
      ]
    );
  }
}

async function saveStageData(conn, recordId, stageCode, data) {
  const fields = STAGE_FIELDS[stageCode];
  if (!fields) throw new Error(`Unsupported stage: ${stageCode}`);
  await ensureStageDataRow(conn, recordId, stageCode);

  const suppliedFields = fields.filter(field => Object.prototype.hasOwnProperty.call(data, field));
  if (suppliedFields.length) {
    const table = stageCode === 'selection' ? 'payment_selection_record' : STAGE_TABLES[stageCode];
    const idColumn = stageCode === 'selection' ? 'id' : 'record_id';
    await conn.execute(
      `UPDATE ${table} SET ${suppliedFields.map(field => `${field} = ?`).join(', ')}
       WHERE ${idColumn} = ?`,
      [...suppliedFields.map(field => data[field]), recordId]
    );
  }

  if (stageCode === 'monitoring' && Object.prototype.hasOwnProperty.call(data, 'adjustments')) {
    await replaceAdjustments(conn, recordId, data.adjustments || []);
  }
}

async function updateRecordWithVersion(conn, recordId, version, fields = {}) {
  const allowed = new Set([
    'current_stage', 'process_status', 'end_stage', 'end_type', 'end_reason', 'ended_at'
  ]);
  const entries = Object.entries(fields).filter(([field]) => allowed.has(field));
  const assignments = entries.map(([field]) => `${field} = ?`);
  const values = entries.map(([, value]) => value);
  const [result] = await conn.execute(
    `UPDATE payment_selection_record
     SET ${assignments.length ? `${assignments.join(', ')}, ` : ''}
         version = version + 1, update_time = CURRENT_TIMESTAMP
     WHERE id = ? AND version = ? AND deleted_at IS NULL`,
    [...values, recordId, version]
  );
  return Number(result.affectedRows || 0) === 1;
}

async function markStageCompleted(conn, recordId, stageCode) {
  await conn.execute(
    `UPDATE payment_selection_stage
     SET stage_status = 'completed', completed_at = CURRENT_TIMESTAMP, is_reopened = 0
     WHERE record_id = ? AND stage_code = ?`,
    [recordId, stageCode]
  );
}

async function markStageEnded(conn, recordId, stageCode) {
  await conn.execute(
    `UPDATE payment_selection_stage
     SET stage_status = 'ended', completed_at = CURRENT_TIMESTAMP, is_reopened = 0
     WHERE record_id = ? AND stage_code = ?`,
    [recordId, stageCode]
  );
}

async function restoreCurrentStage(conn, recordId, stageCode) {
  await conn.execute(
    `UPDATE payment_selection_stage
     SET stage_status = 'active', completed_at = NULL, is_reopened = 0
     WHERE record_id = ? AND stage_code = ?`,
    [recordId, stageCode]
  );
}

async function insertStage(conn, recordId, stageCode) {
  const existing = await findStage(recordId, stageCode, conn);
  if (existing) return existing.id;
  const [result] = await conn.execute(
    `INSERT INTO payment_selection_stage (record_id, stage_code, stage_status)
     VALUES (?, ?, 'active')`,
    [recordId, stageCode]
  );
  return result.insertId;
}

async function reopenStage(conn, recordId, stageCode) {
  await conn.execute(
    'UPDATE payment_selection_stage SET is_reopened = 0 WHERE record_id = ?',
    [recordId]
  );
  await conn.execute(
    `UPDATE payment_selection_stage SET is_reopened = 1
     WHERE record_id = ? AND stage_code = ? AND stage_status = 'completed'`,
    [recordId, stageCode]
  );
}

async function lockStage(conn, recordId, stageCode) {
  await conn.execute(
    `UPDATE payment_selection_stage SET is_reopened = 0
     WHERE record_id = ? AND stage_code = ?`,
    [recordId, stageCode]
  );
}

async function listListingCategories(options = {}) {
  const activeClause = options.includeInactive ? '' : 'WHERE active = 1';
  const [rows] = await getPool().execute(
    `SELECT id, name, sort_order, active, create_time, update_time
     FROM payment_listing_category ${activeClause}
     ORDER BY sort_order ASC, name ASC, id ASC`
  );
  return rows;
}

async function findListingCategoryById(id) {
  const [rows] = await getPool().execute(
    'SELECT id, name, sort_order, active, create_time, update_time FROM payment_listing_category WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

async function findListingCategoryByName(name) {
  const [rows] = await getPool().execute(
    'SELECT id, name, sort_order, active, create_time, update_time FROM payment_listing_category WHERE name = ?',
    [name]
  );
  return rows[0] || null;
}

async function insertListingCategory(data) {
  const [result] = await getPool().execute(
    `INSERT INTO payment_listing_category (name, sort_order, active)
     VALUES (?, ?, ?)`,
    [data.name, data.sortOrder ?? 0, data.active === false ? 0 : 1]
  );
  return findListingCategoryById(result.insertId);
}

async function updateListingCategory(id, data) {
  const [result] = await getPool().execute(
    `UPDATE payment_listing_category
     SET name = ?, sort_order = ?, active = ?, update_time = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [data.name, data.sortOrder ?? 0, data.active === false ? 0 : 1, id]
  );
  if (!Number(result.affectedRows || 0)) return null;
  return findListingCategoryById(id);
}

async function deleteListingCategory(id) {
  const [result] = await getPool().execute(
    'DELETE FROM payment_listing_category WHERE id = ?',
    [id]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function listPromotionMethods(options = {}) {
  const activeClause = options.includeInactive ? '' : 'WHERE active = 1';
  const [rows] = await getPool().execute(
    `SELECT id, name, sort_order, active, create_time, update_time
     FROM payment_promotion_method ${activeClause}
     ORDER BY sort_order ASC, name ASC, id ASC`
  );
  return rows;
}

async function findPromotionMethodById(id) {
  const [rows] = await getPool().execute(
    `SELECT id, name, sort_order, active, create_time, update_time
     FROM payment_promotion_method WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findPromotionMethodByName(name) {
  const [rows] = await getPool().execute(
    `SELECT id, name, sort_order, active, create_time, update_time
     FROM payment_promotion_method WHERE name = ?`,
    [name]
  );
  return rows[0] || null;
}

async function insertPromotionMethod(data) {
  const [result] = await getPool().execute(
    `INSERT INTO payment_promotion_method (name, sort_order, active) VALUES (?, ?, ?)`,
    [data.name, data.sortOrder ?? 0, data.active === false ? 0 : 1]
  );
  return findPromotionMethodById(result.insertId);
}

async function updatePromotionMethod(id, data) {
  const [result] = await getPool().execute(
    `UPDATE payment_promotion_method
     SET name = ?, sort_order = ?, active = ?, update_time = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [data.name, data.sortOrder ?? 0, data.active === false ? 0 : 1, id]
  );
  if (!Number(result.affectedRows || 0)) return null;
  return findPromotionMethodById(id);
}

async function deletePromotionMethod(id) {
  const [result] = await getPool().execute(
    'DELETE FROM payment_promotion_method WHERE id = ?',
    [id]
  );
  return Number(result.affectedRows || 0) > 0;
}

module.exports = {
  listRecords,
  countRecords,
  findRecordById,
  findRecordBySourceTaskId,
  allocateStoreSeq,
  insertRecord,
  softDeleteRecord,
  restoreDeletedRecord,
  listEnteredStages,
  listEnteredStagesForRecords,
  insertInitialStage,
  findStage,
  loadStageData,
  saveStageData,
  updateRecordWithVersion,
  markStageCompleted,
  markStageEnded,
  restoreCurrentStage,
  insertStage,
  reopenStage,
  lockStage,
  listListingCategories,
  findListingCategoryById,
  findListingCategoryByName,
  insertListingCategory,
  updateListingCategory,
  deleteListingCategory,
  listPromotionMethods,
  findPromotionMethodById,
  findPromotionMethodByName,
  insertPromotionMethod,
  updatePromotionMethod,
  deletePromotionMethod,
  listImages,
  listProductImagesForRecords,
  insertImage,
  softDeleteImage,
  findImageById,
  getNextImageSortOrder,
  updateImageOrder,
  STAGE_FIELDS
};
