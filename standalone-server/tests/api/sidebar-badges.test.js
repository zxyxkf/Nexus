const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let adminToken;
let csToken;
let basicToken;
let operatorToken;
let csId;
let basicId;
let operatorId;

const suffix = Date.now();
const csUser = `badge_cs_${suffix}`;
const basicUser = `badge_basic_${suffix}`;
const operatorUser = `badge_operator_${suffix}`;
const createdTaskIds = [];

async function login(username, password = 'test123456') {
  const res = await request(app).post('/api/auth/login').send({ username, password });
  expect(res.body.code).toBe(0);
  return res.body.data.token;
}

async function createUser(username, role, extra = {}) {
  const res = await request(app)
    .post('/api/user/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username, password: 'test123456', realName: username, role, ...extra });
  expect(res.body.code).toBe(0);
}

async function findUserId(role, username) {
  const res = await request(app)
    .get(`/api/user/list?role=${role}&pageSize=100`)
    .set('Authorization', `Bearer ${adminToken}`);
  expect(res.body.code).toBe(0);
  return res.body.data.list.find(u => u.username === username).id;
}

async function createCsTask(title, designerId = basicId, publisherToken = csToken) {
  const res = await request(app)
    .post('/api/task/create')
    .set('Authorization', `Bearer ${publisherToken}`)
    .send({ title, taskGroup: 'cs', score: 1, designerId });
  expect(res.body.code).toBe(0);
  createdTaskIds.push(res.body.data.id);
  return res.body.data.id;
}

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  app = await setupApp();

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = adminLogin.body.data.token;

  await createUser(csUser, 'cs_agent');
  await createUser(basicUser, 'basic_designer');
  await createUser(operatorUser, 'operator', { store: 'badge store' });

  csId = await findUserId('cs_agent', csUser);
  basicId = await findUserId('basic_designer', basicUser);
  operatorId = await findUserId('operator', operatorUser);

  csToken = await login(csUser);
  basicToken = await login(basicUser);
});

describe('sidebar badge counts', () => {
  it('counts todo badges by assignee and excludes doing tasks', async () => {
    const acceptedTaskId = await createCsTask('badge accepted task');
    const rejectedTaskId = await createCsTask('badge rejected task');
    const doingTaskId = await createCsTask('badge doing task');

    await request(app)
      .post('/api/task/upload-files')
      .set('Authorization', `Bearer ${basicToken}`)
      .field('taskId', String(rejectedTaskId))
      .field('fileCategory', 'work')
      .field('actualQuantity', '1')
      .attach('files', Buffer.from('reject me'), 'reject-me.txt')
      .expect(200);
    const reject = await request(app)
      .post('/api/task/review')
      .set('Authorization', `Bearer ${csToken}`)
      .send({ taskId: rejectedTaskId, action: 'reject', rejectReason: 'needs changes' });
    expect(reject.body.code).toBe(0);

    await request(app)
      .post('/api/task/upload-files')
      .set('Authorization', `Bearer ${basicToken}`)
      .field('taskId', String(doingTaskId))
      .field('fileCategory', 'work')
      .field('actualQuantity', '1')
      .attach('files', Buffer.from('doing'), 'doing.txt')
      .expect(200);

    const stats = await request(app)
      .get('/api/task/stats/my')
      .set('Authorization', `Bearer ${basicToken}`);
    expect(stats.body.code).toBe(0);
    expect(Number(stats.body.data.sidebar_badges?.['/basic/tasks/todo'] || 0)).toBe(2);

    const todoList = await request(app)
      .get('/api/task/my-accepted?taskGroup=cs&status=accepted,rejected&pageSize=50')
      .set('Authorization', `Bearer ${basicToken}`);
    expect(todoList.body.code).toBe(0);
    const todoIds = new Set((todoList.body.data.list || []).map(t => Number(t.id)));
    expect(todoIds.has(Number(acceptedTaskId))).toBe(true);
    expect(todoIds.has(Number(rejectedTaskId))).toBe(true);
    expect(todoIds.has(Number(doingTaskId))).toBe(false);
  });

  it('supports review badges and lists for users granted only review permission', async () => {
    await request(app)
      .post('/api/user/permissions/save')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: operatorId,
        permissions: ['cs.publish.basic', 'cs.review.basic'],
        deniedPermissions: []
      });
    operatorToken = await login(operatorUser);

    const taskId = await createCsTask('review badge permission task', basicId, operatorToken);
    await request(app)
      .post('/api/task/upload-files')
      .set('Authorization', `Bearer ${basicToken}`)
      .field('taskId', String(taskId))
      .field('fileCategory', 'work')
      .field('actualQuantity', '1')
      .attach('files', Buffer.from('review work'), 'review-work.txt')
      .expect(200);

    const stats = await request(app)
      .get('/api/task/stats/my')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(stats.body.code).toBe(0);
    expect(Number(stats.body.data.sidebar_badges?.['/cs/review'] || 0)).toBe(1);

    const reviewList = await request(app)
      .get('/api/task/my-published?taskGroup=cs&status=doing&selfOnly=true&pageSize=50')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(reviewList.body.code).toBe(0);
    expect(reviewList.body.data.list.some(t => Number(t.id) === Number(taskId))).toBe(true);
  });
});

afterAll(async () => {
  for (const taskId of createdTaskIds) {
    await request(app)
      .post('/api/task/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ taskId });
  }
  for (const id of [csId, basicId, operatorId]) {
    if (!id) continue;
    await request(app)
      .post('/api/user/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id });
  }
});
