const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let execute;
let adminToken;
let csAToken;
let csBToken;
let basicToken;
let csAId;
let csBId;
let basicId;

const suffix = Date.now();
const users = {
  csA: `handoff_cs_a_${suffix}`,
  csB: `handoff_cs_b_${suffix}`,
  basic: `handoff_basic_${suffix}`
};
const taskPrefix = `HANDOFF-${suffix}`;
let taskSequence = 0;

async function login(username) {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ username, password: 'test123456' });
  expect(response.body.code).toBe(0);
  return response.body.data;
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
  return list.body.data.list.find(user => user.username === username).id;
}

async function createTask(status, options = {}) {
  taskSequence += 1;
  const taskNo = `${taskPrefix}-${String(taskSequence).padStart(3, '0')}`;
  const publisherId = Object.prototype.hasOwnProperty.call(options, 'publisherId')
    ? options.publisherId
    : csAId;
  const publisherName = publisherId ? (options.publisherName || '客服甲') : '';
  const designerId = Object.prototype.hasOwnProperty.call(options, 'designerId')
    ? options.designerId
    : basicId;
  const handoffStatus = options.handoffStatus || '';
  const [result] = await execute(
    `INSERT INTO task_info
       (task_no, title, status, publisher_id, publisher_name, designer_id,
        designer_name, task_group, handoff_status, handoff_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'cs', ?, ?)`,
    [
      taskNo,
      `${taskNo} task`,
      status,
      publisherId,
      publisherName,
      designerId,
      designerId ? '基础美工' : '',
      handoffStatus,
      handoffStatus === 'pooled' ? '2026-09-03 12:00:00' : null
    ]
  );
  return Number(result.insertId);
}

async function setShift(userId, status) {
  await execute('UPDATE sys_user SET cs_shift_status = ? WHERE id = ?', [status, userId]);
}

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  app = await setupApp();
  ({ execute } = require('../../config/database'));

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = adminLogin.body.data.token;

  csAId = await createUser(users.csA, '客服甲', 'cs_agent');
  csBId = await createUser(users.csB, '客服乙', 'cs_agent');
  basicId = await createUser(users.basic, '基础美工', 'basic_designer');

  csAToken = (await login(users.csA)).token;
  csBToken = (await login(users.csB)).token;
  basicToken = (await login(users.basic)).token;
});

beforeEach(async () => {
  await execute('DELETE FROM task_file WHERE task_id IN (SELECT id FROM task_info WHERE task_no LIKE ?)', [`${taskPrefix}%`]);
  await execute('DELETE FROM task_info WHERE task_no LIKE ?', [`${taskPrefix}%`]);
  await setShift(csAId, 'online');
  await setShift(csBId, 'online');
});

test('offline pools accepted doing rejected and draft but not wait or finished', async () => {
  const ids = {};
  for (const status of ['wait', 'accepted', 'doing', 'rejected', 'draft', 'finished']) {
    ids[status] = await createTask(status, { designerId: status === 'wait' ? null : basicId });
  }

  const response = await request(app)
    .post('/api/task/cs-shift/status')
    .set('Authorization', `Bearer ${csAToken}`)
    .send({ status: 'offline' });

  expect(response.body).toMatchObject({ code: 0, data: { status: 'offline', movedTaskCount: 4 } });
  const [rows] = await execute(
    'SELECT id, status, publisher_id, publisher_name, handoff_status FROM task_info WHERE task_no LIKE ? ORDER BY id',
    [`${taskPrefix}%`]
  );
  const byStatus = new Map(rows.map(row => [row.status, row]));
  for (const status of ['accepted', 'doing', 'rejected', 'draft']) {
    expect(byStatus.get(status)).toMatchObject({ publisher_id: null, publisher_name: '', handoff_status: 'pooled' });
  }
  for (const status of ['wait', 'finished']) {
    expect(byStatus.get(status)).toMatchObject({ publisher_id: csAId, handoff_status: '' });
  }
});

test('accepting an offline publisher wait task pools it after assignment', async () => {
  const taskId = await createTask('wait', { designerId: null });
  await setShift(csAId, 'offline');

  const response = await request(app)
    .post('/api/task/accept')
    .set('Authorization', `Bearer ${basicToken}`)
    .send({ taskId });

  expect(response.body.code).toBe(0);
  const [rows] = await execute(
    'SELECT status, publisher_id, designer_id, handoff_status FROM task_info WHERE id = ?',
    [taskId]
  );
  expect(rows[0]).toMatchObject({ status: 'accepted', publisher_id: null, designer_id: basicId, handoff_status: 'pooled' });
});

test('offline customer service cannot create review batch review or claim', async () => {
  await setShift(csAId, 'offline');
  const doingTaskId = await createTask('doing');
  const pooledTaskId = await createTask('accepted', { publisherId: null, handoffStatus: 'pooled' });

  const responses = await Promise.all([
    request(app)
      .post('/api/task/create')
      .set('Authorization', `Bearer ${csAToken}`)
      .send({ title: 'offline create', taskGroup: 'cs' }),
    request(app)
      .post('/api/task/review')
      .set('Authorization', `Bearer ${csAToken}`)
      .send({ taskId: doingTaskId, action: 'pass' }),
    request(app)
      .post('/api/task/batch-review')
      .set('Authorization', `Bearer ${csAToken}`)
      .send({ taskIds: [doingTaskId] }),
    request(app)
      .post(`/api/task/cs-handoff/${pooledTaskId}/claim`)
      .set('Authorization', `Bearer ${csAToken}`)
  ]);

  expect(responses.map(response => response.body.code)).toEqual([403, 403, 403, 403]);
});

test('claim changes publisher without changing status designer or files', async () => {
  const taskId = await createTask('rejected', { publisherId: null, handoffStatus: 'pooled' });
  await execute(
    `INSERT INTO task_file
       (task_id, file_name, file_path, file_size, file_type, uploader_id, file_category)
     VALUES (?, 'work.png', 'test/work.png', 4, 'image', ?, 'work')`,
    [taskId, basicId]
  );

  const response = await request(app)
    .post(`/api/task/cs-handoff/${taskId}/claim`)
    .set('Authorization', `Bearer ${csBToken}`);

  expect(response.body.code).toBe(0);
  const [rows] = await execute(
    `SELECT status, publisher_id, publisher_name, designer_id, handoff_status, handoff_time,
            (SELECT COUNT(*) FROM task_file WHERE task_id = task_info.id) AS file_count
     FROM task_info WHERE id = ?`,
    [taskId]
  );
  expect(rows[0]).toMatchObject({
    status: 'rejected',
    publisher_id: csBId,
    publisher_name: '客服乙',
    designer_id: basicId,
    handoff_status: '',
    handoff_time: null,
    file_count: 1
  });
});

test('two claims on one row produce one success and one conflict', async () => {
  const taskId = await createTask('accepted', { publisherId: null, handoffStatus: 'pooled' });

  const responses = await Promise.all([
    request(app).post(`/api/task/cs-handoff/${taskId}/claim`).set('Authorization', `Bearer ${csAToken}`),
    request(app).post(`/api/task/cs-handoff/${taskId}/claim`).set('Authorization', `Bearer ${csBToken}`)
  ]);

  expect(responses.map(response => response.body.code).sort()).toEqual([0, 409]);
});

test('pooled detail access does not grant access to ordinary foreign tasks', async () => {
  const pooledTaskId = await createTask('accepted', { publisherId: null, handoffStatus: 'pooled' });
  const ordinaryTaskId = await createTask('accepted');

  const pooled = await request(app)
    .get(`/api/task/detail?taskId=${pooledTaskId}`)
    .set('Authorization', `Bearer ${csBToken}`);
  const ordinary = await request(app)
    .get(`/api/task/detail?taskId=${ordinaryTaskId}`)
    .set('Authorization', `Bearer ${csBToken}`);

  expect(pooled.body.code).toBe(0);
  expect(ordinary.body.code).toBe(403);
});

test('pool list and sidebar badge expose only pooled tasks', async () => {
  const pooledTaskId = await createTask('doing', { publisherId: null, handoffStatus: 'pooled' });
  await createTask('accepted');

  const list = await request(app)
    .get('/api/task/cs-handoff?pageSize=20')
    .set('Authorization', `Bearer ${csBToken}`);
  expect(list.body.code).toBe(0);
  expect(list.body.data.list.map(task => Number(task.id))).toContain(pooledTaskId);

  const stats = await request(app)
    .get('/api/task/stats/my')
    .set('Authorization', `Bearer ${csBToken}`);
  expect(stats.body.code).toBe(0);
  expect(stats.body.data.sidebar_badges['/cs/handoff-tasks']).toBe(1);
});

test('login and refresh return the current customer service shift state', async () => {
  const initial = await login(users.csA);
  expect(initial.user.csShiftStatus).toBe('online');

  const toggle = await request(app)
    .post('/api/task/cs-shift/status')
    .set('Authorization', `Bearer ${initial.token}`)
    .send({ status: 'offline' });
  expect(toggle.body.code).toBe(0);

  const refreshed = await request(app)
    .post('/api/auth/refresh')
    .send({ refreshToken: initial.refreshToken });
  expect(refreshed.body.code).toBe(0);
  expect(refreshed.body.data.user.csShiftStatus).toBe('offline');
});

afterAll(async () => {
  if (!execute) return;
  await execute('DELETE FROM task_file WHERE task_id IN (SELECT id FROM task_info WHERE task_no LIKE ?)', [`${taskPrefix}%`]);
  await execute('DELETE FROM task_info WHERE task_no LIKE ?', [`${taskPrefix}%`]);
  for (const id of [csAId, csBId, basicId]) {
    if (!id) continue;
    await request(app)
      .post('/api/user/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id });
  }
});
