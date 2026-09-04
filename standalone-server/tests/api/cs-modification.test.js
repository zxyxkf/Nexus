const { setupApp } = require('./helpers/setup');

let execute;
let taskDao;
let taskId;

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  await setupApp();
  ({ execute } = require('../../config/database'));
  taskDao = require('../../dao/task.dao');
});

test('customer service modification records include a basic designer reply field', async () => {
  const [columns] = await execute('PRAGMA table_info(task_reject_record)');
  expect(columns.map(column => column.name)).toContain('designer_reply');
});

test('modification records increment and update the matching reply only', async () => {
  const [created] = await execute(
    `INSERT INTO task_info (task_no, title, status, task_group)
     VALUES (?, '修改记录测试', 'rejected', 'cs')`,
    [`CS-MOD-SCHEMA-${Date.now()}`]
  );
  taskId = Number(created.insertId);
  const conn = { execute };
  const first = await taskDao.insertRejectRecord(conn, {
    taskId,
    reviewerId: 1,
    reviewerName: '客服甲',
    reason: '第一次修改'
  });
  const second = await taskDao.insertRejectRecord(conn, {
    taskId,
    reviewerId: 1,
    reviewerName: '客服甲',
    reason: '第二次修改'
  });

  expect([first.rejectIndex, second.rejectIndex]).toEqual([1, 2]);
  await taskDao.updateRejectRecordReply(conn, second.id, taskId, '基础美工已修改');
  const records = await taskDao.getTaskRejectRecords(taskId);
  expect(records.map(record => record.designer_reply)).toEqual(['', '基础美工已修改']);
});

afterAll(async () => {
  if (!execute || !taskId) return;
  await execute('DELETE FROM task_reject_record WHERE task_id = ?', [taskId]);
  await execute('DELETE FROM task_info WHERE id = ?', [taskId]);
});
