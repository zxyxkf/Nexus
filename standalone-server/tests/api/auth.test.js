/**
 * 认证接口集成测试
 */

const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;

beforeAll(async () => {
  app = await setupApp();
}, 30000);

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
  it('短时间内多次错误登录触发限流', async () => {
    const codes = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrong' });
      codes.push(res.body.code);
    }
    // 至少有一次触发 429 限流
    expect(codes.some(c => c === 429)).toBe(true);
  });
});
