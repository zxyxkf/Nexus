const path = require('path');
const { execute } = require('../config/database');
const AppError = require('../utils/AppError');

const ELIGIBLE_STATUSES = new Set(['accepted', 'rejected']);

function eligibleTasksForUser(tasks, userId) {
  return (tasks || []).filter(task =>
    Number(task.designer_id) === Number(userId) &&
    task.task_group === 'cs' &&
    ELIGIBLE_STATUSES.has(task.status)
  );
}

function publicFileDescriptor(file) {
  return {
    clientId: String(file?.clientId || ''),
    name: String(file?.name || ''),
    size: Number(file?.size) || 0,
    type: String(file?.type || '')
  };
}

function unresolvedFile(file, reason) {
  return { ...publicFileDescriptor(file), reason };
}

function publicTask(task) {
  return {
    taskId: Number(task.id),
    taskNo: task.task_no,
    title: task.title || '',
    wangwangId: task.wangwang_id || '',
    status: task.status
  };
}

function resolveBatchFiles(files, candidateTasks) {
  const tasks = (candidateTasks || []).filter(task =>
    task?.task_group === 'cs' && ELIGIBLE_STATUSES.has(task.status)
  );
  const groupsByTaskId = new Map();
  const unresolved = [];

  for (const input of files || []) {
    const file = publicFileDescriptor(input);
    if (!file.clientId || !file.name) {
      unresolved.push(unresolvedFile(file, 'invalid_descriptor'));
      continue;
    }
    if (!file.type.startsWith('image/')) {
      unresolved.push(unresolvedFile(file, 'invalid_type'));
      continue;
    }

    const searchableName = path.basename(file.name).toLocaleLowerCase();
    const taskNoMatches = tasks.filter(task => {
      const taskNo = String(task.task_no || '').trim().toLocaleLowerCase();
      return taskNo && searchableName.includes(taskNo);
    });

    let matchedTask = null;
    let matchedBy = '';
    if (taskNoMatches.length > 1) {
      unresolved.push(unresolvedFile(file, 'multiple_task_numbers'));
      continue;
    }
    if (taskNoMatches.length === 1) {
      matchedTask = taskNoMatches[0];
      matchedBy = 'task_no';
    } else {
      const wangwangMatches = tasks.filter(task => {
        const wangwangId = String(task.wangwang_id || '').trim().toLocaleLowerCase();
        return wangwangId && searchableName.includes(wangwangId);
      });
      if (wangwangMatches.length > 1) {
        unresolved.push(unresolvedFile(file, 'duplicate_wangwang'));
        continue;
      }
      if (wangwangMatches.length === 1) {
        matchedTask = wangwangMatches[0];
        matchedBy = 'wangwang_id';
      }
    }

    if (!matchedTask) {
      unresolved.push(unresolvedFile(file, 'not_found'));
      continue;
    }

    const taskId = Number(matchedTask.id);
    if (!groupsByTaskId.has(taskId)) {
      groupsByTaskId.set(taskId, { ...publicTask(matchedTask), files: [] });
    }
    groupsByTaskId.get(taskId).files.push({ ...file, matchedBy });
  }

  return { groups: [...groupsByTaskId.values()], unresolved };
}

async function resolveBatchSubmission(files, user) {
  if (user?.role !== 'basic_designer') throw new AppError(403, '仅基础美工支持批量提交');
  if (!Array.isArray(files) || files.length === 0) throw new AppError(400, '请选择图片');
  if (files.length > 500) throw new AppError(400, '单次最多匹配500个文件');

  const [tasks] = await execute(
    `SELECT id, task_no, title, wangwang_id, status, task_group, designer_id
     FROM task_info
     WHERE designer_id = ? AND task_group = 'cs' AND status IN ('accepted', 'rejected')
     ORDER BY id ASC`,
    [user.id]
  );
  return resolveBatchFiles(files, eligibleTasksForUser(tasks, user.id));
}

module.exports = {
  eligibleTasksForUser,
  resolveBatchFiles,
  resolveBatchSubmission
};
