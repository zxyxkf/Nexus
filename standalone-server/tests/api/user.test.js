/**
 * 用户管理接口集成测试
 * 需要 admin 登录后操作
 */

const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let adminToken;

beforeAll(async () => {
  app = await setupApp();

  // 登录获取 admin token
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = loginRes.body.data.token;
}, 30000);

describe('GET /api/user/list', () => {
  it('admin 可以获取用户列表', async () => {
    const res = await request(app)
      .get('/api/user/list')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
    expect(res.body.data.list.length).toBeGreaterThan(0);
    expect(Number(res.body.data.total)).toBeGreaterThan(0);
    expect(res.body.data.page).toBe(1);
  });

  it('支持分页参数', async () => {
    const res = await request(app)
      .get('/api/user/list?page=1&pageSize=2')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.list.length).toBeLessThanOrEqual(2);
  });

  it('支持按角色筛选', async () => {
    const res = await request(app)
      .get('/api/user/list?role=admin')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.list.every(u => u.role === 'admin')).toBe(true);
  });
});

describe('用户 CRUD 流程', () => {
  let testUserId;

  afterAll(async () => {
    // 清理：删除测试用户
    if (testUserId) {
      await request(app)
        .post('/api/user/delete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: testUserId });
    }
  });

  it('创建新用户', async () => {
    const res = await request(app)
      .post('/api/user/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username: 'test_designer_' + Date.now(),
        password: 'test123456',
        realName: '测试美工',
        role: 'designer',
        email: 'test@example.com',
        phone: '13800138000'
      });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);

    // 从用户列表中找到刚创建的用户
    const listRes = await request(app)
      .get('/api/user/list?role=designer')
      .set('Authorization', `Bearer ${adminToken}`);
    const user = listRes.body.data.list.find(u => u.real_name === '测试美工');
    expect(user).toBeDefined();
    testUserId = user.id;
  });

  it('更新用户信息', async () => {
    expect(testUserId).toBeDefined();
    const res = await request(app)
      .put('/api/user/update')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        id: testUserId,
        realName: '测试美工(已修改)',
        role: 'designer',
        email: 'updated@example.com'
      });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
  });

  it('重置用户密码', async () => {
    expect(testUserId).toBeDefined();
    const res = await request(app)
      .post('/api/user/reset-password')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: testUserId });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
  });

  it('禁用用户', async () => {
    expect(testUserId).toBeDefined();
    const res = await request(app)
      .post('/api/user/toggle-status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: testUserId, status: 0 });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
  });

  it('重新启用用户', async () => {
    expect(testUserId).toBeDefined();
    const res = await request(app)
      .post('/api/user/toggle-status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: testUserId, status: 1 });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
  });

  it('删除用户', async () => {
    expect(testUserId).toBeDefined();
    const res = await request(app)
      .post('/api/user/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: testUserId });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    testUserId = null; // 标记已删除
  });
});

describe('GET /api/user/designers', () => {
  it('返回美工列表', async () => {
    const res = await request(app)
      .get('/api/user/designers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

describe('GET /api/user/publishers', () => {
  it('admin 可以获取发布人列表', async () => {
    const res = await request(app)
      .get('/api/user/publishers')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
  });
});
