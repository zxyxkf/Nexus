const { getPool } = require('../../config/database');

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
  const [rows] = await getPool().execute(
    `SELECT * FROM payment_selection_record WHERE id = ? ${deletedClause}`,
    [id]
  );
  return rows[0] || null;
}

async function findRecordBySourceTaskId(sourceTaskId) {
  const [rows] = await getPool().execute(
    `SELECT * FROM payment_selection_record
     WHERE source_task_id = ? AND deleted_at IS NULL`,
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

async function softDeleteRecord(id) {
  const [result] = await getPool().execute(
    `UPDATE payment_selection_record
     SET deleted_at = CURRENT_TIMESTAMP, update_time = CURRENT_TIMESTAMP, version = version + 1
     WHERE id = ? AND deleted_at IS NULL`,
    [id]
  );
  return Number(result.affectedRows || 0) > 0;
}

async function listEnteredStages(recordId) {
  const [rows] = await getPool().execute(
    `SELECT * FROM payment_selection_stage
     WHERE record_id = ? ORDER BY id ASC`,
    [recordId]
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

async function listImages(recordId, category) {
  const params = [recordId];
  const categoryClause = category ? 'AND category = ?' : '';
  if (category) params.push(category);
  const [rows] = await getPool().execute(
    `SELECT * FROM payment_selection_image
     WHERE record_id = ? AND deleted_at IS NULL ${categoryClause}
     ORDER BY category ASC, sort_order ASC, id ASC`,
    params
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

async function softDeleteImage(imageId) {
  const [result] = await getPool().execute(
    `UPDATE payment_selection_image SET deleted_at = CURRENT_TIMESTAMP
     WHERE id = ? AND deleted_at IS NULL`,
    [imageId]
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
  listEnteredStages,
  insertInitialStage,
  listImages,
  insertImage,
  softDeleteImage
};
