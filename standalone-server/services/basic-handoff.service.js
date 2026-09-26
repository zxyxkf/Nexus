const { execute, executeTransaction } = require('../config/database');
const taskDao = require('../dao/task.dao');
const AppError = require('../utils/AppError');
const { withLock } = require('../utils/mutex');

const ONLINE = 'online';
const OFFLINE = 'offline';
const POOLED = 'pooled';
const POOLABLE_STATUSES = ['accepted', 'doing', 'pending_original', 'rejected'];

function assertBasicDesigner(user) {
  if (user?.role !== 'basic_designer') {
    throw new AppError(403, '仅基础美工可以执行此操作');
  }
}

async function getShiftStatus(user) {
  assertBasicDesigner(user);
  const [rows] = await execute(
    'SELECT cs_shift_status FROM sys_user WHERE id = ? AND role = ? AND status = 1',
    [user.id, 'basic_designer']
  );
  if (!rows.length) throw new AppError(403, '基础美工账号不存在或已停用');
  return rows[0].cs_shift_status || ONLINE;
}

async function assertBasicActionAvailable(user, actionName = '当前操作') {
  if (user?.role !== 'basic_designer') return;
  const status = await getShiftStatus(user);
  if (status !== ONLINE) {
    throw new AppError(403, `当前处于下线状态，无法${actionName}`);
  }
}

async function setShiftStatus(status, user) {
  assertBasicDesigner(user);
  if (![ONLINE, OFFLINE].includes(status)) {
    throw new AppError(400, '上线状态无效');
  }

  const data = await withLock(`basic-shift:${user.id}`, async () => executeTransaction(async (conn) => {
    const [users] = await conn.execute(
      'SELECT id, cs_shift_status FROM sys_user WHERE id = ? AND role = ? AND status = 1 FOR UPDATE',
      [user.id, 'basic_designer']
    );
    if (!users.length) throw new AppError(403, '基础美工账号不存在或已停用');

    await conn.execute(
      'UPDATE sys_user SET cs_shift_status = ?, update_time = NOW() WHERE id = ?',
      [status, user.id]
    );

    let movedTaskCount = 0;
    if (status === OFFLINE) {
      const placeholders = POOLABLE_STATUSES.map(() => '?').join(',');
      const [result] = await conn.execute(
        `UPDATE task_info
         SET basic_handoff_status = ?, basic_handoff_time = NOW(),
             designer_id = NULL, designer_name = '', update_time = NOW()
         WHERE task_group = 'cs'
           AND designer_id = ?
           AND status IN (${placeholders})
           AND COALESCE(basic_handoff_status, '') = ''`,
        [POOLED, user.id, ...POOLABLE_STATUSES]
      );
      movedTaskCount = Number(result?.affectedRows || 0);
    }

    return { status, movedTaskCount };
  }));

  if (global.io) {
    global.io.to(`user:${user.id}`).emit('task:update');
    if (data.movedTaskCount) global.io.to('group:cs').emit('task:update');
  }
  return data;
}

async function listPooledTasks(query, user) {
  if (!['admin', 'sub_admin', 'basic_designer'].includes(user?.role)) {
    throw new AppError(403, '无权查看基础美工暂存任务');
  }
  return taskDao.queryPooledCsTasks({
    handoffStatus: POOLED,
    handoffStatusField: 'basic_handoff_status',
    handoffTimeField: 'basic_handoff_time',
    keyword: query.keyword,
    status: query.status,
    includeStatusCounts: ['1', 'true'].includes(String(query.includeStatusCounts).toLowerCase()),
    page: parseInt(query.page, 10) || 1,
    pageSize: Math.min(Math.max(parseInt(query.pageSize, 10) || 15, 1), 100)
  });
}

async function claimPooledTask(taskId, user) {
  assertBasicDesigner(user);
  await assertBasicActionAvailable(user, '继承暂存任务');
  const normalizedTaskId = Number(taskId);
  if (!Number.isInteger(normalizedTaskId) || normalizedTaskId <= 0) {
    throw new AppError(400, '任务ID无效');
  }

  const data = await withLock(`basic-handoff:${normalizedTaskId}`, async () => executeTransaction(async (conn) => {
    const task = await taskDao.getTaskForUpdate(conn, normalizedTaskId);
    if (!task) throw new AppError(404, '暂存任务不存在');
    if (task.task_group !== 'cs' || task.basic_handoff_status !== POOLED) {
      throw new AppError(409, '该任务已被其他基础美工继承，请刷新后重试');
    }

    await taskDao.updateTaskFields(conn, normalizedTaskId, {
      designer_id: user.id,
      designer_name: user.realName || user.username || '',
      basic_handoff_status: '',
      basic_handoff_time: null
    });

    return { taskId: normalizedTaskId };
  }));

  if (global.io) {
    global.io.to(`user:${user.id}`).emit('task:update');
    global.io.to('group:cs').emit('task:update');
  }
  return data;
}

module.exports = {
  getShiftStatus,
  setShiftStatus,
  assertBasicActionAvailable,
  listPooledTasks,
  claimPooledTask
};
