const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let execute;
let adminToken;
let publisherToken;
let otherPublisherToken;
let basicToken;
let otherBasicToken;
let publisherId;
let basicId;

const suffix = Date.now();
const taskPrefix = `CS-ORIGINAL-${suffix}`;
const users = {
  publisher: `cs_original_publisher_${suffix}`,
  otherPublisher: `cs_original_other_publisher_${suffix}`,
  basic: `cs_original_basic_${suffix}`,
  otherBasic: `cs_original_other_basic_${suffix}`
};

async function login(username, password = 'test123456') {
  const response = await request(app).post('/api/auth/login').send({ username, password });
  expect(response.body.code).toBe(0);
  return response.body.data.token;
}

async function createUser(username, realName, role) {
  const response = await request(app)
    .post('/api/user/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username, password: 'test123456', realName, role });
  expect(response.body.code).toBe(0);
  const list = await request(app)
    .get(`/api/user/list?role=${role}&pageSize=100`)
    .set('Authorization', `Bearer ${adminToken}`);
  return Number(list.body.data.list.find(user => user.username === username).id);
}

async function createTask({ taskGroup = 'cs', status = 'doing', designerId = basicId } = {}) {
  const taskNo = `${taskPrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const [result] = await execute(
    `INSERT INTO task_info
       (task_no, title, status, publisher_id, publisher_name, designer_id,
        designer_name, task_group, applied_score, score_review_status)
     VALUES (?, ?, ?, ?, '客服甲', ?, '基础美工甲', ?, 2.5, '')`,
    [taskNo, `${taskNo} task`, status, publisherId, designerId, taskGroup]
  );
  return Number(result.insertId);
}

async function getTask(taskId) {
  const [rows] = await execute('SELECT * FROM task_info WHERE id = ?', [taskId]);
  return rows[0];
}

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  app = await setupApp();
  ({ execute } = require('../../config/database'));
  adminToken = await login('admin', 'admin123');
  publisherId = await createUser(users.publisher, '客服甲', 'cs_agent');
  await createUser(users.otherPublisher, '客服乙', 'cs_agent');
  basicId = await createUser(users.basic, '基础美工甲', 'basic_designer');
  await createUser(users.otherBasic, '基础美工乙', 'basic_designer');
  publisherToken = await login(users.publisher);
  otherPublisherToken = await login(users.otherPublisher);
  basicToken = await login(users.basic);
  otherBasicToken = await login(users.otherBasic);
});

beforeEach(async () => {
  await execute(
    'DELETE FROM task_file WHERE task_id IN (SELECT id FROM task_info WHERE task_no LIKE ?)',
    [`${taskPrefix}%`]
  );
  await execute('DELETE FROM task_info WHERE task_no LIKE ?', [`${taskPrefix}%`]);
});

test('客服通过后进入待上传原图且不提前进入分值审核', async () => {
  const taskId = await createTask();
  const response = await request(app)
    .post('/api/task/review')
    .set('Authorization', `Bearer ${publisherToken}`)
    .send({ taskId, action: 'pass' });

  expect(response.body.code).toBe(0);
  expect(response.body.msg).toContain('上传原图');
  expect(await getTask(taskId)).toMatchObject({
    status: 'pending_original',
    score_review_status: ''
  });
});

test('原图可分批上传，完成上传后才进入已完成和分值审核', async () => {
  const taskId = await createTask({ status: 'pending_original' });
  const firstOriginalName = '源文件";\u007f A.psd';
  const secondOriginalName = '源文件B.zip';
  const first = await request(app)
    .post('/api/task/upload-original')
    .set('Authorization', `Bearer ${basicToken}`)
    .field('taskId', String(taskId))
    .field('originalFileNames', JSON.stringify([firstOriginalName]))
    .attach('files', Buffer.from('psd source'), 'nexus-upload-1.psd');
  const second = await request(app)
    .post('/api/task/upload-original')
    .set('Authorization', `Bearer ${basicToken}`)
    .field('taskId', String(taskId))
    .field('originalFileNames', JSON.stringify([secondOriginalName]))
    .attach('files', Buffer.from('zip source'), 'nexus-upload-1.zip');

  expect([first.body.code, second.body.code]).toEqual([0, 0]);
  expect((await getTask(taskId)).status).toBe('pending_original');
  const [files] = await execute(
    `SELECT file_name, file_category FROM task_file WHERE task_id = ? ORDER BY id`,
    [taskId]
  );
  expect(files).toEqual([
    expect.objectContaining({ file_name: firstOriginalName, file_category: 'original' }),
    expect.objectContaining({ file_name: secondOriginalName, file_category: 'original' })
  ]);

  const completed = await request(app)
    .post('/api/task/complete-original-upload')
    .set('Authorization', `Bearer ${basicToken}`)
    .send({ taskId });
  expect(completed.body.code).toBe(0);
  expect(await getTask(taskId)).toMatchObject({ status: 'finished', score_review_status: 'pending' });
});

test('没有原图、错误人员和错误状态都不能完成或上传原图', async () => {
  const pendingTaskId = await createTask({ status: 'pending_original' });
  const doingTaskId = await createTask({ status: 'doing' });
  const designTaskId = await createTask({ taskGroup: 'design', status: 'pending_original' });

  const [empty, foreign, wrongStatus, wrongGroup] = await Promise.all([
    request(app).post('/api/task/complete-original-upload')
      .set('Authorization', `Bearer ${basicToken}`).send({ taskId: pendingTaskId }),
    request(app).post('/api/task/upload-original')
      .set('Authorization', `Bearer ${otherBasicToken}`).field('taskId', String(pendingTaskId))
      .attach('files', Buffer.from('foreign'), 'foreign.psd'),
    request(app).post('/api/task/upload-original')
      .set('Authorization', `Bearer ${basicToken}`).field('taskId', String(doingTaskId))
      .attach('files', Buffer.from('doing'), 'doing.psd'),
    request(app).post('/api/task/upload-original')
      .set('Authorization', `Bearer ${basicToken}`).field('taskId', String(designTaskId))
      .attach('files', Buffer.from('design'), 'design.psd')
  ]);

  expect([empty.body.code, foreign.body.code, wrongStatus.body.code, wrongGroup.body.code])
    .toEqual([400, 403, 400, 400]);
  expect((await getTask(pendingTaskId)).status).toBe('pending_original');
});

test('其他客服不能审核非本人发布的任务', async () => {
  const taskId = await createTask();
  const response = await request(app)
    .post('/api/task/review')
    .set('Authorization', `Bearer ${otherPublisherToken}`)
    .send({ taskId, action: 'pass' });
  expect(response.body.code).toBe(403);
  expect((await getTask(taskId)).status).toBe('doing');
});
