const path = require('path');
const { execute } = require('../config/database');
const AppError = require('../utils/AppError');

const ELIGIBLE_STATUSES = new Set(['accepted', 'rejected']);

function isEligibleSubmissionTask(task) {
  if (!task || !ELIGIBLE_STATUSES.has(task.status)) return false;
  if (task.status === 'accepted') return true;
  return Number(task.reject_record_id) > 0 && !task.designer_complete_time;
}

function eligibleTasksForUser(tasks, userId) {
  return (tasks || []).filter(task =>
    Number(task.designer_id) === Number(userId) &&
    task.task_group === 'cs' &&
    isEligibleSubmissionTask(task)
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
  const isModification = task.status === 'rejected';
  const sourceScore = isModification && Number(task.modification_applied_score) > 0
    ? Number(task.modification_applied_score)
    : Number(task.applied_score);
  return {
    taskId: Number(task.id),
    taskNo: task.task_no,
    title: task.title || '',
    wangwangId: task.wangwang_id || '',
    publisherName: task.publisher_name || '',
    status: task.status,
    submissionType: isModification ? 'modification' : 'initial',
    rejectRecordId: isModification ? Number(task.reject_record_id) : null,
    rejectIndex: isModification ? Number(task.reject_index) : null,
    appliedScore: Number.isFinite(sourceScore) && sourceScore >= 1 ? sourceScore : 1
  };
}

function resolveBatchFiles(files, candidateTasks) {
  const tasks = (candidateTasks || []).filter(task =>
    task?.task_group === 'cs' && isEligibleSubmissionTask(task)
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
    `SELECT t.id, t.task_no, t.title, t.wangwang_id, t.publisher_name,
            t.status, t.task_group, t.designer_id, t.applied_score,
            rr.id AS reject_record_id, rr.reject_index,
            rr.applied_score AS modification_applied_score,
            rr.designer_complete_time
     FROM task_info t
     LEFT JOIN task_reject_record rr ON rr.id = (
       SELECT latest.id
       FROM task_reject_record latest
       WHERE latest.task_id = t.id
       ORDER BY latest.reject_index DESC, latest.id DESC
       LIMIT 1
     )
     WHERE t.designer_id = ? AND t.task_group = 'cs'
       AND (
         t.status = 'accepted'
         OR (t.status = 'rejected' AND rr.id IS NOT NULL AND rr.designer_complete_time IS NULL)
       )
     ORDER BY t.id ASC`,
    [user.id]
  );
  return resolveBatchFiles(files, eligibleTasksForUser(tasks, user.id));
}

module.exports = {
  eligibleTasksForUser,
  resolveBatchFiles,
  resolveBatchSubmission
};
