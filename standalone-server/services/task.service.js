/**
 * 任务 Service — 所有 task 业务逻辑
 * 调用 DAO，处理权限/状态校验，触发通知/Socket.IO
 */
const path = require('path');
const fs = require('fs');
const { executeTransaction, execute } = require('../config/database');
const AppError = require('../utils/AppError');
const taskDao = require('../dao/task.dao');
const materialDao = require('../dao/material-library.dao');
const { saveImage, saveAttachment, resolvePath } = require('../utils/share');
const { withLock } = require('../utils/mutex');
const { IMAGE_EXTS, fixFilenameEncoding } = require('../utils/upload');
const logger = require('../utils/business-logger');
const { sendNotification, notifyTaskEvent } = require('../utils/notification');
const { isUserOnline } = require('../utils/online');
const { defaultPermissionsFor } = require('../config/permissions');
const {
  hasPermission,
  canViewByAllTasksPermission,
  allowedAllTaskGroups
} = require('../utils/task-permissions');
const {
  canManageAllPaymentData,
  canViewAllPaymentData
} = require('./payment-tracking/access');
const csHandoffService = require('./cs-handoff.service');
const taskStyleSnapshotService = require('./task-style-snapshot.service');

// ==================== 辅助 ====================

function getTargetRole(taskGroup) {
  if (taskGroup === 'cs') return 'basic_designer';
  if (taskGroup === 'operator') return 'operator_assistant';
  return 'designer';
}

function socketEmit(room, event = 'task:update') {
  if (global.io) global.io.to(room).emit(event);
}

function normalizedTaskGroup(task) {
  return task?.task_group || 'design';
}

function canViewAllPaymentTasks(user) {
  return canViewAllPaymentData(user);
}

function canOpenPaymentTask(task, user) {
  if (!hasPermission(user, 'payment.open') && !canManageAllPaymentData(user)) return false;
  if (normalizedTaskGroup(task) !== 'design') return false;
  if (!['doing', 'finished'].includes(task?.status)) return false;
  if (!task?.publisher_id || !task?.publisher_store) return false;
  return canViewAllPaymentTasks(user) || task.publisher_store === user?.store;
}

function canReviewTask(task, user) {
  if (task?.status !== 'doing') return false;
  const groupPermission = normalizedTaskGroup(task) === 'operator'
    ? 'operator.review.assistant'
    : normalizedTaskGroup(task) === 'cs'
      ? 'cs.review.basic'
      : 'operator.review.design';
  const hasReviewPermission = hasPermission(user, groupPermission)
    || hasPermission(user, 'task.review.own')
    || hasPermission(user, 'task.review.store')
    || hasPermission(user, 'task.review.all');
  if (!hasReviewPermission) return false;
  if (user?.role === 'operator' || user?.role === 'cs_agent') {
    return Number(task.publisher_id) === Number(user.id);
  }
  return true;
}

function attachAllowedActions(task, user) {
  return {
    ...task,
    allowedActions: {
      review: canReviewTask(task, user),
      openPayment: canOpenPaymentTask(task, user)
    }
  };
}

// ==================== 创建/编辑/删除 ====================

async function prepareTaskCreation(body, user) {
  const title = String(body?.title || '').trim();
  if (!title) throw new AppError(400, '任务标题不能为空');
  const taskGroup = body.taskGroup || (user.role === 'cs_agent' ? 'cs' : 'design');
  if (taskGroup === 'cs') await csHandoffService.assertCsActionAvailable(user, '发布任务');
  return { title, taskGroup };
}

async function insertCreatedTask(conn, body, user, taskGroup, title) {
  const { description, priority, deadline, scoreItemId, score, refPath, wangwangId, styleNumber, specifiedColor, designerId, shopName, quantity, taskFilePath } = body;
  const targetRole = getTargetRole(taskGroup);
  const taskNo = await taskDao.generateTaskNo(conn, taskGroup);

  let status = 'wait';
  let designerIdVal = null;
  let designerNameVal = null;

  if (designerId) {
    const designer = await taskDao.findDesigner(conn, designerId, targetRole);
    if (designer) {
      status = 'accepted';
      designerIdVal = designer.id;
      designerNameVal = designer.real_name;
    }
  }

  const insertId = await taskDao.insertTask(conn, {
    taskNo, title, description: description || '', priority: priority || 2,
    deadline: deadline || null, publisherId: user.id, status,
    publisherName: user.realName || user.username,
    scoreItemId: scoreItemId || null, score: score || 0,
    refPath: taskGroup === 'cs' ? '' : (refPath || ''),
    styleNumber: styleNumber || '', specifiedColor: specifiedColor || '',
    wangwangId: taskGroup === 'cs' ? (wangwangId || '') : '',
    designerId: designerIdVal, designerName: designerNameVal,
    taskGroup, shopName: shopName || '', quantity: quantity || 1,
    taskFilePath: taskFilePath || '',
    acceptTime: designerIdVal ? new Date() : null
  });

  return { insertId, assignedId: designerIdVal, taskGroup, title };
}

function isDuplicateKeyError(error) {
  return error?.code === 'ER_DUP_ENTRY'
    || error?.errno === 1062
    || error?.errno === 19
    || error?.message?.includes('UNIQUE constraint failed');
}

function announceCreatedTask(result, user) {
  const taskId = result.insertId;
  const actualDesignerId = result.assignedId;
  const { taskGroup, title } = result;

  logger.info('任务创建', { userId: user.id, taskId, taskGroup, designerId: actualDesignerId || null });
  socketEmit(`group:${taskGroup}`);
  if (actualDesignerId) {
    socketEmit(`user:${actualDesignerId}`);
    const actorName = taskGroup === 'cs' ? '客服' : '运营';
    sendNotification({
      userId: actualDesignerId,
      type: 'task_assigned',
      title: '新任务分配',
      content: `${actorName} ${user.realName || user.username} 分配给您一个新任务「${title}」`,
      taskId,
      taskTitle: title,
      taskGroup,
      publisherId: user.id,
      designerId: actualDesignerId
    }).catch(() => {});
  }

  const msg = actualDesignerId
    ? (taskGroup === 'cs' ? '任务已发布并直接分配给基础美工' : taskGroup === 'operator' ? '任务已发布并直接分配给运营助理' : '任务已发布并直接分配给美工')
    : '任务发布成功';
  return { msg, data: { id: taskId } };
}

async function createTask(body, user) {
  const { title, taskGroup } = await prepareTaskCreation(body, user);

  return withLock(`task-no:${taskGroup}`, async () => {
    for (let retry = 0; retry < 3; retry++) {
      try {
        const result = await executeTransaction(conn => insertCreatedTask(conn, body, user, taskGroup, title));
        return announceCreatedTask(result, user);
      } catch (err) {
        if (err instanceof AppError || !isDuplicateKeyError(err) || retry >= 2) throw err;
      }
    }
    throw new AppError(500, '任务编号生成冲突，请重试');
  });
}

async function persistInitialReferenceFiles(conn, taskId, files, taskGroup, userId, storedPaths) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  for (const file of files || []) {
    file.originalname = fixFilenameEncoding(file.originalname);
    const extension = path.extname(file.originalname).toLowerCase();
    const fileType = IMAGE_EXTS.includes(extension) ? 'image' : 'attachment';
    const filePath = fileType === 'image'
      ? saveImage(taskGroup, dateStr, path.basename(file.path), fs.readFileSync(file.path))
      : saveAttachment(taskGroup, dateStr, path.basename(file.path), file.path);
    storedPaths.push(filePath);
    await taskDao.insertFileRecord(conn, {
      taskId,
      fileName: file.originalname,
      filePath,
      fileSize: file.size,
      fileType,
      mimeType: file.mimetype || '',
      uploaderId: userId,
      fileCategory: 'reference'
    });
  }
}

async function publishTask(body, referenceFiles, styleOptions, user) {
  const { title, taskGroup } = await prepareTaskCreation(body, user);
  const manifest = Array.isArray(styleOptions?.manifest) ? styleOptions.manifest : [];
  const materialStyleId = styleOptions?.materialStyleId;
  const editedFiles = styleOptions?.files || [];
  if (manifest.length && !materialStyleId) throw new AppError(400, '缺少款式素材信息');

  return withLock(`task-no:${taskGroup}`, async () => {
    for (let retry = 0; retry < 3; retry++) {
      const storedPaths = [];
      try {
        const result = await executeTransaction(async conn => {
          const created = await insertCreatedTask(conn, body, user, taskGroup, title);
          await persistInitialReferenceFiles(conn, created.insertId, referenceFiles, taskGroup, user.id, storedPaths);
          if (manifest.length) {
            await taskStyleSnapshotService.persistTaskStyleSnapshots({
              conn,
              task: { id: created.insertId, task_group: taskGroup, publisher_id: user.id },
              taskId: created.insertId,
              materialStyleId,
              manifest,
              files: editedFiles,
              user,
              writtenPaths: storedPaths
            });
          }
          return created;
        });
        return announceCreatedTask(result, user);
      } catch (err) {
        for (const filePath of storedPaths) {
          try {
            const absolutePath = resolvePath(filePath);
            if (absolutePath && fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
          } catch (_) {}
        }
        if (err instanceof AppError || !isDuplicateKeyError(err) || retry >= 2) throw err;
      }
    }
    throw new AppError(500, '任务编号生成冲突，请重试');
  });
}

/** 将客服发布时选择的素材图复制为任务独立副本。素材库后续变更不会影响历史任务。 */
async function snapshotMaterialImages(taskId, materialStyleId, materialImageIds, user) {
  if (!taskId || !materialStyleId || !Array.isArray(materialImageIds) || materialImageIds.length === 0) {
    return { copied: 0 };
  }
  if (user?.role !== 'cs_agent' && user?.role !== 'admin') throw new AppError(403, '仅客服可关联款式素材');

  const task = await taskDao.getTaskDetail(taskId);
  if (!task || task.task_group !== 'cs') throw new AppError(400, '仅客服任务支持款式素材');
  if (Number(task.publisher_id) !== Number(user.id) && user.role !== 'admin') throw new AppError(403, '无权操作此任务');

  const style = await materialDao.getStyle(Number(materialStyleId));
  if (!style) throw new AppError(404, '款式不存在');
  const ids = [...new Set(materialImageIds.map(Number).filter(Number.isInteger))];
  if (!ids.length) return { copied: 0 };
  const images = await materialDao.getImagesByIds(ids);
  if (images.length !== ids.length || images.some(image => Number(image.style_id) !== Number(style.id))) {
    throw new AppError(400, '所选素材图片与款式不匹配');
  }

  const copiedPaths = [];
  try {
    await executeTransaction(async conn => {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      for (const image of images) {
        const sourcePath = resolvePath(image.file_path);
        if (!sourcePath || !fs.existsSync(sourcePath)) throw new AppError(404, `素材图片不存在：${image.display_name || image.original_name}`);
        const ext = path.extname(image.original_name || image.display_name || sourcePath).toLowerCase() || '.jpg';
        const storedName = `style-${image.id}-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
        const targetPath = saveImage('cs', dateStr, storedName, fs.readFileSync(sourcePath));
        copiedPaths.push(targetPath);
        await taskDao.insertFileRecord(conn, {
          taskId, fileName: image.display_name || image.original_name, filePath: targetPath,
          fileSize: image.file_size || 0, fileType: 'image', mimeType: image.mime_type || '',
          uploaderId: user.id, fileCategory: 'style'
        });
      }
    });
  } catch (err) {
    for (const filePath of copiedPaths) { try { const abs = resolvePath(filePath); if (abs && fs.existsSync(abs)) fs.unlinkSync(abs); } catch (_) {} }
    throw err;
  }
  socketEmit(`user:${task.publisher_id}`);
  socketEmit('group:cs');
  return { copied: images.length };
}

async function assertTaskViewAccess(task, user) {
  const canViewAllTaskDetail = hasPermission(user, 'task.view.all')
    || canViewByAllTasksPermission(task, user)
    || canOpenPaymentTask(task, user)
    || (task.task_group === 'cs'
      && task.handoff_status === 'pooled'
      && hasPermission(user, 'cs.handoff.tasks'));
  if (user.role !== 'admin' && !canViewAllTaskDetail) {
    if (user.role === 'operator' || user.role === 'cs_agent') {
      if (Number(task.publisher_id) !== Number(user.id)) {
        // operator: 允许查看同店铺其他运营的任务
        if (user.role === 'operator' && user.store) {
          const [publisherRows] = await execute(
            'SELECT store FROM sys_user WHERE id = ?',
            [task.publisher_id]
          )
          if (publisherRows.length === 0 || publisherRows[0].store !== user.store) {
            throw new AppError(403, '无权查看他人任务')
          }
        } else {
          throw new AppError(403, '无权查看他人任务')
        }
      }
    }
    if (user.role === 'designer' || user.role === 'basic_designer' || user.role === 'operator_assistant') {
      // 基础美工组长允许查看分值审核相关任务
      const isTeamLeadViewing = user.role === 'basic_designer' && user.isTeamLead && task.score_review_status;
      if (!isTeamLeadViewing && task.status !== 'wait' && Number(task.designer_id) !== Number(user.id)) {
        throw new AppError(403, '无权查看他人任务')
      }
    }
  }
}

async function getTaskFileForUser(fileId, user) {
  const [rows] = await execute(
    `SELECT f.*, t.publisher_id, t.designer_id, t.task_group, t.status,
            t.handoff_status, COALESCE(u.store, '') AS publisher_store
     FROM task_file f
     INNER JOIN task_info t ON t.id = f.task_id
     LEFT JOIN sys_user u ON u.id = t.publisher_id
     WHERE f.id = ?`,
    [fileId]
  );
  const file = rows[0];
  if (!file) throw new AppError(404, '文件不存在');
  await assertTaskViewAccess(file, user);
  return file;
}

async function getTaskDetail(taskId, user) {
  if (!taskId) throw new AppError(400, '任务ID不能为空');

  const task = await taskDao.getTaskDetail(taskId);
  if (!task) throw new AppError(400, '任务不存在');
  await assertTaskViewAccess(task, user);

  const files = await taskDao.getTaskFiles(taskId);
  const transferRecords = task.task_group === 'cs'
    ? await taskDao.getTaskTransferRecords(taskId)
    : [];
  const rejectRecords = task.task_group === 'cs'
    ? await taskDao.getTaskRejectRecords(taskId)
    : [];
  return attachAllowedActions({ ...task, files, transfer_records: transferRecords, reject_records: rejectRecords }, user);
}

async function deleteTask(taskId, user) {
  if (!taskId) throw new AppError(400, '任务ID不能为空');
  await taskDao.deleteTaskData(taskId);
  logger.info('任务删除', { userId: user?.id, taskId });
  return { msg: '任务已删除' };
}

async function updateTask(body, user) {
  const { taskId, title, description, priority, deadline, scoreItemId, score, refPath, wangwangId, styleNumber, specifiedColor, designerId, shopName, quantity, taskFilePath } = body;

  if (!taskId || !title) throw new AppError(400, '任务ID和标题不能为空');

  await executeTransaction(async (conn) => {
    const task = await taskDao.getTaskForUpdate(conn, taskId);
    if (!task) throw new AppError(400, '任务不存在');
    if (Number(task.publisher_id) !== Number(user.id)) throw new AppError(403, '无权编辑他人任务');
    if (task.status !== 'draft') throw new AppError(400, '仅草稿状态可编辑');

    const taskGroup = task.task_group;
    const targetRole = getTargetRole(taskGroup);

    let status = 'wait';
    let designerIdVal = null;
    let designerNameVal = null;

    if (designerId) {
      const d = await taskDao.findDesigner(conn, designerId, targetRole);
      if (d) {
        status = 'accepted';
        designerIdVal = d.id;
        designerNameVal = d.real_name;
      }
    }

    const fields = {
      title, description: description || '', priority: priority || 2,
      deadline: deadline || null, score_item_id: scoreItemId || null,
      score: score || 0,
      ref_path: taskGroup === 'cs' ? '' : (refPath || ''),
      wangwang_id: taskGroup === 'cs' ? (wangwangId || '') : '',
      style_number: styleNumber || '', specified_color: specifiedColor || '',
      designer_id: designerIdVal, designer_name: designerNameVal, status,
      shop_name: shopName || '', quantity: quantity || 1,
      task_file_path: taskFilePath || '',
      accept_time: designerIdVal ? new Date() : null
    };
    await taskDao.updateTaskFields(conn, taskId, fields);
  });

  return { msg: '任务已重新发布' };
}

async function reopenFinishedCsTask(body, user) {
  const {
    taskId, title, description, priority, deadline, scoreItemId, score,
    wangwangId, styleNumber, designerId
  } = body;

  if (!taskId || !title) throw new AppError(400, '任务ID和工作项目不能为空');
  if (user.role !== 'cs_agent') throw new AppError(403, '仅客服可重开基础美工任务');

  let nextDesignerId = null;
  let previousDesignerId = null;
  await executeTransaction(async (conn) => {
    const task = await taskDao.getTaskForUpdate(conn, taskId);
    if (!task) throw new AppError(400, '任务不存在');
    if (task.task_group !== 'cs') throw new AppError(400, '仅基础美工任务可重开');
    if (task.status !== 'finished') throw new AppError(400, '仅已完成任务可重新发布');
    if (Number(task.publisher_id) !== Number(user.id)) throw new AppError(403, '无权重开他人发布的任务');

    previousDesignerId = task.designer_id || null;
    const selectedDesignerId = designerId || task.designer_id;
    let designerIdVal = null;
    let designerNameVal = null;
    let nextStatus = 'wait';

    if (selectedDesignerId) {
      const d = await taskDao.findDesigner(conn, selectedDesignerId, 'basic_designer');
      if (!d) throw new AppError(400, '指定基础美工不存在或不可用');
      designerIdVal = d.id;
      designerNameVal = d.real_name;
      nextStatus = 'accepted';
    }
    nextDesignerId = designerIdVal;

    let baseScore = Number(score) || 0;
    if (scoreItemId) {
      const [scoreRows] = await conn.execute(
        `SELECT score FROM sys_score_item_cs WHERE id = ? LIMIT 1`,
        [scoreItemId]
      );
      if (scoreRows.length) baseScore = Number(scoreRows[0].score) || 0;
    }

    await taskDao.updateTaskFields(conn, taskId, {
      title,
      description: description || '',
      priority: priority || 2,
      deadline: deadline || null,
      score_item_id: scoreItemId || null,
      score: baseScore,
      wangwang_id: wangwangId || '',
      style_number: styleNumber || '',
      designer_id: designerIdVal,
      designer_name: designerNameVal,
      status: nextStatus,
      accept_time: designerIdVal ? new Date() : null,
      finish_time: null,
      submit_time: null,
      reject_reason: '',
      applied_score: 0,
      score_review_status: '',
      score_review_reason: '',
      score_review_time: null,
      score_review_score: 0,
      actual_quantity: 0,
      urge_time: null
    });
  });

  if (previousDesignerId) socketEmit(`user:${previousDesignerId}`);
  if (nextDesignerId && Number(nextDesignerId) !== Number(previousDesignerId)) socketEmit(`user:${nextDesignerId}`);
  socketEmit('group:cs');
  logger.info('客服重开已完成基础美工任务', { userId: user.id, taskId, designerId: nextDesignerId });
  return { msg: '任务已重新发布，原完成分值已扣回' };
}

async function updateCsTaskNo(taskId, taskNo, user) {
  const normalizedTaskNo = String(taskNo || '').trim();
  if (!taskId || !normalizedTaskNo) throw new AppError(400, '任务ID和任务编号不能为空');
  const permissions = new Set(user?.permissions || []);
  const canUseLegacyCsRole = !user?.hasPermissionClaim && user?.role === 'cs_agent';
  const canUpdateTaskNo = user?.role === 'admin' || permissions.has('*') || permissions.has('cs.task_no.update') || canUseLegacyCsRole;
  if (!canUpdateTaskNo) throw new AppError(403, '缺少修改基础美工任务编号权限');

  let changedTask = null;
  await executeTransaction(async (conn) => {
    const task = await taskDao.getTaskForUpdate(conn, taskId);
    if (!task) throw new AppError(400, '任务不存在');
    if (task.task_group !== 'cs') throw new AppError(400, '仅基础美工任务可修改编号');
    if (task.status !== 'finished') throw new AppError(400, '仅已完成任务可修改编号');
    if (Number(task.publisher_id) !== Number(user.id)) throw new AppError(403, '无权修改他人发布的任务');

    await taskDao.updateTaskFields(conn, taskId, { task_no: normalizedTaskNo });
    changedTask = task;
  });

  if (changedTask?.publisher_id) socketEmit(`user:${changedTask.publisher_id}`);
  if (changedTask?.designer_id) socketEmit(`user:${changedTask.designer_id}`);
  socketEmit('group:cs');
  logger.info('客服修改基础美工任务编号', { userId: user.id, taskId, taskNo: normalizedTaskNo });
  return { msg: '任务编号已更新' };
}

async function batchDelete(taskIds) {
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    throw new AppError(400, '请选择任务');
  }
  await taskDao.batchDeleteTasks(taskIds);
  return { msg: `成功删除 ${taskIds.length} 个任务` };
}

async function batchReassign(taskIds, designerId, designerName) {
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0 || !designerId) {
    throw new AppError(400, '参数不完整');
  }
  await taskDao.batchReassignTasks(taskIds, designerId, designerName);
  return { msg: '重新分配成功' };
}

// ==================== 查询 ====================

async function getMyPublished(query, user) {
  const page = parseInt(query.page) || 1;
  const pageSize = parseInt(query.pageSize) || 15;
  const group = query.taskGroup || (user.role === 'cs_agent' ? 'cs' : 'design');
  const selfOnly = query.selfOnly === '1' || query.selfOnly === 'true';
  const allPaymentTasks = canViewAllPaymentTasks(user);
  const paymentOpenView = group === 'design'
    && hasPermission(user, 'payment.open')
    && (!selfOnly || allPaymentTasks);

  const result = await taskDao.queryMyPublished({
    userId: user.id, role: user.role,
    store: user.store || '',
    permissions: user.permissions || [],
    filterGroup: group,
    selfOnly,
    paymentOpenView,
    canViewAllPaymentTasks: allPaymentTasks,
    status: query.status, styleNumber: query.styleNumber,
    keyword: query.keyword, taskNo: query.taskNo, designerId: query.designerId,
    publisherId: query.publisherId,
    dateStart: query.dateStart, dateEnd: query.dateEnd,
    dateField: query.dateField,
    sortField: query.sortField, sortOrder: query.sortOrder,
    page, pageSize
  });
  result.list = result.list.map(task => attachAllowedActions(task, user));
  return result;
}

async function getMyAccepted(query, user) {
  const page = parseInt(query.page) || 1;
  const pageSize = parseInt(query.pageSize) || 15;

  const result = await taskDao.queryMyAccepted({
    userId: user.id, role: user.role,
    permissions: user.permissions || [],
    taskGroup: query.taskGroup,
    status: query.status, keyword: query.keyword,
    publisherId: query.publisherId,
    scoreItemId: query.scoreItemId,
    dateStart: query.dateStart, dateEnd: query.dateEnd,
    dateField: query.dateField,
    shopName: query.shopName,
    page, pageSize
  });
  return result;
}

async function getTaskHall(query, user) {
  const page = parseInt(query.page) || 1;
  const pageSize = parseInt(query.pageSize) || 15;

  return taskDao.queryTaskHall({
    role: user.role,
    permissions: user.permissions || [],
    taskGroup: query.taskGroup,
    keyword: query.keyword,
    sortField: query.sortField, sortOrder: query.sortOrder,
    page, pageSize
  });
}

async function getAllTasks(query) {
  const page = parseInt(query.page) || 1;
  const pageSize = parseInt(query.pageSize) || 15;

  return taskDao.queryAllTasks({
    status: query.status, keyword: query.keyword,
    publisherId: query.publisherId, designerId: query.designerId,
    startDate: query.startDate, endDate: query.endDate,
    dateField: query.dateField,
    taskGroup: query.taskGroup || undefined,
    sortField: query.sortField, sortOrder: query.sortOrder,
    page, pageSize
  });
}

function allowedAdminTaskGroups(user) {
  return allowedAllTaskGroups(user);
}

async function getAllTasksForUser(query, user) {
  const requestedGroup = query.taskGroup || 'design';
  const allowedGroups = allowedAdminTaskGroups(user);
  if (!allowedGroups.includes(requestedGroup)) {
    throw new AppError(403, '无权查看该全量任务分区');
  }
  return getAllTasks({ ...query, taskGroup: requestedGroup });
}

async function searchTasks(query, user) {
  const keyword = String(query.keyword || '').trim();
  if (!keyword) return { list: [], total: 0, page: 1, pageSize: 12, totalPages: 0 };
  return taskDao.searchTasks({
    userId: user.id,
    role: user.role,
    store: user.store,
    permissions: user.permissions || [],
    keyword,
    pageSize: query.pageSize
  });
}

function allowedDashboardGroups(user) {
  const permissionMap = {
    design: 'dashboard.design',
    operator: 'dashboard.operator',
    cs: 'dashboard.cs'
  };
  const rawPermissions = user?.hasPermissionClaim
    ? (Array.isArray(user?.permissions) ? user.permissions : [])
    : defaultPermissionsFor(user?.role, user?.isTeamLead || user?.is_team_lead);
  const permissions = new Set(rawPermissions);
  return Object.entries(permissionMap)
    .filter(([, permission]) => user?.role === 'admin' || permissions.has('*') || permissions.has(permission))
    .map(([group]) => group);
}

function emptyGroupStats(taskGroup) {
  return { task_group: taskGroup, total: 0, wait_count: 0, accepted_count: 0, doing_count: 0, finished_count: 0, rejected_count: 0 };
}

function visibleSidebarBadges(user, ownStats = {}, reviewStats = {}) {
  const badges = {};

  if (hasPermission(user, 'designer.tasks.design')) badges['/designer/tasks/todo'] = Number(reviewStats.design_todo_count || 0);
  if (hasPermission(user, 'basic.tasks.cs')) badges['/basic/tasks/todo'] = Number(reviewStats.basic_todo_count || 0);
  if (hasPermission(user, 'assistant.tasks.operator')) badges['/operator-assistant/tasks/todo'] = Number(reviewStats.assistant_todo_count || 0);

  if (hasPermission(user, 'operator.review.design')) badges['/operator/review'] = Number(reviewStats.design_review_count || 0);
  if (hasPermission(user, 'operator.review.assistant')) badges['/operator/op-review'] = Number(reviewStats.operator_review_count || 0);
  if (hasPermission(user, 'cs.review.basic')) badges['/cs/review'] = Number(reviewStats.cs_review_count || 0);
  if (user?.role === 'cs_agent' && hasPermission(user, 'cs.tasks.basic')) badges['/cs/tasks'] = Number(reviewStats.cs_modification_count || 0);
  if (hasPermission(user, 'cs.handoff.tasks')) badges['/cs/handoff-tasks'] = Number(reviewStats.cs_handoff_count || 0);
  if (hasPermission(user, 'score.review.basic')) badges['/basic/score-review'] = Number(reviewStats.score_review_count || 0);

  return badges;
}

function filterDashboardStatsByPermission(data, user) {
  const allowed = new Set(allowedDashboardGroups(user));
  return {
    designStats: allowed.has('design') ? data.designStats : emptyGroupStats('design'),
    csStats: allowed.has('cs') ? data.csStats : emptyGroupStats('cs'),
    operatorStats: allowed.has('operator') ? data.operatorStats : emptyGroupStats('operator'),
    designerLastMonthRank: allowed.has('design') ? data.designerLastMonthRank : [],
    designerCurrentMonthRank: allowed.has('design') ? data.designerCurrentMonthRank : [],
    basicDesignerLastMonthRank: allowed.has('cs') ? data.basicDesignerLastMonthRank : [],
    basicDesignerCurrentMonthRank: allowed.has('cs') ? data.basicDesignerCurrentMonthRank : [],
    operatorAssistantLastMonthRank: allowed.has('operator') ? data.operatorAssistantLastMonthRank : [],
    operatorAssistantCurrentMonthRank: allowed.has('operator') ? data.operatorAssistantCurrentMonthRank : [],
    designerRank: allowed.has('design') ? data.designerRank : [],
    csAgentRank: allowed.has('cs') ? data.csAgentRank : [],
    operatorPublisherRank: allowed.has('operator') ? data.operatorPublisherRank : []
  };
}

function filterAdminDetailStatsByPermission(data, user) {
  const allowed = new Set(allowedDashboardGroups(user));
  const scoreItems = allowed.size ? data.scoreItems : [];
  return {
    designerStats: allowed.has('design') ? data.designerStats : [],
    basicDesignerStats: allowed.has('cs') ? data.basicDesignerStats : [],
    operatorAssistantStats: allowed.has('operator') ? data.operatorAssistantStats : [],
    designerDailyStats: allowed.has('design') ? data.designerDailyStats : [],
    basicDesignerDailyStats: allowed.has('cs') ? data.basicDesignerDailyStats : [],
    basicDesignerImageMonthlyStats: allowed.has('cs') ? data.basicDesignerImageMonthlyStats : { current: [], last: [] },
    basicDesignerImageDailyStats: allowed.has('cs') ? data.basicDesignerImageDailyStats : [],
    operatorAssistantDailyStats: allowed.has('operator') ? data.operatorAssistantDailyStats : [],
    operatorStats: allowed.has('design') ? data.operatorStats : [],
    operatorPublishStats: allowed.has('operator') ? data.operatorPublishStats : [],
    csAgentStats: allowed.has('cs') ? data.csAgentStats : [],
    scoreItems
  };
}

// ==================== 任务动作 ====================

async function acceptTask(taskId, user) {
  if (!taskId) throw new AppError(400, '任务ID不能为空');

  return withLock(`accept:${taskId}`, async () => {
    let pooledPublisherId = null;
    await executeTransaction(async (conn) => {
      const task = await taskDao.getTaskForUpdate(conn, taskId);
      if (!task) throw new AppError(400, '任务不存在');
      if (task.status !== 'wait') throw new AppError(400, '任务已被接单，请刷新后重试');

      await taskDao.updateTaskStatus(conn, taskId, 'accepted', {
        designer_id: user.id,
        accept_time: new Date()
      });
      if (await csHandoffService.poolAcceptedTaskIfPublisherOffline(conn, task)) {
        pooledPublisherId = task.publisher_id;
      }
    });

    const brief = await taskDao.getTaskBrief(taskId);
    if (brief) {
      await notifyTaskEvent('task_accept', { ...brief, designer_id: user.id }, user);
      socketEmit(`user:${brief.publisher_id}`);
      if (pooledPublisherId) socketEmit(`user:${pooledPublisherId}`);
      socketEmit(`group:${brief.task_group || 'design'}`);
    }

    logger.info('任务接单', { userId: user.id, taskId });

    return { msg: '接单成功，请尽快完成' };
  });
}

async function uploadFiles(taskId, files, fileCategory, actualQuantity, appliedScore, workPath, user, options = {}) {
  if (!taskId) throw new AppError(400, '任务ID不能为空');
  files = files || [];
  appliedScore = parseFloat(appliedScore) || 0;
  workPath = (workPath || '').trim();
  const hasWorkPathField = Object.prototype.hasOwnProperty.call(options, 'hasWorkPathField')
    ? options.hasWorkPathField
    : !!workPath;
  const saveOnly = options.saveOnly === true;

  const isOpAssistant = user.role === 'operator_assistant';
  const canUpdateWorkPathOnly = user.role === 'designer' && fileCategory === 'work' && hasWorkPathField;
  const isRejectAttachment = fileCategory === 'reject';
  const rejectRecordId = options.rejectRecordId ? Number(options.rejectRecordId) : null;
  const hasModificationReply = Object.prototype.hasOwnProperty.call(options, 'modificationReply');
  const modificationReply = String(options.modificationReply || '').trim();
  const hasRetainedFileIds = Object.prototype.hasOwnProperty.call(options, 'retainedFileIds');
  const retainedFileIds = [...new Set((options.retainedFileIds || [])
    .map(Number)
    .filter(id => Number.isInteger(id) && id > 0))];
  const isBasicRetainedSubmission = user.role === 'basic_designer'
    && fileCategory === 'work'
    && hasRetainedFileIds;

  // 运营助理允许无文件仅提交完成次数；美工允许无文件仅保存上传路径。
  if ((!files || files.length === 0) && !isOpAssistant && !canUpdateWorkPathOnly && !isBasicRetainedSubmission) {
    throw new AppError(400, '请选择文件');
  }

  if ((!files || files.length === 0) && !isBasicRetainedSubmission) {
    let pathOnlyUpdated = false;
    await executeTransaction(async (conn) => {
      const task = await taskDao.getTaskForUpdate(conn, taskId);
      if (!task) throw new AppError(400, '任务不存在');
      if (Number(task.designer_id) !== Number(user.id)) throw new AppError(403, '无权操作此任务');

      if (isOpAssistant && (task.status === 'accepted' || task.status === 'rejected')) {
        if (!actualQuantity) throw new AppError(400, '请上传完成凭证或填写完成次数');
        await taskDao.updateTaskStatus(conn, taskId, 'doing', { actual_quantity: actualQuantity, urge_time: null });
        const { notifyTaskEvent } = require('../utils/notification');
        await notifyTaskEvent('task_submit', { ...task, id: taskId }, user);
      } else if (canUpdateWorkPathOnly && (task.status === 'accepted' || task.status === 'rejected')) {
        await conn.execute(`UPDATE task_info SET work_path = ? WHERE id = ?`, [workPath, taskId]);
        pathOnlyUpdated = true;
      } else if (canUpdateWorkPathOnly) {
        throw new AppError(400, '当前状态不能修改上传路径');
      }

      const [pubRows] = await conn.execute(`SELECT publisher_id FROM task_info WHERE id = ?`, [taskId]);
      if (pubRows.length) socketEmit(`user:${pubRows[0].publisher_id}`);
    });
    return { msg: pathOnlyUpdated ? '上传路径已保存' : '完成次数已提交，等待审核' };
  }

  const removedStoredPaths = [];
  await executeTransaction(async (conn) => {
    const task = await taskDao.getTaskForUpdate(conn, taskId);
    if (!task) throw new AppError(400, '任务不存在');

    // 权限校验：发布者上传参考图/驳回附件，执行者上传作品
    if (isRejectAttachment) {
      if (task.task_group !== 'cs') {
        throw new AppError(400, '仅客服基础美工任务支持驳回附件');
      }
      if (Number(task.publisher_id) !== Number(user.id)) {
        throw new AppError(403, '无权上传驳回附件');
      }
    } else if (user.role === 'operator' || user.role === 'cs_agent') {
      if (Number(task.publisher_id) !== Number(user.id)) {
        throw new AppError(403, '无权为此任务上传参考图');
      }
    } else {
      if (Number(task.designer_id) !== Number(user.id)) {
        throw new AppError(403, '无权上传此任务的作品');
      }
    }

    if (saveOnly && fileCategory !== 'reference') {
      if (user.role !== 'designer' && user.role !== 'operator_assistant') {
        throw new AppError(403, '无权保存待提交文件');
      }
      if (task.status !== 'accepted' && task.status !== 'rejected') {
        throw new AppError(400, '当前状态不能保存待提交文件');
      }
    }

    const isBasicDesigner = user.role === 'basic_designer';

    if (fileCategory === 'reference' && options.replaceExisting) {
      await taskDao.deleteFilesByCategory(conn, taskId, 'reference');
    }

    // 非参考图且非基础美工 → 覆盖旧文件
    if (fileCategory !== 'reference' && !isRejectAttachment && !isBasicDesigner) {
      await taskDao.deleteWorkFiles(conn, taskId);
    }

    const taskGroup = task.task_group || 'design';
    const isCsModificationSubmission = isBasicDesigner
      && taskGroup === 'cs'
      && task.status === 'rejected'
      && fileCategory === 'work';
    if (hasModificationReply && !isCsModificationSubmission) {
      throw new AppError(400, '当前任务不在修改提交状态');
    }
    let activeRejectRecordId = rejectRecordId;
    if (isRejectAttachment) {
      if (!activeRejectRecordId) throw new AppError(400, '缺少驳回记录ID');
      const [records] = await conn.execute(
        `SELECT id FROM task_reject_record WHERE id = ? AND task_id = ?`,
        [activeRejectRecordId, taskId]
      );
      if (!records.length) throw new AppError(400, '驳回记录不存在');
    } else if (isCsModificationSubmission) {
      const record = await taskDao.getLatestRejectRecordForUpdate(conn, taskId);
      if (!record) throw new AppError(400, '修改记录不存在');
      if (rejectRecordId && Number(record.id) !== rejectRecordId) {
        throw new AppError(409, '修改轮次已变化，请刷新后重试');
      }
      if (record.designer_complete_time) {
        throw new AppError(400, '本次修改已重新提交');
      }
      activeRejectRecordId = record.id;
    } else if (user.role === 'basic_designer' && task.status === 'rejected') {
      const [records] = await conn.execute(
        `SELECT id FROM task_reject_record WHERE task_id = ? ORDER BY reject_index DESC, id DESC LIMIT 1`,
        [taskId]
      );
      activeRejectRecordId = records[0]?.id || null;
    }

    if (isBasicRetainedSubmission && taskGroup === 'cs' && task.status === 'accepted') {
      const existingFiles = await taskDao.getInitialWorkFilesForUpdate(conn, taskId);
      const existingIds = new Set(existingFiles.map(file => Number(file.id)));
      if (retainedFileIds.some(id => !existingIds.has(id))) {
        throw new AppError(400, '保留的作品文件无效');
      }
      const removedFiles = existingFiles.filter(file => !retainedFileIds.includes(Number(file.id)));
      await taskDao.deleteFileRecords(conn, removedFiles.map(file => Number(file.id)));
      removedStoredPaths.push(...removedFiles.map(file => file.file_path).filter(Boolean));
    }

    let submitted = false;

    for (const file of files) {
      // 修复 Node.js HTTP 解析器将 UTF-8 文件名按 Latin-1 解析的编码问题
      file.originalname = fixFilenameEncoding(file.originalname);
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const ext = path.extname(file.originalname).toLowerCase();
      const fileType = IMAGE_EXTS.includes(ext) ? 'image' : 'attachment';
      let filePath;

      if (IMAGE_EXTS.includes(ext)) {
        const buffer = fs.readFileSync(file.path);
        filePath = saveImage(taskGroup, dateStr, path.basename(file.path), buffer);
        try { fs.unlinkSync(file.path); } catch (_) {}
      } else {
        filePath = saveAttachment(taskGroup, dateStr, path.basename(file.path), file.path);
        try { fs.unlinkSync(file.path); } catch (_) {}
      }

      await taskDao.insertFileRecord(conn, {
        taskId, fileName: file.originalname, filePath,
        fileSize: file.size, fileType,
        mimeType: file.mimetype || '', uploaderId: user.id, fileCategory,
        rejectRecordId: activeRejectRecordId
      });

      if (isRejectAttachment) {
        // 驳回附件只作为客服驳回记录附件保存，不触发任务状态变化。
      } else if (saveOnly && fileCategory !== 'reference' && (task.status === 'accepted' || task.status === 'rejected')) {
        const draftFields = {};
        if (hasWorkPathField) draftFields.work_path = workPath;
        if (actualQuantity > 0) draftFields.actual_quantity = actualQuantity;
        if (Object.keys(draftFields).length > 0) {
          await taskDao.updateTaskFields(conn, taskId, draftFields);
        }
      } else if (fileCategory !== 'reference' && (task.status === 'accepted' || task.status === 'rejected')) {
        const extraFields = { actual_quantity: actualQuantity, urge_time: null };
        if (user.role === 'basic_designer') {
          extraFields.applied_score = appliedScore > 0 ? appliedScore : 1;
          extraFields.score = taskGroup === 'cs' ? 1 : task.score;
          extraFields.score_review_status = '';
          extraFields.score_review_reason = '';
          extraFields.score_review_time = null;
          extraFields.score_review_score = 0;
        }
        if (hasWorkPathField) extraFields.work_path = workPath;
        await taskDao.updateTaskStatus(conn, taskId, 'doing', extraFields);
        submitted = true;
      } else if (hasWorkPathField && fileCategory !== 'reference') {
        // 再次上传时也更新路径
        await conn.execute(`UPDATE task_info SET work_path = ? WHERE id = ?`, [workPath, taskId]);
      }

      if (fileCategory !== 'reference' && !isRejectAttachment) {
        socketEmit(`user:${task.publisher_id}`);
        if (taskGroup === 'cs') socketEmit('group:cs');
      }
    }

    if (!submitted && isBasicRetainedSubmission && taskGroup === 'cs' && task.status === 'accepted') {
      const remainingFiles = await taskDao.getInitialWorkFilesForUpdate(conn, taskId);
      if (!remainingFiles.length) throw new AppError(400, '请至少保留或上传一个作品文件');
      await taskDao.updateTaskStatus(conn, taskId, 'doing', {
        actual_quantity: actualQuantity,
        applied_score: appliedScore > 0 ? appliedScore : 1,
        score: 1,
        score_review_status: '',
        score_review_reason: '',
        score_review_time: null,
        score_review_score: 0,
        urge_time: null
      });
      submitted = true;
      socketEmit(`user:${task.publisher_id}`);
      socketEmit('group:cs');
    }

    if (submitted) {
      if (isCsModificationSubmission) {
        const completed = await taskDao.completeRejectRecord(conn, {
          recordId: activeRejectRecordId,
          taskId,
          designerId: user.id,
          designerName: user.realName || user.username || '',
          reply: modificationReply,
          appliedScore: appliedScore > 0 ? appliedScore : 1
        });
        if (!completed) throw new AppError(409, '本次修改状态已变化，请刷新后重试');
      }
      const { notifyTaskEvent } = require('../utils/notification');
      await notifyTaskEvent('task_submit', { ...task, id: taskId }, user);
    }
  });

  for (const storedPath of removedStoredPaths) {
    try {
      const absolutePath = resolvePath(storedPath);
      if (absolutePath && fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
    } catch (_) {}
  }

  return { msg: saveOnly ? `已保存(${files.length}个文件)，请确认后提交` : `上传成功(${files.length}个文件)` };
}

async function uploadOriginalFiles(taskId, files, user) {
  if (!taskId) throw new AppError(400, '任务ID不能为空');
  files = files || [];
  if (!files.length) throw new AppError(400, '请选择原图文件');

  const storedPaths = [];
  try {
    await executeTransaction(async (conn) => {
      const task = await taskDao.getTaskForUpdate(conn, taskId);
      if (!task || task.task_group !== 'cs') throw new AppError(400, '仅客服基础美工任务支持上传原图');
      if (task.status !== 'pending_original') throw new AppError(400, '当前任务不在待上传原图状态');
      if (user.role !== 'basic_designer' || Number(task.designer_id) !== Number(user.id)) {
        throw new AppError(403, '无权为此任务上传原图');
      }

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      for (const file of files) {
        file.originalname = fixFilenameEncoding(file.originalname);
        const ext = path.extname(file.originalname).toLowerCase();
        const fileType = IMAGE_EXTS.includes(ext) ? 'image' : 'attachment';
        const filePath = fileType === 'image'
          ? saveImage('cs', dateStr, path.basename(file.path), fs.readFileSync(file.path))
          : saveAttachment('cs', dateStr, path.basename(file.path), file.path);
        storedPaths.push(filePath);
        await taskDao.insertFileRecord(conn, {
          taskId,
          fileName: file.originalname,
          filePath,
          fileSize: file.size,
          fileType,
          mimeType: file.mimetype || '',
          uploaderId: user.id,
          fileCategory: 'original',
          rejectRecordId: null
        });
        try { fs.unlinkSync(file.path); } catch (_) {}
      }
    });
  } catch (error) {
    for (const storedPath of storedPaths) {
      try {
        const absolutePath = resolvePath(storedPath);
        if (absolutePath && fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
      } catch (_) {}
    }
    for (const file of files) {
      try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
    }
    throw error;
  }

  const brief = await taskDao.getTaskBrief(taskId);
  if (brief) {
    socketEmit(`user:${brief.publisher_id}`);
    socketEmit('group:cs');
  }
  return { msg: `原图上传成功（${files.length}个文件）` };
}

async function completeOriginalUpload(taskId, user) {
  if (!taskId) throw new AppError(400, '任务ID不能为空');

  return withLock(`original-upload:${taskId}`, async () => {
    let taskBrief = null;
    await executeTransaction(async (conn) => {
      const task = await taskDao.getTaskForUpdate(conn, taskId);
      if (!task || task.task_group !== 'cs') throw new AppError(400, '仅客服基础美工任务支持完成原图上传');
      if (user.role !== 'basic_designer' || Number(task.designer_id) !== Number(user.id)) {
        throw new AppError(403, '无权完成此任务的原图上传');
      }
      if (task.status === 'finished') return;
      if (task.status !== 'pending_original') throw new AppError(400, '当前任务不能完成原图上传');

      const [files] = await conn.execute(
        `SELECT id FROM task_file WHERE task_id = ? AND file_category = 'original' LIMIT 1`,
        [taskId]
      );
      if (!files.length) throw new AppError(400, '请先上传至少一个原图文件');

      const finalScore = Number(task.applied_score) > 0 ? Number(task.applied_score) : 1;
      await taskDao.updateTaskStatus(conn, taskId, 'finished', {
        finish_time: new Date(),
        urge_time: null,
        score: 1,
        score_review_status: finalScore > 1 ? 'pending' : '',
        score_review_reason: '',
        score_review_time: null,
        score_review_score: 0
      });
      taskBrief = { ...task, id: taskId, status: 'finished' };
    });

    if (taskBrief) {
      await notifyTaskEvent('task_review_pass', taskBrief, user);
      socketEmit(`user:${taskBrief.publisher_id}`);
      socketEmit('group:cs');
    }
    return { msg: '原图上传已完成，任务已结束' };
  });
}

async function completeCsModification(taskId, recordId, reply, appliedScore, retainedFileIds, files, user) {
  if (!taskId || !recordId) throw new AppError(400, '任务或修改记录ID不能为空');
  const normalizedReply = String(reply || '').trim();
  const normalizedScore = Number(appliedScore);
  if (!Number.isFinite(normalizedScore) || normalizedScore < 1 || normalizedScore > 9999) {
    throw new AppError(400, '申请分数必须在1到9999之间');
  }
  const retainedIds = [...new Set((retainedFileIds || [])
    .map(Number)
    .filter(id => Number.isInteger(id) && id > 0))];
  files = files || [];

  return withLock(`review:${taskId}`, async () => {
    const storedPaths = [];
    const removedPaths = [];
    let taskBrief = null;
    try {
      await executeTransaction(async (conn) => {
        const task = await taskDao.getTaskForUpdate(conn, taskId);
        if (!task) throw new AppError(400, '任务不存在');
        if ((task.task_group || 'design') !== 'cs') {
          throw new AppError(400, '仅客服基础美工任务支持修改提交');
        }
        if (user.role !== 'basic_designer' || Number(task.designer_id) !== Number(user.id)) {
          throw new AppError(403, '无权处理此任务的修改');
        }
        if (task.status !== 'rejected') {
          throw new AppError(400, '当前任务不在修改处理状态');
        }

        const latestRecord = await taskDao.getLatestRejectRecordForUpdate(conn, taskId);
        if (!latestRecord || Number(latestRecord.id) !== Number(recordId)) {
          throw new AppError(409, '修改轮次已变化，请刷新后重试');
        }
        if (latestRecord.designer_complete_time) {
          throw new AppError(409, '本次修改已经完成');
        }

        const existingFiles = await taskDao.getRecordWorkFilesForUpdate(conn, taskId, recordId);
        const existingIds = new Set(existingFiles.map(file => Number(file.id)));
        if (retainedIds.some(id => !existingIds.has(id))) {
          throw new AppError(400, '保留的修改作品文件无效');
        }
        if (!normalizedReply && retainedIds.length === 0 && files.length === 0) {
          throw new AppError(400, '请填写处理结果或上传作品');
        }

        const removedFiles = existingFiles.filter(file => !retainedIds.includes(Number(file.id)));
        await taskDao.deleteFileRecords(conn, removedFiles.map(file => Number(file.id)));
        removedPaths.push(...removedFiles.map(file => file.file_path).filter(Boolean));

        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        for (const file of files) {
          file.originalname = fixFilenameEncoding(file.originalname);
          const ext = path.extname(file.originalname).toLowerCase();
          const fileType = IMAGE_EXTS.includes(ext) ? 'image' : 'attachment';
          let filePath;
          if (fileType === 'image') {
            filePath = saveImage('cs', dateStr, path.basename(file.path), fs.readFileSync(file.path));
          } else {
            filePath = saveAttachment('cs', dateStr, path.basename(file.path), file.path);
          }
          storedPaths.push(filePath);
          try { fs.unlinkSync(file.path); } catch (_) {}
          await taskDao.insertFileRecord(conn, {
            taskId,
            fileName: file.originalname,
            filePath,
            fileSize: file.size,
            fileType,
            mimeType: file.mimetype || '',
            uploaderId: user.id,
            fileCategory: 'work',
            rejectRecordId: recordId
          });
        }

        const completed = await taskDao.completeRejectRecord(conn, {
          recordId,
          taskId,
          designerId: user.id,
          designerName: user.realName || user.username || '',
          reply: normalizedReply,
          appliedScore: normalizedScore
        });
        if (!completed) throw new AppError(409, '本次修改状态已变化，请刷新后重试');

        await taskDao.updateTaskStatus(conn, taskId, 'doing', {
          applied_score: normalizedScore,
          score: 1,
          score_review_status: '',
          score_review_reason: '',
          score_review_time: null,
          score_review_score: 0,
          urge_time: null
        });
        taskBrief = { ...task, id: taskId };
      });
    } catch (error) {
      for (const storedPath of storedPaths) {
        try {
          const absolutePath = resolvePath(storedPath);
          if (absolutePath && fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
        } catch (_) {}
      }
      throw error;
    }

    for (const removedPath of removedPaths) {
      try {
        const absolutePath = resolvePath(removedPath);
        if (absolutePath && fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
      } catch (_) {}
    }
    if (taskBrief) {
      await notifyTaskEvent('task_submit', taskBrief, user);
      socketEmit(`user:${taskBrief.publisher_id}`);
      socketEmit('group:cs');
    }
    return { msg: '本次修改已完成' };
  });
}

async function requestCsModification(taskId, note, files, user) {
  if (!taskId) throw new AppError(400, '任务ID不能为空');
  await csHandoffService.assertCsActionAvailable(user, '新增修改');
  const normalizedNote = String(note || '').trim();
  if (!normalizedNote && (!files || files.length === 0)) {
    throw new AppError(400, '请填写修改说明或上传附件');
  }

  return withLock(`review:${taskId}`, async () => {
    let rejectRecord = null;
    const storedPaths = [];
    try {
      await executeTransaction(async (conn) => {
        const task = await taskDao.getTaskForUpdate(conn, taskId);
        if (!task) throw new AppError(400, '任务不存在');
        if ((task.task_group || 'design') !== 'cs') {
          throw new AppError(400, '仅客服基础美工任务支持新增修改');
        }
        if ((user.role === 'operator' || user.role === 'cs_agent') && Number(task.publisher_id) !== Number(user.id)) {
          throw new AppError(403, '无权修改他人发布的任务');
        }
        if (task.status !== 'doing') {
          throw new AppError(400, '当前任务不在待审核状态');
        }
        if (await taskDao.countIncompleteRejectRecords(conn, taskId)) {
          throw new AppError(409, '当前仍有待处理的修改，请刷新后重试');
        }

        rejectRecord = await taskDao.insertRejectRecord(conn, {
          taskId,
          reviewerId: user.id,
          reviewerName: user.realName || user.username || '',
          reason: normalizedNote,
          appliedScore: Number(task.applied_score) > 0 ? Number(task.applied_score) : 1
        });

        for (const file of files || []) {
          file.originalname = fixFilenameEncoding(file.originalname);
          const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
          const ext = path.extname(file.originalname).toLowerCase();
          const fileType = IMAGE_EXTS.includes(ext) ? 'image' : 'attachment';
          let filePath;
          if (fileType === 'image') {
            const buffer = fs.readFileSync(file.path);
            filePath = saveImage('cs', dateStr, path.basename(file.path), buffer);
          } else {
            filePath = saveAttachment('cs', dateStr, path.basename(file.path), file.path);
          }
          storedPaths.push(filePath);
          try { fs.unlinkSync(file.path); } catch (_) {}
          await taskDao.insertFileRecord(conn, {
            taskId,
            fileName: file.originalname,
            filePath,
            fileSize: file.size,
            fileType,
            mimeType: file.mimetype || '',
            uploaderId: user.id,
            fileCategory: 'reject',
            rejectRecordId: rejectRecord.id
          });
        }

        await taskDao.updateTaskStatus(conn, taskId, 'rejected', {
          reject_reason: normalizedNote,
          score: 1,
          score_review_status: '',
          score_review_reason: ''
        });
      });
    } catch (error) {
      for (const filePath of storedPaths) {
        try {
          const absolutePath = resolvePath(filePath);
          if (absolutePath && fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
        } catch (_) {}
      }
      throw error;
    }

    const brief = await taskDao.getTaskBrief(taskId);
    if (brief) {
      await notifyTaskEvent('task_review_reject', brief, user);
      if (brief.designer_id) socketEmit(`user:${brief.designer_id}`);
    }
    socketEmit('group:cs');
    logger.info('客服任务新增修改', {
      userId: user.id,
      taskId,
      modificationIndex: rejectRecord.rejectIndex
    });
    return {
      msg: '已新增修改',
      data: { rejectRecordId: rejectRecord.id, rejectIndex: rejectRecord.rejectIndex }
    };
  });
}

async function transferTask(taskId, newDesignerId, reason, user) {
  if (!taskId) throw new AppError(400, '任务ID不能为空');
  if (!newDesignerId) throw new AppError(400, '请选择接收人');
  const transferReason = String(reason || '').trim();
  if (!transferReason) throw new AppError(400, '请填写转移原因');

  let transferredTask = null;
  await executeTransaction(async (conn) => {
    const task = await taskDao.getTaskForUpdate(conn, taskId);
    if (!task) throw new AppError(400, '任务不存在');
    if (Number(task.designer_id) !== Number(user.id)) throw new AppError(403, '无权转移此任务');
    if (task.status === 'finished') throw new AppError(400, '已完成的任务不能转移');
    if (Number(newDesignerId) === Number(user.id)) throw new AppError(400, '不能转移给自己');

    const d = await taskDao.findDesigner(conn, newDesignerId, 'basic_designer');
    if (!d) throw new AppError(400, '接收人不存在或不可用');
    if (!(await isUserOnline(newDesignerId))) throw new AppError(400, '接收人当前不在线，不能转移');

    await taskDao.insertTransferRecord(conn, {
      taskId,
      fromDesignerId: task.designer_id,
      fromDesignerName: task.designer_name || '',
      toDesignerId: newDesignerId,
      toDesignerName: d.real_name || '',
      operatorId: user.id,
      operatorName: user.realName || user.username || '',
      reason: transferReason
    });

    await taskDao.updateTaskFields(conn, taskId, {
      designer_id: newDesignerId, designer_name: d.real_name
    });
    transferredTask = { ...task, id: taskId, designer_id: newDesignerId, designer_name: d.real_name };
  });

  if (transferredTask) await notifyTaskEvent('task_transfer', transferredTask, user);
  socketEmit(`user:${newDesignerId}`);
  return { msg: '任务转移成功' };
}

async function finishTask(taskId, actualQuantity, user) {
  if (!taskId) throw new AppError(400, '任务ID不能为空');
  const qty = parseInt(actualQuantity) || 0;

  await executeTransaction(async (conn) => {
    const task = await taskDao.getTaskForUpdate(conn, taskId);
    if (!task) throw new AppError(400, '任务不存在');
    if (Number(task.designer_id) !== Number(user.id)) throw new AppError(403, '无权操作此任务');
    if (task.status !== 'accepted' && task.status !== 'doing' && task.status !== 'rejected') {
      throw new AppError(400, '当前状态无法提交');
    }

      if (user.role === 'operator_assistant') {
      const [workFiles] = await conn.execute(
        `SELECT id FROM task_file WHERE task_id = ? AND file_category NOT IN ('reference', 'reject') LIMIT 1`,
        [taskId]
      );
      if (!workFiles.length && !qty) throw new AppError(400, '请上传完成凭证或填写完成次数');
    }

    await taskDao.updateTaskStatus(conn, taskId, 'doing', { actual_quantity: qty, urge_time: null });

    const { notifyTaskEvent } = require('../utils/notification');
    await notifyTaskEvent('task_submit', { ...task, id: taskId }, user);
  });

  const brief = await taskDao.getTaskBrief(taskId);
  if (brief) socketEmit(`user:${brief.publisher_id}`);

  logger.info('任务提交', { userId: user.id, taskId, actualQuantity: qty });

  return { msg: '作品已提交，等待运营审核' };
}

async function reviewTask(taskId, action, rejectReason, user) {
  if (!taskId || !action) throw new AppError(400, '参数不完整');
  if (!['pass', 'reject'].includes(action)) throw new AppError(400, '审核操作无效');
  await csHandoffService.assertCsActionAvailable(user, '审核任务');
  const normalizedRejectReason = String(rejectReason || '').trim();
  if (action === 'reject' && user.role === 'cs_agent' && !normalizedRejectReason) {
    throw new AppError(400, '请填写驳回原因');
  }

  return withLock(`review:${taskId}`, async () => {
    let rejectRecord = null;
    let alreadyFinished = false;
    let reviewedTaskGroup = '';
    await executeTransaction(async (conn) => {
      const task = await taskDao.getTaskForUpdate(conn, taskId);
      reviewedTaskGroup = task?.task_group || 'design';
      if (!task) throw new AppError(400, '任务不存在');

      // 业务权限：非管理员只能审核自己发布的任务
      if ((user.role === 'operator' || user.role === 'cs_agent') && Number(task.publisher_id) !== Number(user.id)) {
        throw new AppError(403, '无权审核他人发布的任务');
      }
      if (task.status === 'finished' && action === 'pass') {
        alreadyFinished = true;
        return;
      }
      if (task.status !== 'doing') {
        throw new AppError(400, '当前任务不在待审核状态');
      }
      if (task.task_group === 'cs' && action === 'reject') {
        throw new AppError(400, '客服基础美工任务请使用新增修改');
      }

      if (action === 'pass') {
        const extra = { finish_time: new Date(), urge_time: null };
        if (task.task_group === 'cs') {
          if (await taskDao.countIncompleteRejectRecords(conn, taskId)) {
            throw new AppError(400, '当前仍有待处理的修改，不能通过');
          }
          extra.finish_time = null;
          extra.score = 1;
          extra.score_review_status = '';
          extra.score_review_reason = '';
          extra.score_review_time = null;
          extra.score_review_score = 0;
        }
        await taskDao.updateTaskStatus(conn, taskId, task.task_group === 'cs' ? 'pending_original' : 'finished', extra);
      } else {
        const extra = { reject_reason: normalizedRejectReason };
        if (task.task_group === 'cs') {
          extra.score = 1;
          extra.score_review_status = '';
          extra.score_review_reason = '';
          rejectRecord = await taskDao.insertRejectRecord(conn, {
            taskId,
            reviewerId: user.id,
            reviewerName: user.realName || user.username || '',
            reason: normalizedRejectReason
          });
        }
        await taskDao.updateTaskStatus(conn, taskId, 'rejected', extra);
      }
    });

    if (alreadyFinished) return { msg: '任务已完成' };

    const { notifyTaskEvent } = require('../utils/notification');
    const brief = await taskDao.getTaskBrief(taskId);
    if (brief) {
      await notifyTaskEvent(action === 'pass' ? 'task_review_pass' : 'task_review_reject', brief, user);
      if (brief.designer_id) socketEmit(`user:${brief.designer_id}`);
    }

    logger.info(action === 'pass' ? '任务审核通过' : '任务驳回', {
      userId: user.id, taskId, action, rejectReason: normalizedRejectReason || null
    });

    const reviewResult = {
      msg: action === 'pass' ? '审核通过，任务已完成' : '已驳回',
      data: rejectRecord ? { rejectRecordId: rejectRecord.id, rejectIndex: rejectRecord.rejectIndex } : undefined
    };
    if (action === 'pass' && reviewedTaskGroup === 'cs') {
      reviewResult.msg = '审核通过，等待上传原图';
    }
    return reviewResult;
  });
}

async function batchReview(taskIds, user) {
  if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
    throw new AppError(400, '请选择任务');
  }
  await csHandoffService.assertCsActionAvailable(user, '批量审核任务');

  const count = await executeTransaction(async (conn) => {
    const placeholders = taskIds.map(() => '?').join(',');
    const [rows] = await conn.execute(
      `SELECT id, status, publisher_id, task_group, applied_score, score_review_status, score_review_score FROM task_info WHERE id IN (${placeholders})`, taskIds
    );
    if ((user.role === 'operator' || user.role === 'cs_agent') && rows.some(r => Number(r.publisher_id) !== Number(user.id))) {
      throw new AppError(403, '无权审核他人发布的任务');
    }
    const validIds = rows.filter(r => r.status === 'doing').map(r => r.id);
    if (validIds.length === 0) throw new AppError(400, '所选任务均不可审核');

    const csIds = rows
      .filter(row => row.status === 'doing' && row.task_group === 'cs')
      .map(row => Number(row.id));
    if (csIds.length) {
      const csPlaceholders = csIds.map(() => '?').join(',');
      const [pendingRounds] = await conn.execute(
        `SELECT DISTINCT task_id FROM task_reject_record
         WHERE task_id IN (${csPlaceholders}) AND designer_complete_time IS NULL`,
        csIds
      );
      if (pendingRounds.length) throw new AppError(400, '所选任务中存在待处理的修改，不能通过');
    }

    const vPlaceholders = validIds.map(() => '?').join(',');
    await conn.execute(
      `UPDATE task_info
       SET status = CASE WHEN task_group = 'cs' THEN 'pending_original' ELSE 'finished' END,
            score = CASE
              WHEN task_group = 'cs' THEN 1
              ELSE score
            END,
            score_review_status = CASE
              WHEN task_group = 'cs' THEN ''
             ELSE score_review_status
           END,
           score_review_reason = CASE WHEN task_group = 'cs' THEN '' ELSE score_review_reason END,
           score_review_time = CASE WHEN task_group = 'cs' THEN NULL ELSE score_review_time END,
           score_review_score = CASE WHEN task_group = 'cs' THEN 0 ELSE score_review_score END,
           finish_time = CASE WHEN task_group = 'cs' THEN NULL ELSE NOW() END,
           urge_time = NULL,
           update_time = NOW()
       WHERE id IN (${vPlaceholders})`,
      validIds
    );
    return validIds.length;
  });

  return { msg: `成功审核通过 ${count} 个任务`, data: { count } };
}

async function withdrawTask(taskId, user) {
  if (!taskId) throw new AppError(400, '任务ID不能为空');

  await executeTransaction(async (conn) => {
    const task = await taskDao.getTaskForUpdate(conn, taskId);
    if (!task) throw new AppError(400, '任务不存在');
    if (Number(task.publisher_id) !== Number(user.id)) throw new AppError(403, '无权撤回他人发布的任务');
    if (task.status !== 'wait' && task.status !== 'accepted') {
      throw new AppError(400, '仅待接单或已接单状态可撤回');
    }

    await taskDao.updateTaskFields(conn, taskId, {
      status: 'draft', designer_id: null, designer_name: null
    });

    if (task.designer_id) socketEmit(`user:${task.designer_id}`);
    socketEmit(`group:${task.task_group || 'design'}`);
  });

  return { msg: '任务已撤回，请编辑后重新发布' };
}

async function undoSubmit(taskId, user) {
  if (!taskId) throw new AppError(400, '任务ID不能为空');

  let reopenedModification = false;
  await executeTransaction(async (conn) => {
    const task = await taskDao.getTaskForUpdate(conn, taskId);
    if (!task) throw new AppError(400, '任务不存在');
    if (Number(task.designer_id) !== Number(user.id)) throw new AppError(403, '无权操作他人的任务');
    if (task.status !== 'doing') throw new AppError(400, '仅已提交待审核状态可撤回');

    const extra = {};
    let targetStatus = 'accepted';
    if (task.task_group === 'cs') {
      extra.score_review_status = '';
      extra.score_review_reason = '';
      extra.score_review_time = null;
      extra.score_review_score = 0;
      const latestRecord = await taskDao.getLatestRejectRecordForUpdate(conn, taskId);
      if (latestRecord?.designer_complete_time) {
        const reopened = await taskDao.reopenRejectRecord(conn, latestRecord.id, taskId);
        if (!reopened) throw new AppError(409, '修改轮次状态已变化，请刷新后重试');
        targetStatus = 'rejected';
        reopenedModification = true;
      }
    }
    await taskDao.updateTaskStatus(conn, taskId, targetStatus, extra);
    socketEmit(`user:${task.publisher_id}`);
  });

  return { msg: reopenedModification ? '已撤回，可继续修改本轮内容' : '已撤回提交，可重新上传' };
}

// ==================== 统计 ====================

const CN_MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const CN_MONTHS_SHORT = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function buildSelfMonthly(rawData) {
  const months = [];
  for (let m = 1; m <= 12; m++) {
    const row = rawData.find(r => Number(r.month) === m);
    months.push({
      month: m + '月',
      total: row ? Number(row.total) : 0,
      finished: row ? Number(row.finished) : 0,
      unfinished: row ? Number(row.unfinished) : 0,
      wait: row ? Number(row.wait) : 0
    });
  }
  return months;
}

function buildMonthlyTable(users, rawData) {
  return users.map(u => {
    const userRows = rawData.filter(r => Number(r.designer_id) === Number(u.id));
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const row = userRows.find(r => Number(r.month) === m);
      months.push({
        month: CN_MONTHS_SHORT[m - 1],
        published: row ? Number(row.published) : 0,
        finished: row ? Number(row.finished) : 0,
        unsubmitted: row ? Number(row.unsubmitted) : 0
      });
    }
    return { id: u.id, name: u.name, months };
  });
}

async function getMyStats(user) {
  const userId = user.id;
  const role = user.role;
  const attachBadges = async (stats) => ({
    ...(stats || {}),
    sidebar_badges: visibleSidebarBadges(
      user,
      stats || {},
      await taskDao.getSidebarBadgeStats(userId, role === 'admin' || role === 'sub_admin')
    )
  });

  if (role === 'operator' || role === 'cs_agent') {
    const base = await taskDao.getPublisherSummary(userId);
    let result = base;

    if (role === 'operator') {
      const thisYear = new Date().getFullYear();

      const [designStats, opStats, designers, assistants] = await Promise.all([
        taskDao.getGroupCardStats(userId, 'design'),
        taskDao.getGroupCardStats(userId, 'operator'),
        taskDao.getUsersByRole('designer'),
        taskDao.getUsersByRole('operator_assistant')
      ]);

      const [designMonthlyRaw, opMonthlyRaw] = await Promise.all([
        designers.length > 0 ? taskDao.getMonthlyRawData(userId, 'design', thisYear) : [],
        assistants.length > 0 ? taskDao.getMonthlyRawData(userId, 'operator', thisYear) : []
      ]);

      result = {
        ...base,
        design_stats: designStats,
        operator_stats: opStats,
        design_monthly: buildMonthlyTable(designers, designMonthlyRaw),
        operator_monthly: buildMonthlyTable(assistants, opMonthlyRaw)
      };
    } else if (role === 'cs_agent') {
      const thisYear = new Date().getFullYear();
      const csStats = await taskDao.getGroupCardStats(userId, 'cs');
      const basicDesigners = await taskDao.getUsersByRole('basic_designer');
      const csMonthlyRaw = basicDesigners.length > 0
        ? await taskDao.getMonthlyRawData(userId, 'cs', thisYear)
        : [];
      const selfMonthlyRaw = await taskDao.getPublisherMonthlyRaw(userId, 'cs', thisYear);

      result = {
        ...base,
        cs_stats: csStats,
        cs_monthly: buildMonthlyTable(basicDesigners, csMonthlyRaw),
        self_monthly: buildSelfMonthly(selfMonthlyRaw)
      };
    }
    return attachBadges(result);
  }

  // designer / basic_designer / operator_assistant
  const base = await taskDao.getDesignerSummary(userId);
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [detailRows, scoreItems, personalFileRows] = await Promise.all([
    taskDao.getDesignerDetailRows(userId),
    role === 'designer' ? taskDao.getScoreItems() : Promise.resolve([]),
    role === 'basic_designer'
      ? taskDao.getBasicDesignerFileStats({
        start: localDateTimeString(currentMonthStart),
        end: localDateTimeString(nextMonthStart),
        userId
      })
      : Promise.resolve([])
  ]);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const thisMonth = now.getMonth() + 1;
  const thisYear = now.getFullYear();

  let currentMonthScore = 0, todayScore = 0, yesterdayScore = 0;
  const monthlyMap = {};
  for (let m = 1; m <= 12; m++) {
    monthlyMap[m] = { month: CN_MONTHS[m - 1], score: 0, finished: 0, total: 0, rate: 0 };
  }

  for (const row of detailRows) {
    const ft = row.finish_time ? new Date(row.finish_time.replace(' ', 'T')) : null;
    const isValidFt = ft && !isNaN(ft.getTime());
    const actualQty = Number(row.actual_quantity) || 0;
    const scorePending = row.score_review_status === 'pending';
    const score = scorePending ? 0 : Math.round((Number(row.score) || 0) * (actualQty > 0 ? actualQty : 1) * 100) / 100;

    if (isValidFt && row.status === 'finished') {
      if (ft.getFullYear() === thisYear && ft.getMonth() + 1 === thisMonth) currentMonthScore += score;
      if (ft.getFullYear() === today.getFullYear() && ft.getMonth() === today.getMonth() && ft.getDate() === today.getDate()) todayScore += score;
      if (ft.getFullYear() === yesterday.getFullYear() && ft.getMonth() === yesterday.getMonth() && ft.getDate() === yesterday.getDate()) yesterdayScore += score;
    }

    const mt = row.finish_time || row.create_time;
    const mDate = mt ? new Date(mt.replace(' ', 'T')) : null;
    if (!mDate || isNaN(mDate.getTime()) || mDate.getFullYear() !== thisYear) continue;

    const m = mDate.getMonth() + 1;
    monthlyMap[m].total += 1;
    if (row.status === 'finished') {
      monthlyMap[m].score += score;
      monthlyMap[m].finished += 1;
    }
  }

  const finished = Number(base.finished_count) || 0;
  const total = Number(base.total) || 1;
  const currentMonthEffectImages = personalFileRows.filter(row => row.file_category === 'work').length;
  const currentMonthOriginalImages = personalFileRows.filter(row => row.file_category === 'original').length;

  return attachBadges({
    ...base,
    current_month_score: Math.round(currentMonthScore * 100) / 100,
    today_score: Math.round(todayScore * 100) / 100,
    yesterday_score: Math.round(yesterdayScore * 100) / 100,
    completion_rate: Math.round(finished / total * 1000) / 10,
    monthly_stats: Object.values(monthlyMap).map(item => ({
      ...item,
      score: Math.round(item.score * 100) / 100,
      rate: item.total > 0 ? Math.round(item.finished / item.total * 1000) / 10 : null
    })),
    ...(role === 'designer' ? {
      project_stats: buildProjectCompletionStats(
        detailRows.filter(task => task.task_group === 'design' || !task.task_group),
        scoreItems.filter(item => item.source === 'design'),
        now
      )
    } : {}),
    ...(role === 'basic_designer' ? {
      current_month_effect_images: currentMonthEffectImages,
      current_month_original_images: currentMonthOriginalImages
    } : {})
  });
}

function buildProjectCompletionStats(tasks, scoreItems, refDate = new Date()) {
  const currentStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const nextStart = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1);
  const lastStart = new Date(refDate.getFullYear(), refDate.getMonth() - 1, 1);
  const year = refDate.getFullYear();
  const rows = new Map((scoreItems || []).map(item => [Number(item.id), {
    project_name: item.name,
    count: 0,
    current_month_count: 0,
    last_month_count: 0,
    monthly_counts: Array.from({ length: 12 }, (_, index) => ({ month: index + 1, count: 0 }))
  }]));

  for (const task of tasks || []) {
    if (task.status !== 'finished') continue;
    const row = rows.get(Number(task.score_item_id));
    if (!row) continue;
    row.count += 1;

    const finishedAt = parseDateTime(task.finish_time);
    if (!finishedAt) continue;
    if (finishedAt >= currentStart && finishedAt < nextStart) row.current_month_count += 1;
    if (finishedAt >= lastStart && finishedAt < currentStart) row.last_month_count += 1;
    if (finishedAt.getFullYear() === year) row.monthly_counts[finishedAt.getMonth()].count += 1;
  }

  return [...rows.values()];
}

function buildDesignerStats(users, tasks, scoreItems, refDate, taskGroup) {
  const now = refDate || new Date();
  const thisYear = now.getFullYear();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  const source = taskGroup === 'cs' ? 'cs' : taskGroup === 'operator' ? 'operator' : 'design';
  const relevantItems = scoreItems.filter(si => si.source === source);

  return users.map(d => {
    // 兼容历史数据：task_group 为 NULL 的任务归属 design 分组
    const userTasks = tasks.filter(t => {
      if (Number(t.designer_id) !== Number(d.id)) return false;
      if (t.task_group === taskGroup) return true;
      if (taskGroup === 'design' && !t.task_group) return true;
      return false;
    });
    const finishedTasks = userTasks.filter(t => t.status === 'finished');

    let totalScore = 0, currentMonthScore = 0, todayScore = 0, yesterdayScore = 0;

    const monthlyMap = {};
    for (let m = 1; m <= 12; m++) {
      monthlyMap[m] = { month: CN_MONTHS_SHORT[m - 1], score: 0, finished: 0, total: 0 };
    }

    for (const task of userTasks) {
      const actualQty = Number(task.actual_quantity) || 0;
      const scorePending = task.score_review_status === 'pending';
      const score = scorePending ? 0 : Math.round((Number(task.score) || 0) * (actualQty > 0 ? actualQty : 1) * 100) / 100;
      // 已完成积分按审核通过时间统计；finish_time 在审核通过时写入。
      const timeStr = task.finish_time;
      const ft = timeStr ? new Date(timeStr.replace(' ', 'T')) : null;
      const isValidFt = ft && !isNaN(ft.getTime());

      if (task.status === 'finished') {
        totalScore += score;
        if (isValidFt) {
          if (ft.getFullYear() === thisYear && ft.getMonth() + 1 === now.getMonth() + 1) currentMonthScore += score;
          if (ft.getFullYear() === today.getFullYear() && ft.getMonth() === today.getMonth() && ft.getDate() === today.getDate()) todayScore += score;
          if (ft.getFullYear() === yesterday.getFullYear() && ft.getMonth() === yesterday.getMonth() && ft.getDate() === yesterday.getDate()) yesterdayScore += score;
        }
      }

      // 月度明细表同样按审核通过时间，与卡片统计保持一致。
      const mt = task.finish_time;
      const mDate = mt ? new Date(mt.replace(' ', 'T')) : null;
      if (mDate && !isNaN(mDate.getTime()) && mDate.getFullYear() === thisYear) {
        const m = mDate.getMonth() + 1;
        monthlyMap[m].total += 1;
        if (task.status === 'finished') {
          monthlyMap[m].score += score;
          monthlyMap[m].finished += 1;
        }
      }

    }

    const total = userTasks.length || 1;
    const finished = finishedTasks.length;

    return {
      id: d.id, name: d.name || d.username,
      total_score: Math.round(totalScore * 100) / 100,
      current_month_score: Math.round(currentMonthScore * 100) / 100,
      today_score: Math.round(todayScore * 100) / 100,
      yesterday_score: Math.round(yesterdayScore * 100) / 100,
      finished_count: finished,
      total_count: userTasks.length,
      completion_rate: Math.round(finished / total * 1000) / 10,
      monthly_stats: Object.values(monthlyMap).map(m => ({
        ...m,
        score: Math.round(m.score * 100) / 100,
        rate: m.total > 0 ? Math.round(m.finished / m.total * 1000) / 10 : null
      })),
      project_stats: buildProjectCompletionStats(userTasks, relevantItems, now)
    };
  });
}

function parseDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const date = new Date(String(value).replace(' ', 'T'));
  return date && !isNaN(date.getTime()) ? date : null;
}

function localDateTimeString(date) {
  const value = date instanceof Date ? date : new Date(date);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  const h = String(value.getHours()).padStart(2, '0');
  const min = String(value.getMinutes()).padStart(2, '0');
  const s = String(value.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
}

function aggregateBasicDesignerImageStats(rows, users, start, end) {
  const result = new Map((users || []).map(user => [Number(user.id), {
    id: user.id,
    name: user.name || user.username,
    effect_count: 0,
    original_count: 0
  }]));

  for (const row of rows || []) {
    const uploadedAt = parseDateTime(row.create_time);
    const userId = Number(row.uploader_id);
    if (!uploadedAt || uploadedAt < start || uploadedAt >= end || !result.has(userId)) continue;
    const target = result.get(userId);
    if (row.file_category === 'work') target.effect_count += 1;
    if (row.file_category === 'original') target.original_count += 1;
  }
  return [...result.values()];
}

function buildBasicDesignerImageDailyStats(rows, users, refDate = new Date()) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const dayCount = new Date(year, month + 1, 0).getDate();
  const result = new Map((users || []).map(user => [Number(user.id), {
    id: user.id,
    user_id: user.id,
    name: user.name || user.username,
    daily_stats: Array.from({ length: dayCount }, (_, index) => ({
      day: index + 1,
      effect_count: 0,
      original_count: 0
    }))
  }]));

  for (const row of rows || []) {
    const uploadedAt = parseDateTime(row.create_time);
    const userId = Number(row.uploader_id);
    if (!uploadedAt || uploadedAt.getFullYear() !== year || uploadedAt.getMonth() !== month || !result.has(userId)) continue;
    const target = result.get(userId).daily_stats[uploadedAt.getDate() - 1];
    if (row.file_category === 'work') target.effect_count += 1;
    if (row.file_category === 'original') target.original_count += 1;
  }
  return [...result.values()];
}

function buildPublisherMonthlyStats(tasks, refYear) {
  const thisYear = refYear || new Date().getFullYear();
  const publisherMap = new Map();

  for (const task of tasks || []) {
    const publisherId = Number(task.publisher_id);
    if (!publisherId) continue;
    if (!publisherMap.has(publisherId)) {
      publisherMap.set(publisherId, {
        id: publisherId,
        name: task.publisher_name || task.publisher_username || '未知发布人',
        username: task.publisher_username || '',
        role: task.publisher_role || '',
        tasks: []
      });
    }
    publisherMap.get(publisherId).tasks.push(task);
  }

  return [...publisherMap.values()].map(p => {
    const publisherTasks = p.tasks;
    const monthlyMap = {};
    for (let m = 1; m <= 12; m++) {
      monthlyMap[m] = { month: CN_MONTHS_SHORT[m - 1], count: 0 };
    }
    for (const task of publisherTasks) {
      const ct = parseDateTime(task.create_time);
      if (ct && ct.getFullYear() === thisYear) {
        monthlyMap[ct.getMonth() + 1].count += 1;
      }
    }
    const { tasks: _tasks, ...publisher } = p;
    return { ...publisher, publish_count: publisherTasks.length, monthly_stats: Object.values(monthlyMap) };
  }).sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN'));
}

function buildDailyScoreStats(users, tasks, refDate, taskGroup) {
  const now = refDate || new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const dayCount = new Date(year, month + 1, 0).getDate();

  function emptyDays() {
    const days = [];
    for (let day = 1; day <= dayCount; day++) {
      days.push({ day, finished_score: 0, pending_review_score: 0 });
    }
    return days;
  }

  function scoreOf(task, zeroWhenReviewPending = false) {
    if (zeroWhenReviewPending && task.score_review_status === 'pending') return 0;
    const actualQty = Number(task.actual_quantity) || 0;
    return Math.round((Number(task.score) || 0) * (actualQty > 0 ? actualQty : 1) * 100) / 100;
  }

  function parseTaskDate(task) {
    const timeStr = task.status === 'finished' ? task.finish_time : task.submit_time;
    const date = timeStr ? new Date(timeStr.replace(' ', 'T')) : null;
    return date && !isNaN(date.getTime()) ? date : null;
  }

  return users.map(user => {
    const dailyStats = emptyDays();
    const userTasks = tasks.filter(task => {
      if (Number(task.designer_id) !== Number(user.id)) return false;
      if (task.task_group === taskGroup) return true;
      if (taskGroup === 'design' && !task.task_group) return true;
      return false;
    });

    for (const task of userTasks) {
      if (task.status !== 'finished' && task.status !== 'doing') continue;
      const date = parseTaskDate(task);
      if (!date || date.getFullYear() !== year || date.getMonth() !== month) continue;

      const item = dailyStats[date.getDate() - 1];
      if (task.status === 'finished') {
        item.finished_score += scoreOf(task, true);
      } else if (task.status === 'doing') {
        item.pending_review_score += scoreOf(task);
      }
    }

    return {
      id: user.id,
      user_id: user.id,
      name: user.name || user.username,
      daily_stats: dailyStats.map(item => ({
        day: item.day,
        finished_score: Math.round(item.finished_score * 100) / 100,
        pending_review_score: Math.round(item.pending_review_score * 100) / 100
      }))
    };
  });
}

async function getDashboardStats(user = null) {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  function toDateStr(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const lastMonthStr = toDateStr(lastMonthStart);
  const thisMonthStr = toDateStr(thisMonthStart);
  const nextMonthStr = toDateStr(nextMonthStart);

  const groupStats = await taskDao.getGroupStats();
  const emptyStats = { total: 0, wait_count: 0, accepted_count: 0, doing_count: 0, finished_count: 0, rejected_count: 0 };
  const designStats = groupStats.find(r => r.task_group === 'design') || { task_group: 'design', ...emptyStats };
  const csStats = groupStats.find(r => r.task_group === 'cs') || { task_group: 'cs', ...emptyStats };
  const operatorStats = groupStats.find(r => r.task_group === 'operator') || { task_group: 'operator', ...emptyStats };
  // 将 task_group 为 NULL 的旧任务合并到 design 分区（历史数据兼容）
  const nullGroup = groupStats.find(r => !r.task_group);
  if (nullGroup) {
    for (const key of Object.keys(emptyStats)) {
      designStats[key] = (designStats[key] || 0) + (nullGroup[key] || 0);
    }
  }

  const [designerScores, basicDesignerScores, operatorAssistantScores, designerRank, csAgentRank, operatorPublisherRank] = await Promise.all([
    taskDao.getFinishedDesignerScores('designer'),
    taskDao.getFinishedDesignerScores('basic_designer'),
    taskDao.getFinishedDesignerScores('operator_assistant'),
    taskDao.getDesignerRank('designer'),
    taskDao.getPublisherRank('cs_agent'),
    taskDao.getPublisherRank('operator')
  ]);

  function buildRank(scores, key, startStr, endStr, limit = 10) {
    const map = {};
    for (const r of scores) {
      const ft = (r.finish_time || '').toString();
      if (ft >= startStr && ft < endStr) {
        const actualQty = Number(r.actual_quantity) || 0;
        const score = Math.round((Number(r.score) || 0) * (actualQty > 0 ? actualQty : 1) * 100) / 100;
        if (!map[r.id]) map[r.id] = { id: r.id, name: r.name, [key]: 0 };
        map[r.id][key] += score;
      }
    }
    return Object.values(map)
      .map(v => { v[key] = Math.round(v[key] * 100) / 100; return v; })
      .sort((a, b) => b[key] - a[key]).slice(0, limit);
  }

  const data = {
    designStats, csStats, operatorStats,
    designerLastMonthRank: buildRank(designerScores, 'last_month_score', lastMonthStr, thisMonthStr),
    designerCurrentMonthRank: buildRank(designerScores, 'current_month_score', thisMonthStr, nextMonthStr),
    basicDesignerLastMonthRank: buildRank(basicDesignerScores, 'last_month_score', lastMonthStr, thisMonthStr),
    basicDesignerCurrentMonthRank: buildRank(basicDesignerScores, 'current_month_score', thisMonthStr, nextMonthStr),
    operatorAssistantLastMonthRank: buildRank(operatorAssistantScores, 'last_month_score', lastMonthStr, thisMonthStr),
    operatorAssistantCurrentMonthRank: buildRank(operatorAssistantScores, 'current_month_score', thisMonthStr, nextMonthStr),
    designerRank, csAgentRank, operatorPublisherRank
  };
  return user ? filterDashboardStatsByPermission(data, user) : data;
}

async function getAdminDetailStats(user = null) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [designers, basicDesigners, operatorAssistants, scoreItems, allTasks, basicDesignerFileRows] = await Promise.all([
    taskDao.getUsersByRoleWithUsername('designer'),
    taskDao.getUsersByRoleWithUsername('basic_designer'),
    taskDao.getUsersByRoleWithUsername('operator_assistant'),
    taskDao.getScoreItems(),
    taskDao.getAllTasksForStats(),
    taskDao.getBasicDesignerFileStats({
      start: localDateTimeString(lastMonthStart),
      end: localDateTimeString(nextMonthStart)
    })
  ]);

  // 兼容历史数据：task_group 为 NULL 的任务归属 design 分组
  const designTasks = allTasks.filter(t => t.task_group === 'design' || !t.task_group)
  const operatorTasks = allTasks.filter(t => t.task_group === 'operator')
  const csTasks = allTasks.filter(t => t.task_group === 'cs')
  const data = {
    designerStats: buildDesignerStats(designers, allTasks, scoreItems, now, 'design'),
    basicDesignerStats: buildDesignerStats(basicDesigners, allTasks, scoreItems, now, 'cs'),
    operatorAssistantStats: buildDesignerStats(operatorAssistants, allTasks, scoreItems, now, 'operator'),
    designerDailyStats: buildDailyScoreStats(designers, allTasks, now, 'design'),
    basicDesignerDailyStats: buildDailyScoreStats(basicDesigners, allTasks, now, 'cs'),
    basicDesignerImageMonthlyStats: {
      current: aggregateBasicDesignerImageStats(basicDesignerFileRows, basicDesigners, thisMonthStart, nextMonthStart),
      last: aggregateBasicDesignerImageStats(basicDesignerFileRows, basicDesigners, lastMonthStart, thisMonthStart)
    },
    basicDesignerImageDailyStats: buildBasicDesignerImageDailyStats(basicDesignerFileRows, basicDesigners, now),
    operatorAssistantDailyStats: buildDailyScoreStats(operatorAssistants, allTasks, now, 'operator'),
    operatorStats: buildPublisherMonthlyStats(designTasks, thisYear),
    operatorPublishStats: buildPublisherMonthlyStats(operatorTasks, thisYear),
    csAgentStats: buildPublisherMonthlyStats(csTasks, thisYear),
    scoreItems: scoreItems.map(si => si.name)
  };
  return user ? filterAdminDetailStatsByPermission(data, user) : data;
}

module.exports = {
  createTask, publishTask, snapshotMaterialImages, assertTaskViewAccess, getTaskFileForUser, getTaskDetail, deleteTask, updateTask, reopenFinishedCsTask, updateCsTaskNo, batchDelete, batchReassign,
  getMyPublished, getMyAccepted, getTaskHall, getAllTasks, getAllTasksForUser, searchTasks,
  acceptTask, uploadFiles, uploadOriginalFiles, completeOriginalUpload, completeCsModification, transferTask, finishTask, reviewTask, requestCsModification, batchReview,
  withdrawTask, undoSubmit,
  getMyStats, getDashboardStats, getAdminDetailStats
};
