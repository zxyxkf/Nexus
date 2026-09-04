const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let execute;
let taskDao;
let taskId;

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  app = await setupApp();
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

describe('customer service modification workflow', () => {
  const suffix = Date.now();
  const taskPrefix = `CS-MOD-${suffix}`;
  const users = {
    publisher: `cs_mod_publisher_${suffix}`,
    other: `cs_mod_other_${suffix}`,
    basic: `cs_mod_basic_${suffix}`
  };
  let adminToken;
  let publisherToken;
  let otherToken;
  let basicToken;
  let publisherId;
  let otherId;
  let basicId;
  let sequence = 0;

  async function createUser(username, realName, role) {
    const create = await request(app)
      .post('/api/user/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username, password: 'test123456', realName, role });
    expect(create.body.code).toBe(0);
    const list = await request(app)
      .get(`/api/user/list?role=${role}&pageSize=100`)
      .set('Authorization', `Bearer ${adminToken}`);
    return Number(list.body.data.list.find(user => user.username === username).id);
  }

  async function login(username) {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'test123456' });
    expect(response.body.code).toBe(0);
    return response.body.data.token;
  }

  async function createTask({ taskGroup = 'cs', status = 'doing' } = {}) {
    sequence += 1;
    const taskNo = `${taskPrefix}-${sequence}`;
    const [result] = await execute(
      `INSERT INTO task_info
         (task_no, title, status, publisher_id, publisher_name,
          designer_id, designer_name, task_group, applied_score)
       VALUES (?, ?, ?, ?, '客服甲', ?, '基础美工甲', ?, 2.5)`,
      [taskNo, `${taskNo} task`, status, publisherId, basicId, taskGroup]
    );
    return Number(result.insertId);
  }

  async function detail(id) {
    return request(app)
      .get(`/api/task/detail?taskId=${id}`)
      .set('Authorization', `Bearer ${adminToken}`);
  }

  beforeAll(async () => {
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    adminToken = adminLogin.body.data.token;
    publisherId = await createUser(users.publisher, '客服甲', 'cs_agent');
    otherId = await createUser(users.other, '客服乙', 'cs_agent');
    basicId = await createUser(users.basic, '基础美工甲', 'basic_designer');
    publisherToken = await login(users.publisher);
    otherToken = await login(users.other);
    basicToken = await login(users.basic);
  });

  beforeEach(async () => {
    await execute(
      'DELETE FROM task_file WHERE task_id IN (SELECT id FROM task_info WHERE task_no LIKE ?)',
      [`${taskPrefix}%`]
    );
    await execute(
      'DELETE FROM task_reject_record WHERE task_id IN (SELECT id FROM task_info WHERE task_no LIKE ?)',
      [`${taskPrefix}%`]
    );
    await execute('DELETE FROM task_info WHERE task_no LIKE ?', [`${taskPrefix}%`]);
  });

  test('publisher can request a modification with text and cannot repeat it', async () => {
    const id = await createTask();
    const response = await request(app)
      .post('/api/task/request-modification')
      .set('Authorization', `Bearer ${publisherToken}`)
      .field('taskId', String(id))
      .field('note', '请调整图片文字');

    expect(response.body.code).toBe(0);
    const task = (await detail(id)).body.data;
    expect(task.status).toBe('rejected');
    expect(task.reject_records).toHaveLength(1);
    expect(task.reject_records[0]).toMatchObject({
      reject_index: 1,
      reject_reason: '请调整图片文字',
      designer_reply: ''
    });

    const repeated = await request(app)
      .post('/api/task/request-modification')
      .set('Authorization', `Bearer ${publisherToken}`)
      .field('taskId', String(id))
      .field('note', '重复发起');
    expect(repeated.body.code).toBe(400);
    expect((await detail(id)).body.data.reject_records).toHaveLength(1);
  });

  test('publisher can request a modification with attachments only', async () => {
    const id = await createTask();
    const response = await request(app)
      .post('/api/task/request-modification')
      .set('Authorization', `Bearer ${publisherToken}`)
      .field('taskId', String(id))
      .field('note', '')
      .attach('files', Buffer.from('customer service note'), '修改参考.txt');

    expect(response.body.code).toBe(0);
    const task = (await detail(id)).body.data;
    expect(task.reject_records).toHaveLength(1);
    expect(task.reject_records[0].files).toEqual([
      expect.objectContaining({ file_name: '修改参考.txt', file_category: 'reject' })
    ]);
  });

  test('empty, non-customer-service and foreign modification requests are rejected', async () => {
    const emptyTaskId = await createTask();
    const designTaskId = await createTask({ taskGroup: 'design' });
    const foreignTaskId = await createTask();

    const [empty, wrongGroup, foreign] = await Promise.all([
      request(app)
        .post('/api/task/request-modification')
        .set('Authorization', `Bearer ${publisherToken}`)
        .field('taskId', String(emptyTaskId))
        .field('note', '   '),
      request(app)
        .post('/api/task/request-modification')
        .set('Authorization', `Bearer ${publisherToken}`)
        .field('taskId', String(designTaskId))
        .field('note', '不应修改其他任务组'),
      request(app)
        .post('/api/task/request-modification')
        .set('Authorization', `Bearer ${otherToken}`)
        .field('taskId', String(foreignTaskId))
        .field('note', '不应修改他人任务')
    ]);

    expect([empty.body.code, wrongGroup.body.code, foreign.body.code]).toEqual([400, 400, 403]);
    expect((await detail(emptyTaskId)).body.data.status).toBe('doing');
    expect((await detail(designTaskId)).body.data.status).toBe('doing');
    expect((await detail(foreignTaskId)).body.data.status).toBe('doing');
  });

  test('basic designer reply and uploaded works bind to the latest modification', async () => {
    const id = await createTask();
    const modification = await request(app)
      .post('/api/task/request-modification')
      .set('Authorization', `Bearer ${publisherToken}`)
      .field('taskId', String(id))
      .field('note', '修改主体位置');
    expect(modification.body.code).toBe(0);

    const response = await request(app)
      .post('/api/task/upload-files')
      .set('Authorization', `Bearer ${basicToken}`)
      .field('taskId', String(id))
      .field('fileCategory', 'work')
      .field('actualQuantity', '1')
      .field('appliedScore', '2.5')
      .field('modificationReply', '已调整主体位置')
      .attach('files', Buffer.from('updated work a'), '修改作品A.png')
      .attach('files', Buffer.from('updated work b'), '修改作品B.png');

    expect(response.body.code).toBe(0);
    const task = (await detail(id)).body.data;
    expect(task.status).toBe('doing');
    expect(task.reject_records[0].designer_reply).toBe('已调整主体位置');
    expect(task.reject_records[0].files).toEqual(expect.arrayContaining([
      expect.objectContaining({ file_name: '修改作品A.png', file_category: 'work' }),
      expect.objectContaining({ file_name: '修改作品B.png', file_category: 'work' })
    ]));

    const repeated = await request(app)
      .post('/api/task/upload-files')
      .set('Authorization', `Bearer ${basicToken}`)
      .field('taskId', String(id))
      .field('fileCategory', 'work')
      .field('modificationReply', '重复回复')
      .attach('files', Buffer.from('duplicate work'), '重复.png');
    expect(repeated.body.code).toBe(400);
    expect((await detail(id)).body.data.reject_records[0].files).toHaveLength(2);
  });

  afterAll(async () => {
    await execute(
      'DELETE FROM task_file WHERE task_id IN (SELECT id FROM task_info WHERE task_no LIKE ?)',
      [`${taskPrefix}%`]
    );
    await execute(
      'DELETE FROM task_reject_record WHERE task_id IN (SELECT id FROM task_info WHERE task_no LIKE ?)',
      [`${taskPrefix}%`]
    );
    await execute('DELETE FROM task_info WHERE task_no LIKE ?', [`${taskPrefix}%`]);
    for (const id of [publisherId, otherId, basicId]) {
      if (!id) continue;
      await request(app)
        .post('/api/user/delete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id });
    }
  });
});

afterAll(async () => {
  if (!execute || !taskId) return;
  await execute('DELETE FROM task_reject_record WHERE task_id = ?', [taskId]);
  await execute('DELETE FROM task_info WHERE id = ?', [taskId]);
});
