/**
 * 认证接口集成测试
 */

const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let adminToken;
let storeManagerUserId;
const storeManagerUsername = `auth_store_manager_${Date.now()}`;

beforeAll(async () => {
  app = await setupApp();
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = loginRes.body.data.token;

  await request(app)
    .post('/api/user/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      username: storeManagerUsername,
      password: 'test123456',
      realName: '认证店长测试',
      role: 'operator_assistant',
      store: '认证测试店铺',
      isStoreManager: 1
    });

  const listRes = await request(app)
    .get('/api/user/list?role=operator_assistant')
    .set('Authorization', `Bearer ${adminToken}`);
  storeManagerUserId = listRes.body.data.list.find(user => user.username === storeManagerUsername)?.id;
}, 30000);

afterAll(async () => {
  if (!storeManagerUserId) return;
  await request(app)
    .post('/api/user/delete')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ id: storeManagerUserId });
});

describe('POST /api/auth/login', () => {
  it('缺少用户名返回业务错误码 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: '123456' });
    expect(res.body.code).toBe(400);
    expect(res.body.msg).toBeDefined();
  });

  it('缺少密码返回业务错误码 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin' });
    expect(res.body.code).toBe(400);
  });

  it('错误密码返回业务错误码 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong-password' });
    expect(res.body.code).toBe(401);
  });

  it('不存在的用户返回业务错误码 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nonexistent_user', password: '123456' });
    expect(res.body.code).toBe(401);
  });

  it('默认管理员登录成功并返回 token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    expect(res.body.code).toBe(0);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.username).toBe('admin');
    expect(res.body.data.user.role).toBe('admin');
  });

  it('登录和刷新 token 都返回店铺与店长身份', async () => {
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: storeManagerUsername, password: 'test123456' });

    expect(loginRes.body.code).toBe(0);
    expect(loginRes.body.data.user).toMatchObject({
      store: '认证测试店铺',
      isStoreManager: 1
    });

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: loginRes.body.data.refreshToken });

    expect(refreshRes.body.code).toBe(0);
    expect(refreshRes.body.data.user).toMatchObject({
      store: '认证测试店铺',
      isStoreManager: 1
    });
  });
});

describe('GET /api/health', () => {
  it('返回健康状态', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body.code).toBe(0);
    expect(res.body.time).toBeDefined();
  });
});

describe('认证保护', () => {
  it('未登录访问受保护接口返回 HTTP 401', async () => {
    const res = await request(app).get('/api/user/list');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe(401);
  });

  it('无效 Token 返回 HTTP 401', async () => {
    const res = await request(app)
      .get('/api/user/list')
      .set('Authorization', 'Bearer invalid-token-here');
    expect(res.status).toBe(401);
  });
});

describe('速率限制', () => {
  it('测试环境下登录限流被放宽，避免接口套件互相影响', async () => {
    const codes = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrong' });
      codes.push(res.body.code);
    }
    expect(codes.every(c => c === 401)).toBe(true);
  });
});
