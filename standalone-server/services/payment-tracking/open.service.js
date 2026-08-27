const AppError = require('../../utils/AppError');
const { getPool, executeTransaction } = require('../../config/database');
const repository = require('./repository');
const recordService = require('./record.service');
const imageService = require('./image.service');
const { PERMISSIONS } = require('./constants');
const { assertPermission, assertStoreAccess, isAdmin } = require('./access');

async function findSourceTask(taskId) {
  const [rows] = await getPool().execute(
    `SELECT t.id, t.task_no, t.style_number, t.publisher_id, t.status,
            COALESCE(NULLIF(t.task_group, ''), 'design') AS task_group,
            COALESCE(u.real_name, t.publisher_name, '') AS planner_name,
            COALESCE(u.store, '') AS publisher_store
     FROM task_info t
     LEFT JOIN sys_user u ON u.id = t.publisher_id
     WHERE t.id = ?`,
    [taskId]
  );
  return rows[0] || null;
}

async function listSourceImages(taskId) {
  const [rows] = await getPool().execute(
    `SELECT f.*
     FROM task_file f
     WHERE f.task_id = ?
       AND f.file_type = 'image'
       AND COALESCE(f.file_category, 'work') NOT IN ('reference', 'reject')
     ORDER BY f.create_time ASC, f.id ASC`,
    [taskId]
  );
  return rows;
}

async function presentOpenedRecord(recordId, user, alreadyOpened = false) {
  const record = await repository.findRecordById(recordId);
  if (!record) throw new AppError(404, '选品记录不存在');
  assertStoreAccess(record, user);
  const [stages, images] = await Promise.all([
    repository.listEnteredStages(record.id),
    repository.listImages(record.id)
  ]);
  const stageEntries = await Promise.all(stages.map(async stage => [
    stage.stage_code,
    await repository.loadStageData(record.id, stage.stage_code)
  ]));
  return {
    ...recordService.presentRecord(record, stages, images, user, Object.fromEntries(stageEntries)),
    ...(alreadyOpened ? { alreadyOpened: true } : {})
  };
}

function attachTask(error, task) {
  error.taskNo = task?.task_no || '';
  return error;
}

function assertTaskCanOpen(task, user) {
  if (task.task_group !== 'design') throw attachTask(new AppError(400, '仅运营美工作品任务可以开启打款'), task);
  if (!['doing', 'finished'].includes(task.status)) {
    throw attachTask(new AppError(400, '任务尚未提交作品'), task);
  }
  if (!task.publisher_id || !task.publisher_store) {
    throw attachTask(new AppError(400, '任务发布人未绑定店铺'), task);
  }
  if (!isAdmin(user) && user.store !== task.publisher_store) {
    throw attachTask(new AppError(403, '无权为其他店铺的任务开启打款'), task);
  }
}

async function openFromTask(taskId, user) {
  assertPermission(user, PERMISSIONS.open);
  const normalizedTaskId = Number(taskId);
  if (!Number.isInteger(normalizedTaskId) || normalizedTaskId < 1) throw new AppError(400, '无效任务ID');

  const existing = await repository.findRecordBySourceTaskId(normalizedTaskId, { includeDeleted: true });
  if (existing) {
    if (existing.deleted_at) throw new AppError(400, '已开启打款');
    return presentOpenedRecord(existing.id, user, true);
  }

  const task = await findSourceTask(normalizedTaskId);
  if (!task) throw new AppError(404, '任务不存在');
  assertTaskCanOpen(task, user);
  const files = await listSourceImages(task.id);
  if (!files.length) throw attachTask(new AppError(400, '没有作品图片'), task);
  try {
    imageService.validateTaskImageFiles(files);
  } catch (error) {
    throw attachTask(new AppError(400, '图片复制失败'), task);
  }

  const writtenPaths = [];
  let recordId;
  try {
    recordId = await executeTransaction(async conn => {
      const duplicate = await repository.findRecordBySourceTaskId(task.id, {
        conn,
        includeDeleted: true
      });
      if (duplicate) return duplicate.id;

      const storeSeq = await repository.allocateStoreSeq(conn, task.publisher_store);
      const id = await repository.insertRecord(conn, {
        store: task.publisher_store,
        storeSeq,
        plannerId: task.publisher_id,
        plannerName: task.planner_name,
        sourceTaskId: task.id,
        sourceTaskNo: task.task_no,
        styleNumber: task.style_number || ''
      });
      await repository.insertInitialStage(conn, id);
      await imageService.copyTaskImages(conn, {
        recordId: id,
        files,
        uploaderId: user.id,
        writtenPaths
      });
      return id;
    });
  } catch (error) {
    imageService.cleanupWrittenFiles(writtenPaths);
    if (String(error?.message || '').includes('uk_payment_source_task')
      || String(error?.message || '').includes('source_task_id')) {
      const raced = await repository.findRecordBySourceTaskId(task.id);
      if (raced) return presentOpenedRecord(raced.id, user, true);
    }
    throw attachTask(new AppError(400, '图片复制失败'), task);
  }

  return presentOpenedRecord(recordId, user);
}

function batchSkipReason(error) {
  const message = String(error?.message || '');
  if (message === '已开启打款') return '已开启打款';
  if (message === '没有作品图片') return '没有作品图片';
  if (message === '任务发布人未绑定店铺') return '任务发布人未绑定店铺';
  if (message.includes('图片') || message.includes('文件')) return '图片复制失败';
  return message || '开启失败';
}

async function openBatch(taskIds, user) {
  assertPermission(user, PERMISSIONS.open);
  if (!Array.isArray(taskIds) || !taskIds.length) throw new AppError(400, '请选择要开启打款的任务');
  const ids = [...new Set(taskIds.map(Number))];
  if (ids.length > 100 || ids.some(id => !Number.isInteger(id) || id < 1)) {
    throw new AppError(400, '批量任务参数不正确');
  }

  const created = [];
  const skipped = [];
  for (const taskId of ids) {
    try {
      const result = await openFromTask(taskId, user);
      if (result.alreadyOpened) {
        skipped.push({ taskId, taskNo: result.sourceTaskNo || '', reason: '已开启打款' });
      } else {
        created.push({ taskId, recordId: result.id });
      }
    } catch (error) {
      const task = error.taskNo ? null : await findSourceTask(taskId).catch(() => null);
      skipped.push({
        taskId,
        taskNo: error.taskNo || task?.task_no || '',
        reason: batchSkipReason(error)
      });
    }
  }

  return {
    successCount: created.length,
    skippedCount: skipped.length,
    created,
    skipped
  };
}

module.exports = {
  findSourceTask,
  listSourceImages,
  openFromTask,
  openBatch
};
