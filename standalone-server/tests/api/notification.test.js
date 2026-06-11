/**
 * 通知接口集成测试
 * 覆盖: 列表查询, 标记已读, 未读数, 删除, 催促
 *
 * 运行: cd standalone-server && npm test
 */

const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let adminToken, designerToken;
let notificationId;

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  app = await setupApp();

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = adminLogin.body.data.token;

  // 创建测试美工用于催促测试
  const createDe = await request(app)
    .post('/api/user/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: `notif_designer_${Date.now()}`, password: 'test123456', realName: '通知测试美工', role: 'designer' });

  const deList = await request(app)
    .get('/api/user/list?role=designer')
    .set('Authorization', `Bearer ${adminToken}`);
  const deUser = deList.body.data.list.find(u => u.real_name === '通知测试美工');
  const designerId = deUser?.id;

  // 美工登录
  const deLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: deUser.username, password: 'test123456' });
  designerToken = deLogin.body.data.token;

  // 创建一个任务用于催促
  const createTask = await request(app)
    .post('/api/task/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      title: '通知测试任务',
      designerId,
      shopName: '通知测试',
      taskGroup: 'design',
      priority: 1
    });

  // admin 向美工发送催促
  if (createTask.body.taskId) {
    await request(app)
      .post('/api/notification/urge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        taskId: createTask.body.taskId,
        taskTitle: '通知测试任务',
        designerId
      });

    // 美工接单（触发通知）
    if (deUser) {
      await request(app)
        .post('/api/task/accept')
        .set('Authorization', `Bearer ${designerToken}`)
        .send({ taskId: createTask.body.taskId });
    }
  }
}, 30000);

describe('GET /api/notification/list', () => {
  it('美工可以获取通知列表', async () => {
    const res = await request(app)
      .get('/api/notification/list?pageSize=20')
      .set('Authorization', `Bearer ${designerToken}`);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data.list)).toBe(true);
    if (res.body.data.list.length > 0) {
      notificationId = res.body.data.list[0].id;
    }
  });

  it('未登录无法获取通知', async () => {
    const res = await request(app).get('/api/notification/list');
    expect(res.status).toBe(401);
  });

  it('支持分页', async () => {
    const res = await request(app)
      .get('/api/notification/list?page=1&pageSize=5')
      .set('Authorization', `Bearer ${designerToken}`);
    expect(res.body.code).toBe(0);
    expect(res.body.data.list.length).toBeLessThanOrEqual(5);
  });

  it('支持仅显示未读', async () => {
    const res = await request(app)
      .get('/api/notification/list?unreadOnly=true')
      .set('Authorization', `Bearer ${designerToken}`);
    expect(res.body.code).toBe(0);
    if (res.body.data.list.length > 0) {
      expect(res.body.data.list.every(n => n.is_read === 0)).toBe(true);
    }
  });

  it('支持类型和优先级筛选', async () => {
    const highRes = await request(app)
      .get('/api/notification/list?priority=high&pageSize=20')
      .set('Authorization', `Bearer ${designerToken}`);
    expect(highRes.body.code).toBe(0);
    expect(Array.isArray(highRes.body.data.list)).toBe(true);
    highRes.body.data.list.forEach(n => {
      expect(n.priority).toBe(3);
      expect(n.priority_label).toBe('重要');
    });

    const typeRes = await request(app)
      .get('/api/notification/list?type=task_urge&pageSize=20')
      .set('Authorization', `Bearer ${designerToken}`);
    expect(typeRes.body.code).toBe(0);
    typeRes.body.data.list.forEach(n => {
      expect(n.type).toBe('task_urge');
    });
  });
});

describe('POST /api/notification/read', () => {
  it('可以标记单条已读', async () => {
    if (!notificationId) return;
    const res = await request(app)
      .post('/api/notification/read')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ id: notificationId });
    expect(res.body.code).toBe(0);
  });

  it('可以全部标记已读', async () => {
    const res = await request(app)
      .post('/api/notification/read')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ all: true });
    expect(res.body.code).toBe(0);
  });
});

describe('GET /api/notification/unread-count', () => {
  it('可以获取未读数', async () => {
    const res = await request(app)
      .get('/api/notification/unread-count')
      .set('Authorization', `Bearer ${designerToken}`);
    expect(res.body.code).toBe(0);
    expect(typeof res.body.data.count).toBe('number');
  });
});

describe('POST /api/notification/delete', () => {
  it('可以删除指定通知', async () => {
    if (!notificationId) return;
    const res = await request(app)
      .post('/api/notification/delete')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ id: notificationId });
    expect(res.body.code).toBe(0);
  });

  it('可以清空所有通知', async () => {
    const res = await request(app)
      .post('/api/notification/delete')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ all: true });
    expect(res.body.code).toBe(0);

    // 验证已清空
    const listRes = await request(app)
      .get('/api/notification/list')
      .set('Authorization', `Bearer ${designerToken}`);
    expect(listRes.body.data.total).toBe(0);
  });
});
