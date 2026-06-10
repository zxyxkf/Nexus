/**
 * 用户 DAO — 纯数据库操作，不含业务逻辑
 */
const { getPool, execute, executeTransaction } = require('../config/database');

// ==================== 查询 ====================

async function getUserList({ page, pageSize, role, status, keyword }) {
  const pool = getPool();
  const offset = (page - 1) * pageSize;

  let whereSql = 'WHERE 1=1';
  const params = [];

  if (role) {
    whereSql += ' AND u.role = ?';
    params.push(role);
  }
  if (status !== undefined && status !== '') {
    whereSql += ' AND u.status = ?';
    params.push(parseInt(status));
  }
  if (keyword) {
    whereSql += ' AND (u.username LIKE ? OR u.real_name LIKE ?)';
    params.push(`%${keyword}%`, `%${keyword}%`);
  }

  const [countResult] = await pool.execute(
    `SELECT COUNT(*) as total FROM sys_user u ${whereSql}`,
    params
  );

  const [rows] = await pool.execute(
    `SELECT u.id, u.username, u.real_name, u.role, u.store, u.is_team_lead, u.status, u.email, u.phone, u.remark,
            u.last_login_time, u.create_time, u.update_time
     FROM sys_user u ${whereSql}
     ORDER BY u.create_time DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );

  return {
    list: rows,
    total: countResult[0].total,
    page,
    pageSize,
    totalPages: Math.ceil(countResult[0].total / pageSize)
  };
}

async function findByUsername(username) {
  const pool = getPool();
  const [rows] = await pool.execute(`SELECT id FROM sys_user WHERE username = ?`, [username]);
  return rows.length > 0 ? rows[0] : null;
}

async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, username, real_name, role, status FROM sys_user WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function findFullById(id) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, username, real_name, role, store, is_team_lead, status FROM sys_user WHERE id = ?`,
    [id]
  );
  return rows[0] || null;
}

// ==================== 写入 ====================

async function createUser({ username, hashedPwd, realName, role, store, isTeamLead, email, phone, remark }) {
  const pool = getPool();
  await pool.execute(
    `INSERT INTO sys_user (username, password, real_name, role, store, is_team_lead, email, phone, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, hashedPwd, realName, role, store || '', isTeamLead ? 1 : 0, email || null, phone || null, remark || null]
  );
}

async function updateUser({ id, realName, role, store, isTeamLead, email, phone, remark, status }) {
  const pool = getPool();
  await pool.execute(
    `UPDATE sys_user SET real_name = ?, role = ?, store = ?, is_team_lead = ?, email = ?, phone = ?, remark = ?, status = ?
     WHERE id = ?`,
    [realName, role, store || '', isTeamLead ? 1 : 0, email || null, phone || null, remark || null, status !== undefined ? status : 1, id]
  );
}

async function updatePassword(id, hashedPwd) {
  const pool = getPool();
  await pool.execute(`UPDATE sys_user SET password = ? WHERE id = ?`, [hashedPwd, id]);
}

async function revokeRefreshTokens(id) {
  const pool = getPool();
  await pool.execute(`DELETE FROM sys_refresh_token WHERE user_id = ?`, [id]);
}

async function updateStatus(id, status) {
  const pool = getPool();
  await pool.execute(`UPDATE sys_user SET status = ? WHERE id = ?`, [status, id]);
}

// ==================== 删除相关 ====================

async function deleteUserRelatedData(id) {
  const pool = getPool();
  await pool.execute(`DELETE FROM sys_score_record WHERE user_id = ?`, [id]);
  await pool.execute(`DELETE FROM sys_notification WHERE user_id = ?`, [id]);
  await pool.execute(`DELETE FROM sys_comment WHERE user_id = ?`, [id]);
  await pool.execute(`DELETE FROM sys_oper_log WHERE user_id = ?`, [id]);
}

async function unlinkUserFromTasks(id) {
  const pool = getPool();
  await pool.execute(`UPDATE task_info SET publisher_id = NULL, publisher_name = '' WHERE publisher_id = ?`, [id]);
  await pool.execute(`UPDATE task_info SET designer_id = NULL, designer_name = '' WHERE designer_id = ?`, [id]);
}

async function deleteUserById(id) {
  const pool = getPool();
  await pool.execute(`DELETE FROM sys_user WHERE id = ?`, [id]);
}

// ==================== 角色查询 ====================

async function getUsersByRole(role) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT u.id, u.username, u.real_name,
      IFNULL(
        (SELECT JSON_ARRAYAGG(
           JSON_OBJECT('id', t.id, 'title', t.title, 'task_no', t.task_no, 'status', t.status)
         )
         FROM task_info t
         WHERE t.designer_id = u.id AND t.status IN ('accepted','doing')
        ), JSON_ARRAY()
      ) AS active_tasks
     FROM sys_user u
     WHERE u.role = ? AND u.status = 1
     ORDER BY u.real_name ASC`,
    [role]
  );
  return rows;
}

async function getPublishersByRole(role) {
  const pool = getPool();
  const [rows] = await pool.execute(
    `SELECT id, username, real_name FROM sys_user WHERE role = ? AND status = 1 ORDER BY real_name ASC`,
    [role]
  );
  return rows;
}

async function getPublishersByRoleAndStore(role, store) {
  const pool = getPool();
  if (store) {
    const [rows] = await pool.execute(
      `SELECT id, username, real_name FROM sys_user WHERE role = ? AND status = 1 AND store = ? ORDER BY real_name ASC`,
      [role, store]
    );
    return rows;
  }
  return getPublishersByRole(role);
}

async function getTaskPublishersByGroup(taskGroup) {
  const pool = getPool();
  const params = [];
  let groupWhere = '1=1';
  if (taskGroup) {
    if (taskGroup === 'design') {
      groupWhere = `(t.task_group = ? OR t.task_group IS NULL OR t.task_group = '')`;
      params.push(taskGroup);
    } else {
      groupWhere = 't.task_group = ?';
      params.push(taskGroup);
    }
  }

  const [rows] = await pool.execute(
    `SELECT DISTINCT
        t.publisher_id AS id,
        COALESCE(u.username, '') AS username,
        COALESCE(u.real_name, t.publisher_name, u.username, '未知发布人') AS real_name,
        COALESCE(u.role, '') AS role
     FROM task_info t
     LEFT JOIN sys_user u ON t.publisher_id = u.id
     WHERE t.publisher_id IS NOT NULL AND ${groupWhere}
     ORDER BY real_name ASC`,
    params
  );
  return rows;
}

module.exports = {
  getUserList,
  findByUsername,
  findById,
  findFullById,
  createUser,
  updateUser,
  updatePassword,
  revokeRefreshTokens,
  updateStatus,
  deleteUserRelatedData,
  unlinkUserFromTasks,
  deleteUserById,
  getUsersByRole,
  getPublishersByRole,
  getPublishersByRoleAndStore,
  getTaskPublishersByGroup,
};
