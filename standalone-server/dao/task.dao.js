/**
 * 任务 DAO — 所有 task 相关 SQL 集中管理
 * 非事务方法自管连接；事务方法接受 conn 参数共享 FOR UPDATE 锁
 */
const { getPool, executeTransaction, execute } = require('../config/database');

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

/** 批量挂载文件到任务 */
async function attachFilesToTasks(taskIds) {
  const filesByTask = {};
  if (!taskIds.length) return filesByTask;

  const pool = getPool();
  const placeholders = taskIds.map(() => '?').join(',');
  const [files] = await pool.execute(
    `SELECT * FROM task_file WHERE task_id IN (${placeholders}) ORDER BY create_time ASC`,
    taskIds
  );
  for (const f of files) {
    if (!filesByTask[f.task_id]) filesByTask[f.task_id] = [];
    filesByTask[f.task_id].push({
      ...f,
      fileUrl: `/api/task/preview/${f.id}`,
      downloadUrl: `/api/task/download/${f.id}`
    });
  }
  return filesByTask;
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
        task_group, shop_name, quantity, task_file_path)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.taskNo, data.title, data.description, data.priority, data.deadline,
      data.publisherId, data.status, data.publisherName,
      data.scoreItemId, data.score, data.refPath, data.styleNumber,
      data.specifiedColor, data.wangwangId, data.designerId, data.designerName,
      data.taskGroup, data.shopName, data.quantity, data.taskFilePath
    ]
  );
  return result.insertId;
}

/** 查询任务详情（不含文件） */
async function getTaskDetail(taskId) {
  const pool = getPool();
  const [tasks] = await pool.execute(
    `SELECT t.*, u1.real_name as publisher_name, u2.real_name as designer_name
     FROM task_info t
     LEFT JOIN sys_user u1 ON t.publisher_id = u1.id
     LEFT JOIN sys_user u2 ON t.designer_id = u2.id
     WHERE t.id = ?`, [taskId]
  );
  return tasks[0] || null;
}

/** 查询任务文件 */
async function getTaskFiles(taskId) {
  const pool = getPool();
  const [files] = await pool.execute(
    `SELECT * FROM task_file WHERE task_id = ? ORDER BY create_time ASC`, [taskId]
  );
  return files.map(f => ({
    ...f,
    fileUrl: `/api/task/preview/${f.id}`,
    downloadUrl: `/api/task/download/${f.id}`
  }));
}

/** 锁行查询（事务内 FOR UPDATE） */
async function getTaskForUpdate(conn, taskId) {
  const [rows] = await conn.execute(
    `SELECT id, title, task_no, status, publisher_id, designer_id, task_group FROM task_info WHERE id = ? FOR UPDATE`,
    [taskId]
  );
  return rows[0] || null;
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
async function deleteTaskData(taskId) {
  await execute(`DELETE FROM task_file WHERE task_id = ?`, [taskId]);
  await execute(`DELETE FROM sys_comment WHERE task_id = ?`, [taskId]);
  await execute(`DELETE FROM sys_score_record WHERE task_id = ?`, [taskId]);
  await execute(`DELETE FROM task_info WHERE id = ?`, [taskId]);
}

/** 批量删除 */
async function batchDeleteTasks(taskIds) {
  const placeholders = taskIds.map(() => '?').join(',');
  await execute(`DELETE FROM task_file WHERE task_id IN (${placeholders})`, taskIds);
  await execute(`DELETE FROM task_info WHERE id IN (${placeholders})`, taskIds);
}

/** 批量重新分配 */
async function batchReassignTasks(taskIds, designerId, designerName) {
  const placeholders = taskIds.map(() => '?').join(',');
  const [result] = await execute(
    `UPDATE task_info SET designer_id = ?, designer_name = ?, status = 'accepted', update_time = NOW()
     WHERE id IN (${placeholders}) AND status = 'wait'`,
    [designerId, designerName, ...taskIds]
  );
  return result;
}

// ==================== 文件操作 ====================

/** 插入文件记录（事务内） */
async function insertFileRecord(conn, data) {
  await conn.execute(
    `INSERT INTO task_file (task_id, file_name, file_path, file_size, file_type, mime_type, uploader_id, file_category)
     VALUES (?,?,?,?,?,?,?,?)`,
    [data.taskId, data.fileName, data.filePath, data.fileSize, data.fileType, data.mimeType, data.uploaderId, data.fileCategory]
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
  // 状态首次变为作图中时记录上传时间（仅首次，避免后续同状态更新覆盖）
  if (status === 'doing') {
    setParts.push('submit_time = COALESCE(submit_time, NOW())');
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

const TASK_SELECT = `t.*, u1.real_name as publisher_name, u2.real_name as designer_name`;
const TASK_JOIN = `LEFT JOIN sys_user u1 ON t.publisher_id = u1.id
                    LEFT JOIN sys_user u2 ON t.designer_id = u2.id`;

/** 我发布的任务 */
async function queryMyPublished({ userId, role, permissions = [], filterGroup, selfOnly, status, styleNumber, keyword, designerId, publisherId, dateStart, dateEnd, page, pageSize }) {
  const offset = (page - 1) * pageSize;
  let where = 'WHERE 1=1';
  const params = [];
  const group = filterGroup || (role === 'cs_agent' ? 'cs' : 'design');
  const hasPerm = (code) => role === 'admin' || role === 'sub_admin' || permissions.includes(code);

  if (role === 'admin' || role === 'sub_admin') {
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

  if (!hasPerm(group === 'operator' ? 'operator.tasks.assistant' : group === 'cs' ? 'cs.tasks.basic' : 'operator.tasks.design') && role !== 'admin' && role !== 'sub_admin') {
    where += ' AND 1=0';
  }

  if (status) { where += ' AND t.status = ?'; params.push(status); }
  if (styleNumber) { where += ' AND t.style_number LIKE ?'; params.push(`%${styleNumber}%`); }
  if (keyword) { where += ' AND (t.wangwang_id LIKE ? OR t.style_number LIKE ? OR t.title LIKE ? OR t.task_no LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
  if (designerId) { where += ' AND t.designer_id = ?'; params.push(designerId); }
  if (publisherId) { where += ' AND t.publisher_id = ?'; params.push(publisherId); }
  if (dateStart) { where += ' AND t.create_time >= ?'; params.push(dateStart + ' 00:00:00'); }
  if (dateEnd) { where += ' AND t.create_time <= ?'; params.push(dateEnd + ' 23:59:59'); }

  const result = await paginate({
    countSql: `SELECT COUNT(*) as total FROM task_info t ${where}`,
    countParams: params,
    dataSql: `SELECT ${TASK_SELECT} FROM task_info t ${TASK_JOIN} ${where} ORDER BY t.create_time DESC LIMIT ? OFFSET ?`,
    dataParams: [...params, pageSize, offset],
    page, pageSize
  });
  result.list = await attachFilesToTasksForList(result.list);
  return result;
}

/** 我接单的任务 */
async function queryMyAccepted({ userId, role, permissions = [], taskGroup, status, keyword, publisherId, scoreItemId, dateStart, dateEnd, shopName, page, pageSize }) {
  const offset = (page - 1) * pageSize;
  let where = 'WHERE t.designer_id = ?';
  const params = [userId];
  const group = taskGroup || (role === 'basic_designer' ? 'cs' : role === 'operator_assistant' ? 'operator' : 'design');
  const hasPerm = (code) => role === 'admin' || role === 'sub_admin' || permissions.includes(code);
  const requiredPerm = group === 'cs' ? 'basic.tasks.cs' : group === 'operator' ? 'assistant.tasks.operator' : 'designer.tasks.design';

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

  if (status) { where += ' AND t.status = ?'; params.push(status); }
  if (keyword) { where += ' AND (t.wangwang_id LIKE ? OR t.style_number LIKE ? OR t.title LIKE ? OR t.task_no LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
  if (publisherId) { where += ' AND t.publisher_id = ?'; params.push(publisherId); }
  if (scoreItemId) { where += ' AND t.score_item_id = ?'; params.push(scoreItemId); }
  if (dateStart) { where += ' AND t.create_time >= ?'; params.push(dateStart + ' 00:00:00'); }
  if (dateEnd) { where += ' AND t.create_time <= ?'; params.push(dateEnd + ' 23:59:59'); }
  if (shopName) { where += ' AND t.shop_name = ?'; params.push(shopName); }

  const result = await paginate({
    countSql: `SELECT COUNT(*) as total FROM task_info t ${where}`,
    countParams: params,
    dataSql: `SELECT ${TASK_SELECT} FROM task_info t ${TASK_JOIN} ${where} ORDER BY t.update_time DESC LIMIT ? OFFSET ?`,
    dataParams: [...params, pageSize, offset],
    page, pageSize
  });
  result.list = await attachFilesToTasksForList(result.list);
  return result;
}

/** 任务大厅 */
async function queryTaskHall({ role, permissions = [], taskGroup, keyword, page, pageSize }) {
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
            COALESCE(si.score, cs.score, op.score) as item_score
     FROM task_info t
     LEFT JOIN sys_user u1 ON t.publisher_id = u1.id
     LEFT JOIN sys_score_item si ON t.score_item_id = si.id AND t.task_group IN ('design')
     LEFT JOIN sys_score_item_cs cs ON t.score_item_id = cs.id AND t.task_group = 'cs'
     LEFT JOIN sys_score_item_operator op ON t.score_item_id = op.id AND t.task_group = 'operator'
     ${where}
     ORDER BY t.create_time ASC LIMIT ? OFFSET ?`,
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
async function queryAllTasks({ status, keyword, publisherId, designerId, startDate, endDate, taskGroup, page, pageSize }) {
  const offset = (page - 1) * pageSize;
  let where = 'WHERE 1=1';
  const params = [];

  if (status) { where += ' AND t.status = ?'; params.push(status); }
  if (keyword) { where += ' AND (t.title LIKE ? OR t.task_no LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
  if (publisherId) { where += ' AND t.publisher_id = ?'; params.push(publisherId); }
  if (designerId) { where += ' AND t.designer_id = ?'; params.push(designerId); }
  if (startDate) { where += ' AND t.create_time >= ?'; params.push(startDate); }
  if (endDate) { where += ' AND t.create_time <= ?'; params.push(endDate + ' 23:59:59'); }
  if (taskGroup) {
    if (taskGroup === 'design') {
      where += ' AND (t.task_group = ? OR t.task_group IS NULL OR t.task_group = \'\')';
      params.push(taskGroup);
    } else {
      where += ' AND t.task_group = ?';
      params.push(taskGroup);
    }
  }

  return paginate({
    countSql: `SELECT COUNT(*) as total FROM task_info t ${where}`,
    countParams: params,
    dataSql: `SELECT ${TASK_SELECT} FROM task_info t ${TASK_JOIN} ${where} ORDER BY t.create_time DESC LIMIT ? OFFSET ?`,
    dataParams: [...params, pageSize, offset],
    page, pageSize
  });
}

async function searchTasks({ userId, role, store, permissions = [], keyword, pageSize }) {
  const limit = Math.min(parseInt(pageSize) || 12, 30);
  const params = [];
  let where = 'WHERE 1=1';
  const hasPerm = (code) => role === 'admin' || permissions.includes(code);

  if (role === 'admin' || role === 'sub_admin') {
    const groups = [];
    if (hasPerm('admin.tasks.design') || hasPerm('dashboard.design')) groups.push('design');
    if (hasPerm('admin.tasks.operator') || hasPerm('dashboard.operator')) groups.push('operator');
    if (hasPerm('admin.tasks.cs') || hasPerm('dashboard.cs')) groups.push('cs');
    if (groups.length) {
      where += ` AND COALESCE(t.task_group, 'design') IN (${groups.map(() => '?').join(',')})`;
      params.push(...groups);
    }
  } else {
    const accessParts = ['(t.publisher_id = ? OR t.designer_id = ?)'];
    params.push(userId, userId);
    if (role === 'operator') {
      accessParts.push(`(COALESCE(t.task_group, 'design') IN ('design','operator') AND t.publisher_id IN (SELECT id FROM sys_user WHERE role = 'operator' AND store = ?))`);
      params.push(store || '');
    }
    where += ` AND (${accessParts.join(' OR ')})`;
  }

  if (keyword) {
    const like = `%${keyword}%`;
    where += ` AND (
      t.task_no LIKE ? OR t.title LIKE ? OR t.style_number LIKE ? OR
      t.wangwang_id LIKE ? OR t.shop_name LIKE ? OR t.publisher_name LIKE ? OR t.designer_name LIKE ?
    )`;
    params.push(like, like, like, like, like, like, like);
  }

  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT ${TASK_SELECT}
     FROM task_info t ${TASK_JOIN}
     ${where}
     ORDER BY t.update_time DESC
     LIMIT ?`,
    [...params, limit]
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
            SUM(CASE WHEN status IN ('wait','accepted','doing') THEN 1 ELSE 0 END) as unfinished_count
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
            SUM(CASE WHEN t.status IN ('accepted','doing') THEN 1 ELSE 0 END) as unsubmitted
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
            SUM(CASE WHEN status IN ('wait','accepted','doing') THEN 1 ELSE 0 END) as unfinished
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
            SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted_count,
            SUM(CASE WHEN status = 'doing' THEN 1 ELSE 0 END) as doing_count,
            SUM(CASE WHEN status = 'finished' THEN 1 ELSE 0 END) as finished_count,
            SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_count,
            COALESCE(SUM(CASE WHEN status = 'doing' THEN score * CASE WHEN COALESCE(actual_quantity, 0) > 0 THEN actual_quantity ELSE 1 END ELSE 0 END), 0) as pending_review_score,
            COALESCE(SUM(CASE WHEN status = 'finished' AND (score_review_status IS NULL OR score_review_status = '' OR score_review_status = 'approved') THEN score * CASE WHEN COALESCE(actual_quantity, 0) > 0 THEN actual_quantity ELSE 1 END ELSE 0 END), 0) as total_score
     FROM task_info WHERE designer_id = ?`, [userId]
  );
  return rows[0];
}

async function getDesignerDetailRows(userId) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT finish_time, create_time, score, actual_quantity, status, score_review_status
     FROM task_info WHERE designer_id = ?`, [userId]
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
            t.finish_time
     FROM sys_user u
     INNER JOIN task_info t ON u.id = t.designer_id AND t.status = 'finished'
       AND (t.score_review_status IS NULL OR t.score_review_status = '' OR t.score_review_status = 'approved')
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
    `SELECT id, designer_id, publisher_id, status, score, actual_quantity, score_item_id, create_time, finish_time, update_time, submit_time, task_group, score_review_status
     FROM task_info WHERE (designer_id IS NOT NULL OR publisher_id IS NOT NULL)`
  );
  return rows;
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
  getTaskForUpdate,
  updateTaskFields,
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
  getGroupStats,
  getFinishedDesignerScores,
  getDesignerRank,
  getPublisherRank,
  getScoreItems,
  getAllTasksForStats
};
