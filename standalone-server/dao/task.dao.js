/**
 * 任务 DAO — 所有 task 相关 SQL 集中管理
 * 非事务方法自管连接；事务方法接受 conn 参数共享 FOR UPDATE 锁
 */
const { getPool, executeTransaction, execute } = require('../config/database');
const { decorateTaskFilesWithWatermarkLabels } = require('../utils/task-file-watermark');

const MIME_MAP = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp'
};

// ==================== 工具 ====================

function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

/** 生成任务编号：D/O/C + 本地日期 + 4位序号 */
async function generateTaskNo(conn, taskGroup = 'design') {
  const prefixMap = { design: 'D', operator: 'O', cs: 'C' };
  const dateStr = localDateString();
  const prefix = `${prefixMap[taskGroup] || 'D'}${dateStr}`;
  const [rows] = await conn.execute(
    `SELECT MAX(task_no) as max_no FROM task_info WHERE task_no LIKE ?`,
    [`${prefix}%`]
  );
  const maxNo = rows[0].max_no;
  const lastSeq = maxNo ? parseInt(maxNo.slice(-4)) : 0;
  return `${prefix}${String(lastSeq + 1).padStart(4, '0')}`;
}

/** 分页查询辅助 */
async function paginate({ countSql, countParams, dataSql, dataParams, page, pageSize }) {
  const pool = getPool();
  const [[{ total }]] = await pool.execute(countSql, countParams);
  const [rows] = await pool.execute(dataSql, dataParams);
  return {
    list: rows,
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    totalPages: Math.ceil(total / parseInt(pageSize))
  };
}

// 任务列表可排序字段白名单：前端只能按这些字段排序。
// 字段名在这里写死，前端传入的 sortField 仅用于查表，永远不会被拼进 SQL，
// 因此不存在 SQL 注入面。方向只接受 ASC / DESC 两个常量。
const TASK_SORT_COLUMNS = {
  create_time: 't.create_time',
  task_no: 't.task_no',
  status: 't.status'
};

/**
 * 构造安全的 ORDER BY 子句。
 * @param {string} sortField 前端传入的排序字段（需命中白名单，否则忽略）
 * @param {string} sortOrder 'asc' | 'desc'
 * @param {string} fallback  未指定排序时使用的默认 ORDER BY 子句（不含 "ORDER BY"）
 */
function buildTaskOrderBy(sortField, sortOrder, fallback) {
  const column = TASK_SORT_COLUMNS[sortField];
  if (!column) return `ORDER BY ${fallback}`;
  const direction = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
  // 次级排序用 id 保证分页稳定（同值行顺序确定）
  return `ORDER BY ${column} ${direction}, t.id ${direction}`;
}

/** 批量挂载文件到任务 */
async function attachFilesToTasks(taskIds) {
  const filesByTask = {};
  if (!taskIds.length) return filesByTask;

  const pool = getPool();
  const placeholders = taskIds.map(() => '?').join(',');
  const [files] = await pool.execute(
    `SELECT tf.*, t.task_no, t.selected_effect_file_ids, tr.reject_index
     FROM task_file tf
     INNER JOIN task_info t ON t.id = tf.task_id
     LEFT JOIN task_reject_record tr ON tr.id = tf.reject_record_id
     WHERE tf.task_id IN (${placeholders})
     ORDER BY tf.create_time ASC, tf.id ASC`,
    taskIds
  );
  const decoratedFiles = decorateTaskFilesWithWatermarkLabels(files);
  for (const f of decoratedFiles) {
    if (!filesByTask[f.task_id]) filesByTask[f.task_id] = [];
    const selectedEffectFileIds = parseSelectedEffectFileIds(f.selected_effect_file_ids);
    filesByTask[f.task_id].push({
      ...f,
      is_selected_effect: selectedEffectFileIds.has(Number(f.id)),
      fileUrl: `/api/task/preview/${f.id}`,
      downloadUrl: `/api/task/download/${f.id}`
    });
  }
  return filesByTask;
}

function parseSelectedEffectFileIds(value) {
  if (Array.isArray(value)) {
    return new Set(value.map(Number).filter(id => Number.isInteger(id) && id > 0));
  }
  if (typeof value !== 'string' || !value.trim()) return new Set();
  try {
    const parsed = JSON.parse(value);
    return parseSelectedEffectFileIds(parsed);
  } catch (_) {
    return new Set();
  }
}

// ==================== CRUD ====================

/** 查找指定角色的设计师（事务内，用于直接分配） */
async function findDesigner(conn, id, role) {
  const [rows] = await conn.execute(
    `SELECT id, real_name FROM sys_user WHERE id = ? AND role = ? AND status = 1`,
    [id, role]
  );
  return rows[0] || null;
}

/** 插入任务记录（事务内），返回 insertId */
async function insertTask(conn, data) {
  const [result] = await conn.execute(
    `INSERT INTO task_info
       (task_no, title, description, priority, deadline, publisher_id, status,
        publisher_name, score_item_id, score, ref_path, style_number,
        specified_color, wangwang_id, designer_id, designer_name,
        task_group, shop_name, quantity, task_file_path, accept_time)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.taskNo, data.title, data.description, data.priority, data.deadline,
      data.publisherId, data.status, data.publisherName,
      data.scoreItemId, data.score, data.refPath, data.styleNumber,
      data.specifiedColor, data.wangwangId, data.designerId, data.designerName,
      data.taskGroup, data.shopName, data.quantity, data.taskFilePath,
      data.acceptTime || null
    ]
  );
  return result.insertId;
}

/** 查询任务详情（不含文件） */
async function getTaskDetail(taskId) {
  const pool = getPool();
  const [tasks] = await pool.execute(
    `SELECT t.*, u1.real_name as publisher_name, COALESCE(u1.store, '') as publisher_store,
            u2.real_name as designer_name,
            COALESCE(si.requires_manual_score, 0) AS requires_manual_score
     FROM task_info t
     LEFT JOIN sys_user u1 ON t.publisher_id = u1.id
     LEFT JOIN sys_user u2 ON t.designer_id = u2.id
     LEFT JOIN sys_score_item si ON t.score_item_id = si.id
       AND COALESCE(NULLIF(t.task_group, ''), 'design') = 'design'
     WHERE t.id = ?`, [taskId]
  );
  return tasks[0] || null;
}

/** 查询任务文件 */
async function getTaskFiles(taskId) {
  const pool = getPool();
  const [files] = await pool.execute(
    `SELECT tf.*, t.task_no, t.selected_effect_file_ids, tr.reject_index
     FROM task_file tf
     INNER JOIN task_info t ON t.id = tf.task_id
     LEFT JOIN task_reject_record tr ON tr.id = tf.reject_record_id
     WHERE tf.task_id = ?
     ORDER BY tf.create_time ASC, tf.id ASC`,
    [taskId]
  );
  return decorateTaskFilesWithWatermarkLabels(files).map(f => ({
    ...f,
    is_selected_effect: parseSelectedEffectFileIds(f.selected_effect_file_ids).has(Number(f.id)),
    fileUrl: `/api/task/preview/${f.id}`,
    downloadUrl: `/api/task/download/${f.id}`
  }));
}

/** 锁行查询（事务内 FOR UPDATE） */
async function getTaskTransferRecords(taskId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT *
     FROM task_transfer_record
     WHERE task_id = ?
     ORDER BY create_time ASC, id ASC`,
    [taskId]
  );
  return rows || [];
}

async function getTaskRejectRecords(taskId) {
  const pool = getPool();
  const [records] = await pool.execute(
    `SELECT *
     FROM task_reject_record
     WHERE task_id = ?
     ORDER BY reject_index ASC, create_time ASC, id ASC`,
    [taskId]
  );
  const rows = records || [];
  if (!rows.length) return [];

  const ids = rows.map(r => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const [files] = await pool.execute(
    `SELECT tf.*, t.task_no, t.selected_effect_file_ids
     FROM task_file tf
     INNER JOIN task_info t ON t.id = tf.task_id
     WHERE tf.reject_record_id IN (${placeholders})
     ORDER BY tf.create_time ASC, tf.id ASC`,
    ids
  );
  const rejectIndexes = new Map(rows.map(row => [String(row.id), row.reject_index]));
  const decoratedFiles = decorateTaskFilesWithWatermarkLabels((files || []).map(file => ({
    ...file,
    reject_index: rejectIndexes.get(String(file.reject_record_id))
  })));
  const filesByReject = {};
  for (const f of decoratedFiles) {
    if (!filesByReject[f.reject_record_id]) filesByReject[f.reject_record_id] = [];
    filesByReject[f.reject_record_id].push({
      ...f,
      is_selected_effect: parseSelectedEffectFileIds(f.selected_effect_file_ids).has(Number(f.id)),
      fileUrl: `/api/task/preview/${f.id}`,
      downloadUrl: `/api/task/download/${f.id}`
    });
  }

  return rows.map(row => ({
    ...row,
    files: filesByReject[row.id] || []
  }));
}

async function getTaskForUpdate(conn, taskId) {
  const [rows] = await conn.execute(
    `SELECT t.id, t.title, t.task_no, t.status, t.publisher_id, t.publisher_name,
            t.designer_id, t.designer_name, t.task_group,
            t.score_item_id, t.score, t.applied_score, t.score_review_status, t.score_review_score,
            t.handoff_status, t.handoff_time,
            COALESCE(u.store, '') AS publisher_store
     FROM task_info t
     LEFT JOIN sys_user u ON u.id = t.publisher_id
     WHERE t.id = ? FOR UPDATE`,
    [taskId]
  );
  return rows[0] || null;
}

async function getDesignScoreItemsForUpdate(conn, scoreItemIds) {
  const ids = [...new Set((scoreItemIds || [])
    .map(Number)
    .filter(id => Number.isInteger(id) && id > 0))];
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const [rows] = await conn.execute(
    `SELECT id, name, COALESCE(requires_manual_score, 0) AS requires_manual_score
     FROM sys_score_item
     WHERE id IN (${placeholders})
     FOR UPDATE`,
    ids
  );
  return rows;
}

/** 更新任务字段（事务内） */
async function updateTaskFields(conn, taskId, fields) {
  const setClauses = [];
  const values = [];
  for (const [key, val] of Object.entries(fields)) {
    setClauses.push(`${key} = ?`);
    values.push(val);
  }
  if (setClauses.length === 0) return;
  values.push(taskId);
  await conn.execute(
    `UPDATE task_info SET ${setClauses.join(', ')}, update_time = NOW() WHERE id = ?`,
    values
  );
}

/** 删除任务及所有关联数据 */
async function insertTransferRecord(conn, data) {
  await conn.execute(
    `INSERT INTO task_transfer_record
       (task_id, from_designer_id, from_designer_name, to_designer_id, to_designer_name, operator_id, operator_name, transfer_reason)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      data.taskId,
      data.fromDesignerId || null,
      data.fromDesignerName || '',
      data.toDesignerId || null,
      data.toDesignerName || '',
      data.operatorId || null,
      data.operatorName || '',
      data.reason || ''
    ]
  );
}

async function insertRejectRecord(conn, data) {
  const [rows] = await conn.execute(
    `SELECT COALESCE(MAX(reject_index), 0) + 1 AS next_index
     FROM task_reject_record
     WHERE task_id = ?`,
    [data.taskId]
  );
  const rejectIndex = Number(rows?.[0]?.next_index) || 1;
  const appliedScore = Number(data.appliedScore);
  const [result] = await conn.execute(
    `INSERT INTO task_reject_record
       (task_id, reject_index, reviewer_id, reviewer_name, reject_reason, applied_score)
     VALUES (?,?,?,?,?,?)`,
    [
      data.taskId,
      rejectIndex,
      data.reviewerId || null,
      data.reviewerName || '',
      data.reason || '',
      Number.isFinite(appliedScore) && appliedScore >= 1 ? appliedScore : 1
    ]
  );
  return { id: result.insertId || result.lastID, rejectIndex };
}

async function completeRejectRecord(conn, data) {
  const [result] = await conn.execute(
    `UPDATE task_reject_record
     SET designer_reply = ?, designer_id = ?, designer_name = ?,
         designer_complete_time = NOW(), applied_score = ?
     WHERE id = ? AND task_id = ? AND designer_complete_time IS NULL`,
    [
      data.reply || '',
      data.designerId || null,
      data.designerName || '',
      Number(data.appliedScore) || 1,
      data.recordId,
      data.taskId
    ]
  );
  return Number(result.affectedRows || 0);
}

async function getLatestRejectRecordForUpdate(conn, taskId) {
  const [rows] = await conn.execute(
    `SELECT * FROM task_reject_record
     WHERE task_id = ?
     ORDER BY reject_index DESC, id DESC
     LIMIT 1 FOR UPDATE`,
    [taskId]
  );
  return rows[0] || null;
}

async function countIncompleteRejectRecords(conn, taskId) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS total
     FROM task_reject_record
     WHERE task_id = ? AND designer_complete_time IS NULL`,
    [taskId]
  );
  return Number(rows[0]?.total || 0);
}

async function reopenRejectRecord(conn, recordId, taskId) {
  const [result] = await conn.execute(
    `UPDATE task_reject_record
     SET designer_complete_time = NULL
     WHERE id = ? AND task_id = ? AND designer_complete_time IS NOT NULL`,
    [recordId, taskId]
  );
  return Number(result.affectedRows || 0);
}

async function getRecordWorkFilesForUpdate(conn, taskId, recordId) {
  const [rows] = await conn.execute(
    `SELECT * FROM task_file
     WHERE task_id = ? AND file_category = 'work' AND reject_record_id = ?
     ORDER BY create_time ASC, id ASC FOR UPDATE`,
    [taskId, recordId]
  );
  return rows || [];
}

async function getWorkImageFilesForUpdate(conn, taskId) {
  const [rows] = await conn.execute(
    `SELECT tf.id, tf.task_id, tf.file_category, tf.file_type, tf.reject_record_id,
            tr.reject_index
     FROM task_file tf
     LEFT JOIN task_reject_record tr ON tr.id = tf.reject_record_id
     WHERE tf.task_id = ? AND tf.file_category = 'work' AND tf.file_type = 'image'
     ORDER BY tf.create_time ASC, tf.id ASC FOR UPDATE`,
    [taskId]
  );
  return rows || [];
}

async function getInitialWorkFilesForUpdate(conn, taskId) {
  const [rows] = await conn.execute(
    `SELECT * FROM task_file
     WHERE task_id = ? AND file_category = 'work' AND reject_record_id IS NULL
     ORDER BY create_time ASC, id ASC FOR UPDATE`,
    [taskId]
  );
  return rows || [];
}

async function deleteFileRecords(conn, fileIds) {
  if (!fileIds.length) return 0;
  const placeholders = fileIds.map(() => '?').join(',');
  const [result] = await conn.execute(
    `DELETE FROM task_file WHERE id IN (${placeholders})`,
    fileIds
  );
  return Number(result.affectedRows || 0);
}

async function deleteTaskData(taskId) {
  await execute(`DELETE FROM task_reject_record WHERE task_id = ?`, [taskId]);
  await execute(`DELETE FROM task_transfer_record WHERE task_id = ?`, [taskId]);
  await execute(`DELETE FROM task_file WHERE task_id = ?`, [taskId]);
  await execute(`DELETE FROM sys_comment WHERE task_id = ?`, [taskId]);
  await execute(`DELETE FROM sys_score_record WHERE task_id = ?`, [taskId]);
  await execute(`DELETE FROM task_info WHERE id = ?`, [taskId]);
}

/** 批量删除 */
async function batchDeleteTasks(taskIds) {
  const placeholders = taskIds.map(() => '?').join(',');
  await execute(`DELETE FROM task_reject_record WHERE task_id IN (${placeholders})`, taskIds);
  await execute(`DELETE FROM task_transfer_record WHERE task_id IN (${placeholders})`, taskIds);
  await execute(`DELETE FROM task_file WHERE task_id IN (${placeholders})`, taskIds);
  await execute(`DELETE FROM task_info WHERE id IN (${placeholders})`, taskIds);
}

/** 批量重新分配 */
async function batchReassignTasks(taskIds, designerId, designerName) {
  const placeholders = taskIds.map(() => '?').join(',');
  const [result] = await execute(
    `UPDATE task_info SET designer_id = ?, designer_name = ?, status = 'accepted', accept_time = NOW(), update_time = NOW()
     WHERE id IN (${placeholders}) AND status = 'wait'`,
    [designerId, designerName, ...taskIds]
  );
  return result;
}

// ==================== 文件操作 ====================

/** 插入文件记录（事务内） */
async function insertFileRecord(conn, data) {
  await conn.execute(
    `INSERT INTO task_file (task_id, file_name, file_path, file_size, file_type, mime_type, uploader_id, file_category, reject_record_id)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      data.taskId, data.fileName, data.filePath, data.fileSize,
      data.fileType, data.mimeType, data.uploaderId, data.fileCategory,
      data.rejectRecordId || null
    ]
  );
}

async function deleteFilesByCategory(conn, taskId, fileCategory) {
  const [oldFiles] = await conn.execute(
    `SELECT * FROM task_file WHERE task_id = ? AND file_category = ?`, [taskId, fileCategory]
  );
  for (const f of oldFiles) {
    try {
      const absPath = resolvePath(f.file_path);
      if (absPath && require('fs').existsSync(absPath)) require('fs').unlinkSync(absPath);
    } catch (_) {}
    await conn.execute(`DELETE FROM task_file WHERE id = ?`, [f.id]);
  }
}

/** 删除作品文件记录及物理文件（事务内） */
async function deleteWorkFiles(conn, taskId) {
  await deleteFilesByCategory(conn, taskId, 'work');
}

/** 更新任务状态（事务内） */
async function updateTaskStatus(conn, taskId, status, extra = {}) {
  const setParts = ['status = ?', 'update_time = NOW()'];
  const values = [status];
  // 每次重新提交都刷新上传提交时间，详情页展示的始终是最近一次提交。
  if (status === 'doing') {
    setParts.push('submit_time = NOW()');
  }
  for (const [key, val] of Object.entries(extra)) {
    setParts.push(`${key} = ?`);
    values.push(val);
  }
  values.push(taskId);
  await conn.execute(`UPDATE task_info SET ${setParts.join(', ')} WHERE id = ?`, values);
}

/** 查询任务的发布者/执行人信息 */
async function getTaskBrief(taskId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, title, task_no, publisher_id, designer_id, task_group, status FROM task_info WHERE id = ?`, [taskId]
  );
  return rows[0] || null;
}

// ==================== 查询 ====================

const TASK_SELECT = `t.*, u1.real_name as publisher_name, u1.username as publisher_username,
  COALESCE(u1.store, '') as publisher_store,
  u2.real_name as designer_name, u2.username as designer_username,
  COALESCE(si.requires_manual_score, 0) AS requires_manual_score,
  EXISTS (
    SELECT 1 FROM payment_selection_record ptr
    WHERE ptr.source_task_id = t.id AND ptr.deleted_at IS NULL
  ) AS payment_tracking_opened`;
const TASK_JOIN = `LEFT JOIN sys_user u1 ON t.publisher_id = u1.id
                    LEFT JOIN sys_user u2 ON t.designer_id = u2.id
                    LEFT JOIN sys_score_item si ON t.score_item_id = si.id
                      AND COALESCE(NULLIF(t.task_group, ''), 'design') = 'design'`;

function taskDateColumn(dateField) {
  if (dateField === 'finish') return 't.finish_time';
  if (dateField === 'submit') return 't.submit_time';
  return 't.create_time';
}

function appendStatusFilter(where, params, status) {
  if (!status) return where;
  const statuses = String(status)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (statuses.length === 0) return where;
  if (statuses.length === 1) {
    params.push(statuses[0]);
    return `${where} AND t.status = ?`;
  }
  params.push(...statuses);
  return `${where} AND t.status IN (${statuses.map(() => '?').join(',')})`;
}

/** 我发布的任务 */
async function queryMyPublished({ userId, role, store, permissions = [], filterGroup, selfOnly, reviewView = false, reviewScope = '', paymentOpenView = false, canViewAllPaymentTasks = false, status, styleNumber, keyword, taskNo, designerId, publisherId, dateStart, dateEnd, dateField, sortField, sortOrder, page, pageSize }) {
  const offset = (page - 1) * pageSize;
  let where = 'WHERE 1=1';
  const params = [];
  const group = filterGroup || (role === 'cs_agent' ? 'cs' : 'design');
  const hasPerm = (code) => role === 'admin' || role === 'sub_admin' || permissions.includes(code);
  const dateColumn = taskDateColumn(dateField);

  if (paymentOpenView) {
    where += " AND COALESCE(NULLIF(t.task_group, ''), 'design') = 'design'";
    if (!canViewAllPaymentTasks) {
      where += ' AND t.publisher_id IN (SELECT id FROM sys_user WHERE store = ?)';
      params.push(store || '');
    }
  } else if (reviewView) {
    if (group === 'design') where += " AND (t.task_group = ? OR t.task_group IS NULL OR t.task_group = '')";
    else where += ' AND t.task_group = ?';
    params.push(group);

    if (reviewScope === 'store' && store) {
      where += ' AND t.publisher_id IN (SELECT id FROM sys_user WHERE store = ?)';
      params.push(store);
    } else if (reviewScope !== 'all') {
      where += ' AND t.publisher_id = ?';
      params.push(userId);
    }
  } else if (role === 'admin' || role === 'sub_admin') {
    if (group === 'design') where += ' AND (t.task_group = ? OR t.task_group IS NULL OR t.task_group = \'\')';
    else where += ' AND t.task_group = ?';
    params.push(group);
  } else if (group === 'cs') {
    where += ' AND t.publisher_id = ? AND t.task_group = ?';
    params.push(userId, group);
  } else if (selfOnly || !hasPerm('task.view.store')) {
    where += ' AND t.publisher_id = ? AND t.task_group = ?';
    params.push(userId, group);
  } else {
    where += ' AND t.publisher_id IN (SELECT id FROM sys_user WHERE role = \'operator\' AND store = (SELECT store FROM sys_user WHERE id = ?)) AND t.task_group = ?';
    params.push(userId, group);
  }

  const requiredPerm = group === 'operator' ? 'operator.tasks.assistant' : group === 'cs' ? 'cs.tasks.basic' : 'operator.tasks.design';
  const reviewPerm = group === 'operator' ? 'operator.review.assistant' : group === 'cs' ? 'cs.review.basic' : 'operator.review.design';
  const paymentOnlyReview = reviewView && group === 'design' && hasPerm('payment.open');
  if (!paymentOpenView && !paymentOnlyReview && !hasPerm(requiredPerm) && !hasPerm(reviewPerm) && role !== 'admin' && role !== 'sub_admin') {
    where += ' AND 1=0';
  }

  if (group === 'cs') {
    where += " AND COALESCE(t.handoff_status, '') <> 'pooled'";
  }

  where = appendStatusFilter(where, params, status);
  if (styleNumber) { where += ' AND t.style_number LIKE ?'; params.push(`%${styleNumber}%`); }
  if (keyword) { where += ' AND (t.wangwang_id LIKE ? OR t.style_number LIKE ? OR t.title LIKE ? OR t.task_no LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
  if (taskNo) { where += ' AND t.task_no LIKE ?'; params.push(`%${taskNo}%`); }
  if (designerId) { where += ' AND t.designer_id = ?'; params.push(designerId); }
  if (publisherId) { where += ' AND t.publisher_id = ?'; params.push(publisherId); }
  if (dateStart) { where += ` AND ${dateColumn} >= ?`; params.push(dateStart + ' 00:00:00'); }
  if (dateEnd) { where += ` AND ${dateColumn} <= ?`; params.push(dateEnd + ' 23:59:59'); }

  const result = await paginate({
    countSql: `SELECT COUNT(*) as total FROM task_info t ${where}`,
    countParams: params,
    dataSql: `SELECT ${TASK_SELECT} FROM task_info t ${TASK_JOIN} ${where} ${buildTaskOrderBy(sortField, sortOrder, 't.create_time DESC')} LIMIT ? OFFSET ?`,
    dataParams: [...params, pageSize, offset],
    page, pageSize
  });
  result.list = await attachFilesToTasksForList(result.list);
  return result;
}

async function queryPooledCsTasks({ keyword, status, designerId, page, pageSize }) {
  const offset = (page - 1) * pageSize;
  let where = "WHERE t.task_group = 'cs' AND t.handoff_status = 'pooled'";
  const params = [];

  where = appendStatusFilter(where, params, status);
  if (designerId) {
    where += ' AND t.designer_id = ?';
    params.push(designerId);
  }
  if (keyword) {
    const value = `%${keyword}%`;
    where += ' AND (t.wangwang_id LIKE ? OR t.style_number LIKE ? OR t.title LIKE ? OR t.task_no LIKE ? OR t.designer_name LIKE ?)';
    params.push(value, value, value, value, value);
  }

  const result = await paginate({
    countSql: `SELECT COUNT(*) as total FROM task_info t ${where}`,
    countParams: params,
    dataSql: `SELECT ${TASK_SELECT} FROM task_info t ${TASK_JOIN} ${where}
              ORDER BY t.handoff_time DESC, t.update_time DESC, t.id DESC
              LIMIT ? OFFSET ?`,
    dataParams: [...params, pageSize, offset],
    page,
    pageSize
  });
  result.list = await attachFilesToTasksForList(result.list);
  return result;
}

/** 我接单的任务 */
async function queryMyAccepted({ userId, role, permissions = [], taskGroup, status, keyword, publisherId, scoreItemId, dateStart, dateEnd, dateField, shopName, page, pageSize }) {
  const offset = (page - 1) * pageSize;
  let where = 'WHERE t.designer_id = ?';
  const params = [userId];
  const group = taskGroup || (role === 'basic_designer' ? 'cs' : role === 'operator_assistant' ? 'operator' : 'design');
  const hasPerm = (code) => role === 'admin' || role === 'sub_admin' || permissions.includes(code);
  const requiredPerm = group === 'cs' ? 'basic.tasks.cs' : group === 'operator' ? 'assistant.tasks.operator' : 'designer.tasks.design';
  const dateColumn = taskDateColumn(dateField);

  if (!hasPerm(requiredPerm)) {
    where += ' AND 1=0';
  }

  if (group === 'design') {
    where += ' AND (t.task_group = ? OR t.task_group IS NULL OR t.task_group = \'\')';
    params.push(group);
  } else {
    where += ' AND t.task_group = ?';
    params.push(group);
  }

  where = appendStatusFilter(where, params, status);
  if (keyword) { where += ' AND (t.wangwang_id LIKE ? OR t.style_number LIKE ? OR t.title LIKE ? OR t.task_no LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
  if (publisherId) { where += ' AND t.publisher_id = ?'; params.push(publisherId); }
  if (scoreItemId) { where += ' AND t.score_item_id = ?'; params.push(scoreItemId); }
  if (dateStart) { where += ` AND ${dateColumn} >= ?`; params.push(dateStart + ' 00:00:00'); }
  if (dateEnd) { where += ` AND ${dateColumn} <= ?`; params.push(dateEnd + ' 23:59:59'); }
  if (shopName) { where += ' AND t.shop_name = ?'; params.push(shopName); }

  const result = await paginate({
    countSql: `SELECT COUNT(*) as total FROM task_info t ${where}`,
    countParams: params,
    dataSql: `SELECT ${TASK_SELECT} FROM task_info t ${TASK_JOIN} ${where}
              ORDER BY
                CASE WHEN t.status = 'accepted' AND t.urge_time IS NOT NULL THEN 0 ELSE 1 END,
                t.urge_time DESC,
                t.update_time DESC
              LIMIT ? OFFSET ?`,
    dataParams: [...params, pageSize, offset],
    page, pageSize
  });
  result.list = await attachFilesToTasksForList(result.list);
  return result;
}

/** 任务大厅 */
async function queryTaskHall({ role, permissions = [], taskGroup, keyword, sortField, sortOrder, page, pageSize }) {
  const offset = (page - 1) * pageSize;
  let where = 'WHERE t.status = \'wait\'';
  const params = [];
  const group = taskGroup || (role === 'basic_designer' ? 'cs' : role === 'operator_assistant' ? 'operator' : 'design');
  const hasPerm = (code) => role === 'admin' || permissions.includes(code);
  const requiredPerm = group === 'cs' ? 'basic.hall.cs' : group === 'operator' ? 'assistant.hall.operator' : 'designer.hall.design';

  if (!hasPerm(requiredPerm)) {
    where += ' AND 1=0';
  }

  if (group === 'design') {
    where += ' AND (t.task_group = ? OR t.task_group IS NULL OR t.task_group = \'\')';
    params.push(group);
  } else {
    where += ' AND t.task_group = ?';
    params.push(group);
  }

  if (keyword) { where += ' AND (t.title LIKE ? OR t.task_no LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }

  const pool = getPool();
  const [[{ total }]] = await pool.execute(`SELECT COUNT(*) as total FROM task_info t ${where}`, params);
  const [rows] = await pool.execute(
    `SELECT t.*, u1.real_name as publisher_name,
            COALESCE(si.name, cs.name, op.name) as score_item_name,
            COALESCE(si.score, cs.score, op.score) as item_score,
            COALESCE(si.requires_manual_score, 0) AS requires_manual_score
     FROM task_info t
     LEFT JOIN sys_user u1 ON t.publisher_id = u1.id
     LEFT JOIN sys_score_item si ON t.score_item_id = si.id
       AND COALESCE(NULLIF(t.task_group, ''), 'design') = 'design'
     LEFT JOIN sys_score_item_cs cs ON t.score_item_id = cs.id AND t.task_group = 'cs'
     LEFT JOIN sys_score_item_operator op ON t.score_item_id = op.id AND t.task_group = 'operator'
     ${where}
     ${buildTaskOrderBy(sortField, sortOrder, 't.create_time ASC')} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  const filesByTask = await attachFilesToTasks(rows.map(r => r.id));
  return {
    list: rows.map(r => ({ ...r, files: filesByTask[r.id] || [] })),
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize),
    totalPages: Math.ceil(total / parseInt(pageSize))
  };
}

/** 全量任务（管理端） */
async function queryAllTasks({ status, keyword, publisherId, designerId, startDate, endDate, dateField, taskGroup, sortField, sortOrder, page, pageSize }) {
  const offset = (page - 1) * pageSize;
  let where = 'WHERE 1=1';
  const params = [];
  const dateColumn = taskDateColumn(dateField);

  where = appendStatusFilter(where, params, status);
  if (keyword) {
    const like = `%${keyword}%`;
    if (taskGroup === 'design') {
      where += ' AND (t.title LIKE ? OR t.task_no LIKE ? OR t.style_number LIKE ?)';
      params.push(like, like, like);
    } else if (taskGroup === 'cs') {
      where += ' AND (t.title LIKE ? OR t.task_no LIKE ? OR t.style_number LIKE ? OR t.wangwang_id LIKE ?)';
      params.push(like, like, like, like);
    } else {
      where += ' AND (t.title LIKE ? OR t.task_no LIKE ?)';
      params.push(like, like);
    }
  }
  if (publisherId) { where += ' AND t.publisher_id = ?'; params.push(publisherId); }
  if (designerId) { where += ' AND t.designer_id = ?'; params.push(designerId); }
  if (startDate) { where += ` AND ${dateColumn} >= ?`; params.push(startDate + ' 00:00:00'); }
  if (endDate) { where += ` AND ${dateColumn} <= ?`; params.push(endDate + ' 23:59:59'); }
  if (taskGroup) {
    if (taskGroup === 'design') {
      where += ' AND (t.task_group = ? OR t.task_group IS NULL OR t.task_group = \'\')';
      params.push(taskGroup);
    } else {
      where += ' AND t.task_group = ?';
      params.push(taskGroup);
    }
  }

  const result = await paginate({
    countSql: `SELECT COUNT(*) as total FROM task_info t ${where}`,
    countParams: params,
    dataSql: `SELECT ${TASK_SELECT} FROM task_info t ${TASK_JOIN} ${where} ${buildTaskOrderBy(sortField, sortOrder, 't.create_time DESC')} LIMIT ? OFFSET ?`,
    dataParams: [...params, pageSize, offset],
    page, pageSize
  });
  result.list = await attachFilesToTasksForList(result.list);
  return result;
}

async function searchTasks({ userId, role, store, permissions = [], keyword, pageSize }) {
  const limit = Math.min(Math.max(parseInt(pageSize) || 12, 1), 30);
  const params = [];
  let where = 'WHERE 1=1';
  const hasPerm = (code) => role === 'admin' || permissions.includes('*') || permissions.includes(code);
  const adminTaskGroups = [];
  if (hasPerm('admin.tasks.design')) adminTaskGroups.push('design');
  if (hasPerm('admin.tasks.operator')) adminTaskGroups.push('operator');
  if (hasPerm('admin.tasks.cs')) adminTaskGroups.push('cs');

  if (role === 'admin' || role === 'sub_admin') {
    const groups = [...adminTaskGroups];
    if (!groups.includes('design') && hasPerm('dashboard.design')) groups.push('design');
    if (!groups.includes('operator') && hasPerm('dashboard.operator')) groups.push('operator');
    if (!groups.includes('cs') && hasPerm('dashboard.cs')) groups.push('cs');
    if (groups.length) {
      where += ` AND COALESCE(NULLIF(t.task_group, ''), 'design') IN (${groups.map(() => '?').join(',')})`;
      params.push(...groups);
    } else {
      where += ' AND 1=0';
    }
  } else {
    const accessParts = ['(t.publisher_id = ? OR t.designer_id = ?)'];
    params.push(userId, userId);
    if (adminTaskGroups.length) {
      accessParts.push(`COALESCE(NULLIF(t.task_group, ''), 'design') IN (${adminTaskGroups.map(() => '?').join(',')})`);
      params.push(...adminTaskGroups);
    }
    if (role === 'operator') {
      accessParts.push(`(COALESCE(t.task_group, 'design') IN ('design','operator') AND t.publisher_id IN (SELECT id FROM sys_user WHERE role = 'operator' AND store = ?))`);
      params.push(store || '');
    }
    if (hasPerm('designer.hall.design')) {
      accessParts.push(`(t.status = 'wait' AND COALESCE(NULLIF(t.task_group, ''), 'design') = 'design')`);
    }
    if (hasPerm('assistant.hall.operator')) {
      accessParts.push(`(t.status = 'wait' AND t.task_group = 'operator')`);
    }
    if (hasPerm('basic.hall.cs')) {
      accessParts.push(`(t.status = 'wait' AND t.task_group = 'cs')`);
    }
    where += ` AND (${accessParts.join(' OR ')})`;
  }

  if (keyword) {
    const like = `%${keyword}%`;
    where += ` AND (
      t.task_no LIKE ? OR t.title LIKE ? OR t.style_number LIKE ? OR
      t.wangwang_id LIKE ? OR t.shop_name LIKE ? OR t.publisher_name LIKE ? OR t.designer_name LIKE ? OR
      t.specified_color LIKE ? OR t.task_file_path LIKE ? OR
      u1.username LIKE ? OR u2.username LIKE ? OR
      EXISTS (SELECT 1 FROM task_file tf WHERE tf.task_id = t.id AND tf.file_name LIKE ?)
    )`;
    params.push(like, like, like, like, like, like, like, like, like, like, like, like);
  }

  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT ${TASK_SELECT}
     FROM task_info t ${TASK_JOIN}
     ${where}
     ORDER BY t.update_time DESC
     LIMIT ${limit}`,
    params
  );
  return { list: rows, total: rows.length, page: 1, pageSize: limit, totalPages: 1 };
}

// ==================== 统计 ====================

async function getPublisherSummary(userId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'wait' THEN 1 ELSE 0 END) as wait_count,
            SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
            SUM(CASE WHEN status = 'doing' THEN 1 ELSE 0 END) as doing_count,
            SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) as finished_count,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
            SUM(CASE WHEN status IN ('wait','accepted','doing','pending_original','pending_original_review') THEN 1 ELSE 0 END) as unfinished_count
     FROM task_info WHERE publisher_id = ?`, [userId]
  );
  return rows[0];
}

async function getGroupCardStats(userId, taskGroup) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) as finished_count,
            SUM(CASE WHEN status = 'wait' THEN 1 ELSE 0 END) as wait_count,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
     FROM task_info WHERE publisher_id = ? AND task_group = ?`, [userId, taskGroup]
  );
  return rows[0];
}

async function getUsersByRole(role) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, real_name as name FROM sys_user WHERE role = ? AND status = 1 ORDER BY id`, [role]
  );
  return rows;
}

async function getUsersByRoleWithUsername(role) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, real_name as name, username FROM sys_user WHERE role = ? AND status = 1 ORDER BY id`, [role]
  );
  return rows;
}

async function getMonthlyRawData(publisherId, taskGroup, year) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT t.designer_id,
            MONTH(t.create_time) as month,
            COUNT(*) as published,
            SUM(CASE WHEN t.status = 'finished' THEN 1 ELSE 0 END) as finished,
            SUM(CASE WHEN t.status IN ('accepted','doing','pending_original','pending_original_review') THEN 1 ELSE 0 END) as unsubmitted
     FROM task_info t
     WHERE t.publisher_id = ? AND t.task_group = ? AND YEAR(t.create_time) = ?
     GROUP BY t.designer_id, MONTH(t.create_time)`,
    [publisherId, taskGroup, year]
  );
  return rows;
}

async function getPublisherMonthlyRaw(publisherId, taskGroup, year) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT MONTH(create_time) as month,
            COUNT(*) as total,
            SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) as finished,
            SUM(CASE WHEN status IN ('accepted','doing') THEN 1 ELSE 0 END) as doing,
            SUM(CASE WHEN status = 'wait' THEN 1 ELSE 0 END) as wait,
            SUM(CASE WHEN status IN ('wait','accepted','doing','pending_original','pending_original_review') THEN 1 ELSE 0 END) as unfinished
     FROM task_info
     WHERE publisher_id = ? AND task_group = ? AND YEAR(create_time) = ?
     GROUP BY MONTH(create_time)`,
    [publisherId, taskGroup, year]
  );
  return rows;
}

async function getDesignerSummary(userId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT COUNT(*) as total,
            SUM(CASE WHEN t.status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
            SUM(CASE WHEN t.status = 'doing' THEN 1 ELSE 0 END) as doing_count,
            SUM(CASE WHEN t.status = 'finished' THEN 1 ELSE 0 END) as finished_count,
            SUM(CASE WHEN t.status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
            COALESCE(SUM(CASE
              WHEN t.status <> 'doing' THEN 0
              WHEN COALESCE(NULLIF(t.task_group, ''), 'design') = 'design'
                AND COALESCE(si.requires_manual_score, 0) = 1 THEN 0
              WHEN COALESCE(NULLIF(t.task_group, ''), 'design') = 'design' THEN t.score
              ELSE t.score * CASE WHEN COALESCE(t.actual_quantity, 0) > 0 THEN t.actual_quantity ELSE 1 END
            END), 0) as pending_review_score,
            COALESCE(SUM(CASE
              WHEN t.status <> 'finished' OR COALESCE(t.score_review_status, '') = 'pending' THEN 0
              WHEN COALESCE(NULLIF(t.task_group, ''), 'design') = 'design' THEN t.score
              ELSE t.score * CASE WHEN COALESCE(t.actual_quantity, 0) > 0 THEN t.actual_quantity ELSE 1 END
            END), 0) as total_score
     FROM task_info t
     LEFT JOIN sys_score_item si ON t.score_item_id = si.id
       AND COALESCE(NULLIF(t.task_group, ''), 'design') = 'design'
     WHERE t.designer_id = ?`, [userId]
  );
  return rows[0];
}

async function getDesignerDetailRows(userId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT t.finish_time, t.create_time, t.score, t.actual_quantity, t.status,
            t.score_review_status, t.score_item_id, t.task_group,
            COALESCE(si.requires_manual_score, 0) AS requires_manual_score
     FROM task_info t
     LEFT JOIN sys_score_item si ON t.score_item_id = si.id
       AND COALESCE(NULLIF(t.task_group, ''), 'design') = 'design'
     WHERE t.designer_id = ?`, [userId]
  );
  return rows;
}

/** 基础美工效果图/原图上传统计。file_category 是业务分类，不能按 file_type 限制。 */
async function getBasicDesignerFileStats({ start, end, userId } = {}) {
  const pool = getPool();
  let where = `u.role = 'basic_designer'
      AND u.status = 1
      AND tf.file_category IN ('work', 'original')`;
  const params = [];
  if (start) {
    where += ' AND tf.create_time >= ?';
    params.push(start);
  }
  if (end) {
    where += ' AND tf.create_time < ?';
    params.push(end);
  }
  if (userId !== undefined && userId !== null && userId !== '') {
    where += ' AND tf.uploader_id = ?';
    params.push(userId);
  }
  const [rows] = await pool.execute(
    `SELECT tf.uploader_id, u.real_name AS name, u.username,
            tf.file_category, tf.create_time
       FROM task_file tf
       INNER JOIN sys_user u ON u.id = tf.uploader_id
      WHERE ${where}
      ORDER BY tf.create_time ASC, tf.id ASC`,
    params
  );
  return rows;
}

async function getGroupStats() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT task_group, COUNT(*) as total,
            SUM(CASE WHEN status = 'wait' THEN 1 ELSE 0 END) as wait_count,
            SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
            SUM(CASE WHEN status = 'doing' THEN 1 ELSE 0 END) as doing_count,
            SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) as finished_count,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count
     FROM task_info GROUP BY task_group`
  );
  return rows;
}

async function getFinishedDesignerScores(role) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT u.id, u.real_name as name, t.score, t.actual_quantity,
            t.finish_time, t.task_group
     FROM sys_user u
     INNER JOIN task_info t ON u.id = t.designer_id AND t.status = 'finished'
       AND COALESCE(t.score_review_status, '') <> 'pending'
     WHERE u.role = ? AND u.status = 1`, [role]
  );
  return rows;
}

async function getDesignerRank(role) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT u.id, u.real_name as name,
            COUNT(CASE WHEN t.status = 'finished' THEN 1 END) as finished_count,
            COUNT(CASE WHEN t.status = 'rejected' THEN 1 END) as rejected_count,
            COUNT(*) as total_count,
            ROUND(COUNT(CASE WHEN t.status = 'finished' THEN 1 END) / COUNT(*) * 100, 1) as finish_rate
     FROM sys_user u
     INNER JOIN task_info t ON u.id = t.designer_id
     WHERE u.role = ?
     GROUP BY u.id, u.real_name
     ORDER BY finished_count DESC LIMIT 10`, [role]
  );
  return rows;
}

async function getPublisherRank(role) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT u.id, u.real_name as name, COUNT(*) as publish_count
     FROM sys_user u
     INNER JOIN task_info t ON u.id = t.publisher_id
     WHERE u.role = ?
     GROUP BY u.id, u.real_name
     ORDER BY publish_count DESC LIMIT 10`, [role]
  );
  return rows;
}

async function getScoreItems() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, name, 'design' as source FROM sys_score_item
     UNION ALL
     SELECT id, name, 'cs' as source FROM sys_score_item_cs
     UNION ALL
     SELECT id, name, 'operator' as source FROM sys_score_item_operator
     ORDER BY source, id`
  );
  return rows;
}

async function getAllTasksForStats() {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT t.id, t.designer_id, t.publisher_id, t.status, t.score, t.actual_quantity,
            t.score_item_id, t.create_time, t.finish_time, t.update_time, t.submit_time,
            t.task_group, t.score_review_status,
            COALESCE(si.requires_manual_score, 0) AS requires_manual_score,
            COALESCE(u.real_name, t.publisher_name, u.username, '') AS publisher_name,
            u.username AS publisher_username,
            u.role AS publisher_role
     FROM task_info t
     LEFT JOIN sys_user u ON t.publisher_id = u.id
     LEFT JOIN sys_score_item si ON t.score_item_id = si.id
       AND COALESCE(NULLIF(t.task_group, ''), 'design') = 'design'
     WHERE (t.designer_id IS NOT NULL OR t.publisher_id IS NOT NULL)`
  );
  return rows;
}

async function getSidebarBadgeStats(userId, reviewScope = 'own', store = '') {
  const pool = getPool();
  const reviewOwnerSql = reviewScope === 'all'
    ? '1=1'
    : reviewScope === 'store' && store
      ? 'publisher_id IN (SELECT id FROM sys_user WHERE store = ?)'
      : 'publisher_id = ?';
  const reviewScopeValue = reviewScope === 'store' && store ? store : userId;
  const params = [userId, userId, userId];
  if (reviewScope !== 'all') params.push(reviewScopeValue, reviewScopeValue, reviewScopeValue);
  const [rows] = await pool.execute(
    `SELECT
       SUM(CASE WHEN designer_id = ? AND COALESCE(NULLIF(task_group, ''), 'design') = 'design' AND status IN ('accepted', 'rejected') THEN 1 ELSE 0 END) as design_todo_count,
       SUM(CASE WHEN designer_id = ? AND task_group = 'cs' AND status IN ('accepted', 'rejected', 'pending_original', 'pending_original_review') THEN 1 ELSE 0 END) as basic_todo_count,
       SUM(CASE WHEN designer_id = ? AND task_group = 'operator' AND status IN ('accepted', 'rejected') THEN 1 ELSE 0 END) as assistant_todo_count,
       SUM(CASE WHEN COALESCE(task_group, 'design') IN ('design', '') AND status = 'doing' AND ${reviewOwnerSql} THEN 1 ELSE 0 END) as design_review_count,
       SUM(CASE WHEN task_group = 'operator' AND status = 'doing' AND ${reviewOwnerSql} THEN 1 ELSE 0 END) as operator_review_count,
       SUM(CASE WHEN task_group = 'cs' AND status IN ('doing', 'pending_original_review') AND ${reviewOwnerSql} THEN 1 ELSE 0 END) as cs_review_count,
       SUM(CASE WHEN task_group = 'cs' AND status = 'rejected' AND publisher_id = ? AND COALESCE(handoff_status, '') <> 'pooled' THEN 1 ELSE 0 END) as cs_modification_count,
       SUM(CASE WHEN task_group = 'cs' AND score_review_status = 'pending' AND status IN ('doing', 'finished') THEN 1 ELSE 0 END) as score_review_count,
       SUM(CASE WHEN task_group = 'cs' AND handoff_status = 'pooled' THEN 1 ELSE 0 END) as cs_handoff_count
     FROM task_info`,
    [...params, userId]
  );
  return rows[0] || {};
}

/** 查询任务列表中的任务，用于统计聚合 */
async function getTasksByDesignerIds(designerIds, statuses) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT designer_id, status, score, actual_quantity FROM task_info
     WHERE designer_id IS NOT NULL AND status IN (${statuses.map(() => '?').join(',')})`
  );
  return rows;
}

// ==================== 内部辅助 ====================

const { resolvePath } = require('../utils/share');

async function attachFilesToTasksForList(rows) {
  const filesByTask = await attachFilesToTasks(rows.map(r => r.id));
  return rows.map(r => ({ ...r, files: filesByTask[r.id] || [] }));
}

module.exports = {
  MIME_MAP,
  generateTaskNo,
  attachFilesToTasks,
  paginate,
  // CRUD
  findDesigner,
  insertTask,
  getTaskDetail,
  getTaskFiles,
  getTaskTransferRecords,
  getTaskRejectRecords,
  getTaskForUpdate,
  getDesignScoreItemsForUpdate,
  updateTaskFields,
  insertTransferRecord,
  insertRejectRecord,
  completeRejectRecord,
  getLatestRejectRecordForUpdate,
  countIncompleteRejectRecords,
  reopenRejectRecord,
  getRecordWorkFilesForUpdate,
  getWorkImageFilesForUpdate,
  getInitialWorkFilesForUpdate,
  deleteFileRecords,
  deleteTaskData,
  batchDeleteTasks,
  batchReassignTasks,
  // 文件
  insertFileRecord,
  deleteFilesByCategory,
  deleteWorkFiles,
  updateTaskStatus,
  getTaskBrief,
  // 查询
  queryMyPublished,
  queryPooledCsTasks,
  queryMyAccepted,
  queryTaskHall,
  queryAllTasks,
  searchTasks,
  // 统计
  getPublisherSummary,
  getGroupCardStats,
  getUsersByRole,
  getUsersByRoleWithUsername,
  getMonthlyRawData,
  getPublisherMonthlyRaw,
  getDesignerSummary,
  getDesignerDetailRows,
  getBasicDesignerFileStats,
  getGroupStats,
  getFinishedDesignerScores,
  getDesignerRank,
  getPublisherRank,
  getScoreItems,
  getAllTasksForStats,
  getSidebarBadgeStats
};
