/**
 * 任务模块共享工具函数
 */

const { getPool } = require('../../config/database');

const MIME_MAP = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp'
};

/**
 * 生成任务编号 T + 年月日 + 4位序号
 * 使用 MAX 避免因删除任务导致的序号重复，并发冲突时重试
 */
async function generateTaskNo(pool, _retry = 0) {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `T${dateStr}`;

  const [rows] = await pool.execute(
    `SELECT MAX(task_no) as max_no FROM task_info WHERE task_no LIKE ?`,
    [`${prefix}%`]
  );

  const maxNo = rows[0].max_no;
  const lastSeq = maxNo ? parseInt(maxNo.slice(-4)) : 0;
  const seq = String(lastSeq + 1).padStart(4, '0');
  return `${prefix}${seq}`;
}

/**
 * 为任务列表挂载关联文件
 * @returns {Object} taskId → files[]
 */
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

module.exports = { MIME_MAP, generateTaskNo, attachFilesToTasks };
