const { execute, executeTransaction } = require('../config/database');
const taskDao = require('../dao/task.dao');
const AppError = require('../utils/AppError');
const { withLock } = require('../utils/mutex');

const ONLINE = 'online';
const OFFLINE = 'offline';
const POOLED = 'pooled';

function assertCustomerServiceUser(user) {
  if (user?.role !== 'cs_agent') {
    throw new AppError(403, '仅客服人员可以执行此操作');
  }
}

async function getShiftStatus(user) {
  assertCustomerServiceUser(user);
  const [rows] = await execute(
    'SELECT cs_shift_status FROM sys_user WHERE id = ? AND role = ? AND status = 1',
    [user.id, 'cs_agent']
  );
  if (!rows.length) throw new AppError(403, '客服账号不存在或已停用');
  return rows[0].cs_shift_status || ONLINE;
}

async function assertCsActionAvailable(user, actionName = '当前操作') {
  if (user?.role !== 'cs_agent') return;
  const status = await getShiftStatus(user);
  if (status !== ONLINE) {
    throw new AppError(403, `当前处于下线状态，无法${actionName}`);
  }
}

async function setShiftStatus(status, user) {
  assertCustomerServiceUser(user);
  if (![ONLINE, OFFLINE].includes(status)) {
    throw new AppError(400, '上线状态无效');
  }

  const data = await withLock(`cs-shift:${user.id}`, async () => executeTransaction(async (conn) => {
    const [users] = await conn.execute(
      'SELECT id, cs_shift_status FROM sys_user WHERE id = ? AND role = ? AND status = 1 FOR UPDATE',
      [user.id, 'cs_agent']
    );
    if (!users.length) throw new AppError(403, '客服账号不存在或已停用');

    await conn.execute(
      'UPDATE sys_user SET cs_shift_status = ?, update_time = NOW() WHERE id = ?',
      [status, user.id]
    );

    let movedTaskCount = 0;
    if (status === OFFLINE) {
      const [result] = await conn.execute(
        `UPDATE task_info
         SET handoff_status = ?, handoff_time = NOW(),
             publisher_id = NULL, publisher_name = '', update_time = NOW()
         WHERE task_group = 'cs'
           AND publisher_id = ?
           AND status NOT IN ('wait', 'finished')`,
        [POOLED, user.id]
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
  if (user?.role !== 'admin' && user?.role !== 'sub_admin' && user?.role !== 'cs_agent') {
    throw new AppError(403, '无权查看客服暂存任务');
  }
  return taskDao.queryPooledCsTasks({
    keyword: query.keyword,
    status: query.status,
    designerId: query.designerId,
    page: parseInt(query.page, 10) || 1,
    pageSize: Math.min(Math.max(parseInt(query.pageSize, 10) || 15, 1), 100)
  });
}

async function claimPooledTask(taskId, user) {
  assertCustomerServiceUser(user);
  await assertCsActionAvailable(user, '继承暂存任务');
  const normalizedTaskId = Number(taskId);
  if (!Number.isInteger(normalizedTaskId) || normalizedTaskId <= 0) {
    throw new AppError(400, '任务ID无效');
  }

  const data = await withLock(`cs-handoff:${normalizedTaskId}`, async () => executeTransaction(async (conn) => {
    const task = await taskDao.getTaskForUpdate(conn, normalizedTaskId);
    if (!task) throw new AppError(404, '暂存任务不存在');
    if (task.task_group !== 'cs' || task.handoff_status !== POOLED) {
      throw new AppError(409, '该任务已被其他客服继承，请刷新后重试');
    }

    await taskDao.updateTaskFields(conn, normalizedTaskId, {
      publisher_id: user.id,
      publisher_name: user.realName || user.username || '',
      handoff_status: '',
      handoff_time: null
    });

    return { taskId: normalizedTaskId };
  }));
  if (global.io) {
    global.io.to(`user:${user.id}`).emit('task:update');
    global.io.to('group:cs').emit('task:update');
  }
  return data;
}

async function poolAcceptedTaskIfPublisherOffline(conn, task) {
  if (!task || task.task_group !== 'cs' || !task.publisher_id) return false;
  const [users] = await conn.execute(
    'SELECT cs_shift_status FROM sys_user WHERE id = ? AND role = ?',
    [task.publisher_id, 'cs_agent']
  );
  if (!users.length || (users[0].cs_shift_status || ONLINE) !== OFFLINE) return false;

  const [result] = await conn.execute(
    `UPDATE task_info
     SET handoff_status = ?, handoff_time = NOW(),
         publisher_id = NULL, publisher_name = '', update_time = NOW()
     WHERE id = ? AND task_group = 'cs' AND status = 'accepted'`,
    [POOLED, task.id]
  );
  return Number(result?.affectedRows || 0) === 1;
}

module.exports = {
  getShiftStatus,
  setShiftStatus,
  listPooledTasks,
  claimPooledTask,
  assertCsActionAvailable,
  poolAcceptedTaskIfPublisherOffline
};
