const { randomUUID } = require('crypto');
const { getPool, getMode } = require('../../config/database');
const { STAGES } = require('./constants');

const STAGE_TABLES = {
  preparation: 'payment_selection_preparation',
  testing: 'payment_selection_testing',
  monitoring: 'payment_selection_monitoring',
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
  summary: ['exploded', 'link_maintenance', 'style_definition', 'summary_text', 'notes']
};

const DOWNSTREAM_TABLES = {
  testing: 'payment_selection_testing',
  monitoring: 'payment_selection_monitoring',
  summary: 'payment_selection_summary'
};

const STAGE_IMAGE_CATEGORIES = {
  monitoring: ['link_optimization', 'adjustment_feedback'],
  summary: []
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

async function createManagerReviewRequest(conn, data) {
  const [result] = await conn.execute(
    `INSERT INTO payment_manager_review_request
       (record_id, store, applicant_id, applicant_name, request_version)
     VALUES (?, ?, ?, ?, ?)`,
    [data.recordId, data.store, data.applicantId, data.applicantName || '', data.requestVersion]
  );
  return result.insertId;
}

async function findManagerReviewRequestByRecordId(recordId, options = {}) {
  const lockClause = options.forUpdate && getMode() === 'mysql' ? 'FOR UPDATE' : '';
  const [rows] = await executor(options.conn).execute(
    `SELECT * FROM payment_manager_review_request WHERE record_id = ? ${lockClause}`,
    [recordId]
  );
  return rows[0] || null;
}

async function findManagerReviewRequestById(id, options = {}) {
  const lockClause = options.forUpdate && getMode() === 'mysql' ? 'FOR UPDATE' : '';
  const [rows] = await executor(options.conn).execute(
    `SELECT * FROM payment_manager_review_request WHERE id = ? ${lockClause}`,
    [id]
  );
  return rows[0] || null;
}

function buildManagerReviewWhere(filters = {}) {
  const clauses = ['p.deleted_at IS NULL'];
  const params = [];
  if (filters.store) {
    clauses.push('r.store = ?');
    params.push(filters.store);
  }
  if (filters.keyword) {
    const like = `%${filters.keyword}%`;
    clauses.push('(p.style_number LIKE ? OR p.product_id LIKE ? OR p.source_task_no LIKE ? OR r.applicant_name LIKE ?)');
    params.push(like, like, like, like);
  }
  return { where: `WHERE ${clauses.join(' AND ')}`, params };
}

async function listManagerReviewRequests(filters = {}) {
  const { where, params } = buildManagerReviewWhere(filters);
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
  const offset = (page - 1) * pageSize;
  const [rows] = await getPool().execute(
    `SELECT r.*, p.store_seq, p.style_number, p.product_id, p.source_task_no,
            p.planner_name, p.current_stage, p.process_status,
            p.version AS record_version, p.create_time AS record_create_time
     FROM payment_manager_review_request r
     JOIN payment_selection_record p ON p.id = r.record_id
     ${where}
     ORDER BY r.create_time ASC, r.id ASC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  return rows;
}

async function countManagerReviewRequests(filters = {}) {
  const { where, params } = buildManagerReviewWhere(filters);
  const [rows] = await getPool().execute(
    `SELECT COUNT(*) AS total
     FROM payment_manager_review_request r
     JOIN payment_selection_record p ON p.id = r.record_id
     ${where}`,
    params
  );
  return Number(rows[0]?.total || 0);
}

async function listManagerReviewRequestsForRecords(recordIds) {
  if (!recordIds.length) return [];
  const placeholders = recordIds.map(() => '?').join(',');
  const [rows] = await getPool().execute(
    `SELECT * FROM payment_manager_review_request WHERE record_id IN (${placeholders})`,
    recordIds
  );
  return rows;
}

async function deleteManagerReviewRequest(conn, id) {
  const [result] = await conn.execute(
    'DELETE FROM payment_manager_review_request WHERE id = ?',
    [id]
  );
  return Number(result.affectedRows || 0) === 1;
}

async function deleteManagerReviewRequestByRecordId(conn, recordId) {
  const [result] = await conn.execute(
    'DELETE FROM payment_manager_review_request WHERE record_id = ?',
    [recordId]
  );
  return Number(result.affectedRows || 0) > 0;
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

async function listImages(recordId, category, conn, adjustmentId) {
  const params = [recordId];
  const categoryClause = category ? 'AND category = ?' : '';
  if (category) params.push(category);
  let adjustmentClause = '';
  if (adjustmentId !== undefined) {
    if (adjustmentId === null) {
      adjustmentClause = 'AND adjustment_id IS NULL';
    } else {
      adjustmentClause = 'AND adjustment_id = ?';
      params.push(adjustmentId);
    }
  }
  const [rows] = await executor(conn).execute(
    `SELECT * FROM payment_selection_image
     WHERE record_id = ? AND deleted_at IS NULL ${categoryClause} ${adjustmentClause}
     ORDER BY category ASC, adjustment_id ASC, sort_order ASC, id ASC`,
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

async function findLinkStatus(recordId, conn) {
  const [rows] = await executor(conn).execute(
    'SELECT * FROM payment_selection_link_status WHERE record_id = ?',
    [recordId]
  );
  return rows[0] || null;
}

async function listLinkStatusesForRecords(recordIds) {
  if (!recordIds.length) return [];
  const placeholders = recordIds.map(() => '?').join(',');
  const [rows] = await getPool().execute(
    `SELECT * FROM payment_selection_link_status
     WHERE record_id IN (${placeholders}) ORDER BY record_id ASC`,
    recordIds
  );
  return rows;
}

async function upsertLinkStatus(conn, recordId, stageCode, data) {
  const existing = await findLinkStatus(recordId, conn);
  const values = [
    stageCode,
    data.flashSaleRegistered,
    data.flashSaleGroup,
    data.rapidOrderEntered,
    data.newProductOperationRegistered,
    data.newProductPeak,
    data.productBurst,
    data.productBurstMode
  ];
  if (existing) {
    await conn.execute(
      `UPDATE payment_selection_link_status
       SET stage_code = ?, flash_sale_registered = ?, flash_sale_group = ?,
           rapid_order_entered = ?, new_product_operation_registered = ?,
           new_product_peak = ?, product_burst = ?, product_burst_mode = ?,
           update_time = CURRENT_TIMESTAMP
       WHERE record_id = ?`,
      [...values, recordId]
    );
    return;
  }
  await conn.execute(
    `INSERT INTO payment_selection_link_status
       (record_id, stage_code, flash_sale_registered, flash_sale_group,
        rapid_order_entered, new_product_operation_registered, new_product_peak,
        product_burst, product_burst_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [recordId, ...values]
  );
}

async function deleteLinkStatus(conn, recordId) {
  const [result] = await conn.execute(
    'DELETE FROM payment_selection_link_status WHERE record_id = ?',
    [recordId]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function insertImage(conn, data) {
  const [result] = await conn.execute(
    `INSERT INTO payment_selection_image
       (record_id, category, storage_root, relative_path, original_name, mime_type,
        file_size, sort_order, adjustment_id, source_task_file_id, uploader_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.recordId,
      data.category,
      data.storageRoot,
      data.relativePath,
      data.originalName || '',
      data.mimeType || '',
      data.fileSize || 0,
      data.sortOrder || 0,
      data.adjustmentId || null,
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

async function getNextImageSortOrder(recordId, category, conn, adjustmentId = null) {
  const adjustmentClause = adjustmentId === null ? 'AND adjustment_id IS NULL' : 'AND adjustment_id = ?';
  const params = adjustmentId === null
    ? [recordId, category]
    : [recordId, category, adjustmentId];
  const [rows] = await executor(conn).execute(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order
     FROM payment_selection_image
     WHERE record_id = ? AND category = ? AND deleted_at IS NULL ${adjustmentClause}`,
    params
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

async function findAdjustmentById(recordId, adjustmentId, conn) {
  const [rows] = await executor(conn).execute(
    `SELECT id, record_id, client_key, sort_order, reason, adjusted_at, detail_text, feedback_text
     FROM payment_selection_adjustment WHERE record_id = ? AND id = ?`,
    [recordId, adjustmentId]
  );
  return rows[0] || null;
}

async function findAdjustmentByClientKey(recordId, clientKey, conn) {
  if (!clientKey) return null;
  const [rows] = await executor(conn).execute(
    `SELECT id, record_id, client_key, sort_order, reason, adjusted_at, detail_text, feedback_text
     FROM payment_selection_adjustment WHERE record_id = ? AND client_key = ?`,
    [recordId, clientKey]
  );
  return rows[0] || null;
}

async function replaceAdjustments(conn, recordId, adjustments) {
  const [existingRows] = await conn.execute(
    'SELECT id, client_key FROM payment_selection_adjustment WHERE record_id = ?',
    [recordId]
  );
  await conn.execute(
    'UPDATE payment_selection_adjustment SET sort_order = -id WHERE record_id = ?',
    [recordId]
  );
  const retainedIds = [];
  for (let index = 0; index < adjustments.length; index += 1) {
    const item = adjustments[index] || {};
    const existing = item.id
      ? await findAdjustmentById(recordId, item.id, conn)
      : await findAdjustmentByClientKey(recordId, item.client_key, conn);
    const clientKey = existing?.client_key || item.client_key || `server-${randomUUID()}`;
    if (existing) {
      await conn.execute(
        `UPDATE payment_selection_adjustment
         SET client_key = ?, sort_order = ?, reason = ?, adjusted_at = ?,
             detail_text = ?, feedback_text = ?
         WHERE id = ? AND record_id = ?`,
        [
          clientKey,
          index,
          item.reason || '',
          item.adjusted_at || null,
          item.detail_text || '',
          item.feedback_text || '',
          existing.id,
          recordId
        ]
      );
      retainedIds.push(Number(existing.id));
    } else {
      const [result] = await conn.execute(
        `INSERT INTO payment_selection_adjustment
           (record_id, client_key, sort_order, reason, adjusted_at, detail_text, feedback_text)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          recordId,
          clientKey,
          index,
          item.reason || '',
          item.adjusted_at || null,
          item.detail_text || '',
          item.feedback_text || ''
        ]
      );
      retainedIds.push(Number(result.insertId));
    }
  }

  const removedIds = existingRows
    .map(row => Number(row.id))
    .filter(id => !retainedIds.includes(id));
  if (removedIds.length) {
    const placeholders = removedIds.map(() => '?').join(',');
    await conn.execute(
      `UPDATE payment_selection_image SET deleted_at = CURRENT_TIMESTAMP
       WHERE record_id = ? AND category = 'adjustment_feedback'
         AND adjustment_id IN (${placeholders}) AND deleted_at IS NULL`,
      [recordId, ...removedIds]
    );
    await conn.execute(
      `DELETE FROM payment_selection_adjustment
       WHERE record_id = ? AND id IN (${placeholders})`,
      [recordId, ...removedIds]
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

async function invalidateStagesAfter(conn, recordId, stageCode) {
  const stageIndex = STAGES.indexOf(stageCode);
  if (stageIndex < 0) throw new Error(`Unsupported stage: ${stageCode}`);
  const downstreamStages = STAGES.slice(stageIndex + 1);
  if (!downstreamStages.length) return;

  const categories = downstreamStages.flatMap(code => STAGE_IMAGE_CATEGORIES[code] || []);
  if (categories.length) {
    const categoryPlaceholders = categories.map(() => '?').join(',');
    await conn.execute(
      `UPDATE payment_selection_image SET deleted_at = CURRENT_TIMESTAMP
       WHERE record_id = ? AND category IN (${categoryPlaceholders}) AND deleted_at IS NULL`,
      [recordId, ...categories]
    );
  }

  if (downstreamStages.includes('monitoring')) {
    await conn.execute(
      'DELETE FROM payment_selection_adjustment WHERE record_id = ?',
      [recordId]
    );
  }

  for (const code of [...downstreamStages].reverse()) {
    const table = DOWNSTREAM_TABLES[code];
    if (table) await conn.execute(`DELETE FROM ${table} WHERE record_id = ?`, [recordId]);
  }

  const stagePlaceholders = downstreamStages.map(() => '?').join(',');
  await conn.execute(
    `DELETE FROM payment_selection_link_status
     WHERE record_id = ? AND stage_code IN (${stagePlaceholders})`,
    [recordId, ...downstreamStages]
  );
  await conn.execute(
    `DELETE FROM payment_selection_stage
     WHERE record_id = ? AND stage_code IN (${stagePlaceholders})`,
    [recordId, ...downstreamStages]
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
  createManagerReviewRequest,
  findManagerReviewRequestByRecordId,
  findManagerReviewRequestById,
  listManagerReviewRequests,
  countManagerReviewRequests,
  listManagerReviewRequestsForRecords,
  deleteManagerReviewRequest,
  deleteManagerReviewRequestByRecordId,
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
  invalidateStagesAfter,
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
  findLinkStatus,
  listLinkStatusesForRecords,
  upsertLinkStatus,
  deleteLinkStatus,
  insertImage,
  softDeleteImage,
  findImageById,
  getNextImageSortOrder,
  updateImageOrder,
  findAdjustmentById,
  findAdjustmentByClientKey,
  STAGE_FIELDS
};
