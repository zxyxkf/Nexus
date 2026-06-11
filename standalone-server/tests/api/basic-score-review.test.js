const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let adminToken;
let csToken;
let basicToken;
let leadToken;
let operatorToken;
let csId;
let basicId;
let leadId;
let operatorId;

const suffix = Date.now();
const csUser = `score_cs_${suffix}`;
const basicUser = `score_basic_${suffix}`;
const leadUser = `score_lead_${suffix}`;
const operatorUser = `score_operator_${suffix}`;

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  app = await setupApp();

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = adminLogin.body.data.token;

  await request(app)
    .post('/api/user/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: csUser, password: 'test123456', realName: '测试客服', role: 'cs_agent' });

  await request(app)
    .post('/api/user/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: basicUser, password: 'test123456', realName: '测试基础美工', role: 'basic_designer' });

  await request(app)
    .post('/api/user/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: leadUser, password: 'test123456', realName: '测试基础美工组长', role: 'basic_designer', isTeamLead: 1 });

  await request(app)
    .post('/api/user/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: operatorUser, password: 'test123456', realName: '测试运营', role: 'operator', store: '测试店铺' });

  const csList = await request(app).get('/api/user/list?role=cs_agent').set('Authorization', `Bearer ${adminToken}`);
  const basicList = await request(app).get('/api/user/list?role=basic_designer').set('Authorization', `Bearer ${adminToken}`);
  const operatorList = await request(app).get('/api/user/list?role=operator').set('Authorization', `Bearer ${adminToken}`);
  csId = csList.body.data.list.find(u => u.username === csUser).id;
  basicId = basicList.body.data.list.find(u => u.username === basicUser).id;
  leadId = basicList.body.data.list.find(u => u.username === leadUser).id;
  operatorId = operatorList.body.data.list.find(u => u.username === operatorUser).id;

  await request(app)
    .post('/api/user/permissions/save')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      userId: operatorId,
      permissions: ['cs.publish.basic', 'cs.tasks.basic', 'cs.review.basic'],
      deniedPermissions: []
    });

  csToken = (await request(app).post('/api/auth/login').send({ username: csUser, password: 'test123456' })).body.data.token;
  basicToken = (await request(app).post('/api/auth/login').send({ username: basicUser, password: 'test123456' })).body.data.token;
  leadToken = (await request(app).post('/api/auth/login').send({ username: leadUser, password: 'test123456' })).body.data.token;
  operatorToken = (await request(app).post('/api/auth/login').send({ username: operatorUser, password: 'test123456' })).body.data.token;
}, 30000);

describe('基础美工申请分以客服通过为最终入账基准', () => {
  let taskId;

  it('组长通过后客服未通过前不计入已完成分值；客服驳回会撤销本次申请', async () => {
    const create = await request(app)
      .post('/api/task/create')
      .set('Authorization', `Bearer ${csToken}`)
      .send({
        title: '基础美工分值驳回测试',
        taskGroup: 'cs',
        score: 1,
        designerId: basicId
      });
    expect(create.body.code).toBe(0);
    taskId = create.body.data.id;

    await request(app)
      .post('/api/task/upload-files')
      .set('Authorization', `Bearer ${basicToken}`)
      .field('taskId', String(taskId))
      .field('fileCategory', 'work')
      .field('actualQuantity', '1')
      .field('appliedScore', '3')
      .attach('files', Buffer.from('first work'), 'first.txt')
      .expect(200);

    const approve = await request(app)
      .post('/api/score/review/approve')
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ taskId });
    expect(approve.body.code).toBe(0);

    const beforeCsPassStats = await request(app)
      .get('/api/task/stats/my')
      .set('Authorization', `Bearer ${basicToken}`);
    expect(Number(beforeCsPassStats.body.data.total_score || 0)).toBe(0);

    const reject = await request(app)
      .post('/api/task/review')
      .set('Authorization', `Bearer ${csToken}`)
      .send({ taskId, action: 'reject', rejectReason: '需要修改' });
    expect(reject.body.code).toBe(0);

    const detail = await request(app)
      .get(`/api/task/detail?taskId=${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.data.status).toBe('rejected');
    expect(Number(detail.body.data.score)).toBe(1);
    expect(Number(detail.body.data.applied_score || 0)).toBe(3);
    expect(Number(detail.body.data.score_review_score || 0)).toBe(3);
    expect(detail.body.data.score_review_time).toBeTruthy();
    expect(detail.body.data.score_review_status || '').toBe('');

    const reviewList = await request(app)
      .get('/api/score/review/list?pageSize=50')
      .set('Authorization', `Bearer ${leadToken}`);
    expect(reviewList.body.data.list.some(t => Number(t.id) === Number(taskId))).toBe(false);
  });

  it('二次提交同样申请分后，仅客服最终通过时计一次申请分', async () => {
    await request(app)
      .post('/api/task/upload-files')
      .set('Authorization', `Bearer ${basicToken}`)
      .field('taskId', String(taskId))
      .field('fileCategory', 'work')
      .field('actualQuantity', '1')
      .field('appliedScore', '3')
      .attach('files', Buffer.from('second work'), 'second.txt')
      .expect(200);

    const approve = await request(app)
      .post('/api/score/review/approve')
      .set('Authorization', `Bearer ${leadToken}`)
      .send({ taskId });
    expect(approve.body.code).toBe(0);

    const pass = await request(app)
      .post('/api/task/review')
      .set('Authorization', `Bearer ${csToken}`)
      .send({ taskId, action: 'pass' });
    expect(pass.body.code).toBe(0);

    const stats = await request(app)
      .get('/api/task/stats/my')
      .set('Authorization', `Bearer ${basicToken}`);
    expect(Number(stats.body.data.total_score)).toBe(3);

    const detail = await request(app)
      .get(`/api/task/detail?taskId=${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.data.status).toBe('finished');
    expect(Number(detail.body.data.score)).toBe(3);
    expect(Number(detail.body.data.applied_score || 0)).toBe(3);
    expect(Number(detail.body.data.score_review_score || 0)).toBe(3);
    expect(detail.body.data.score_review_status).toBe('approved');
    expect(detail.body.data.score_review_time).toBeTruthy();
  });
});

describe('客服已完成基础美工任务编号修改', () => {
  const taskIds = [];

  async function createFinishedCsTask(title) {
    const create = await request(app)
      .post('/api/task/create')
      .set('Authorization', `Bearer ${csToken}`)
      .send({
        title,
        taskGroup: 'cs',
        score: 1,
        designerId: basicId
      });
    expect(create.body.code).toBe(0);
    const taskId = create.body.data.id;
    taskIds.push(taskId);

    await request(app)
      .post('/api/task/upload-files')
      .set('Authorization', `Bearer ${basicToken}`)
      .field('taskId', String(taskId))
      .field('fileCategory', 'work')
      .field('actualQuantity', '1')
      .attach('files', Buffer.from(`${title} work`), `${title}.txt`)
      .expect(200);

    const pass = await request(app)
      .post('/api/task/review')
      .set('Authorization', `Bearer ${csToken}`)
      .send({ taskId, action: 'pass' });
    expect(pass.body.code).toBe(0);

    const detail = await request(app)
      .get(`/api/task/detail?taskId=${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.data.status).toBe('finished');
    return detail.body.data;
  }

  it('客服可以把自己的已完成基础美工任务改成已有编号', async () => {
    const first = await createFinishedCsTask('允许重复编号A');
    const second = await createFinishedCsTask('允许重复编号B');

    expect(first.task_no).toBeTruthy();
    expect(second.task_no).toBeTruthy();
    expect(second.task_no).not.toBe(first.task_no);

    const update = await request(app)
      .put('/api/task/cs-task-no')
      .set('Authorization', `Bearer ${csToken}`)
      .send({ taskId: second.id, taskNo: first.task_no });
    expect(update.body.code).toBe(0);

    const updated = await request(app)
      .get(`/api/task/detail?taskId=${second.id}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(updated.body.data.task_no).toBe(first.task_no);

    const accepted = await request(app)
      .get('/api/task/my-accepted?taskGroup=cs&pageSize=50')
      .set('Authorization', `Bearer ${basicToken}`);
    expect(accepted.body.code).toBe(0);
    const synced = accepted.body.data.list.find(t => Number(t.id) === Number(second.id));
    expect(synced).toBeDefined();
    expect(synced.task_no).toBe(first.task_no);
  });

  it('运营拥有客服页面权限后仍需单独的改编号权限', async () => {
    const create = await request(app)
      .post('/api/task/create')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        title: '运营发布基础美工任务',
        taskGroup: 'cs',
        score: 1,
        designerId: basicId
      });
    expect(create.body.code).toBe(0);
    const taskId = create.body.data.id;
    taskIds.push(taskId);

    await request(app)
      .post('/api/task/upload-files')
      .set('Authorization', `Bearer ${basicToken}`)
      .field('taskId', String(taskId))
      .field('fileCategory', 'work')
      .field('actualQuantity', '1')
      .attach('files', Buffer.from('operator cs work'), 'operator-cs.txt')
      .expect(200);

    const pass = await request(app)
      .post('/api/task/review')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ taskId, action: 'pass' });
    expect(pass.body.code).toBe(0);

    const denied = await request(app)
      .put('/api/task/cs-task-no')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ taskId, taskNo: 'C-OPERATOR-DENIED' });
    expect(denied.status).toBe(403);

    await request(app)
      .post('/api/user/permissions/save')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: operatorId,
        permissions: ['cs.publish.basic', 'cs.tasks.basic', 'cs.review.basic', 'cs.task_no.update'],
        deniedPermissions: []
      });

    const relogin = await request(app)
      .post('/api/auth/login')
      .send({ username: operatorUser, password: 'test123456' });
    expect(relogin.body.data.user.permissions).toContain('cs.task_no.update');

    const allowed = await request(app)
      .put('/api/task/cs-task-no')
      .set('Authorization', `Bearer ${relogin.body.data.token}`)
      .send({ taskId, taskNo: 'C-OPERATOR-ALLOWED' });
    expect(allowed.body.code).toBe(0);

    const detail = await request(app)
      .get(`/api/task/detail?taskId=${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.data.task_no).toBe('C-OPERATOR-ALLOWED');
  });

  afterAll(async () => {
    for (const taskId of taskIds) {
      await request(app)
        .post('/api/task/delete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ taskId });
    }
  });
});

afterAll(async () => {
  for (const id of [csId, basicId, leadId, operatorId]) {
    if (id) {
      await request(app)
        .post('/api/user/delete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id });
    }
  }
});
