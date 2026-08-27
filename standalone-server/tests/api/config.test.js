/**
 * 系统配置接口集成测试
 * 覆盖: 列表查询, 更新配置(权限校验), 获取单个值, 删除
 *
 * 运行: cd standalone-server && npm test
 */

const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let adminToken;
let editableConfigId;

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  app = await setupApp();

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = adminLogin.body.data.token;
}, 30000);

describe('GET /api/config/list', () => {
  it('任意登录用户都可以获取配置列表', async () => {
    const res = await request(app)
      .get('/api/config/list')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    // 记录一个可编辑的配置项用于后续测试
    const editable = res.body.data.find(c => c.editable === 1);
    if (editable) editableConfigId = editable.id;
  });

  it('未登录无法获取配置', async () => {
    const res = await request(app).get('/api/config/list');
    expect(res.status).toBe(401);
  });

  it('支持按分组筛选', async () => {
    const res = await request(app)
      .get('/api/config/list?group=upload')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
    if (res.body.data.length > 0) {
      expect(res.body.data.every(c => c.config_group === 'upload')).toBe(true);
    }
  });

  it('seeds the editable payment tracking image directory', async () => {
    const res = await request(app)
      .get('/api/config/list?group=upload')
      .set('Authorization', `Bearer ${adminToken}`);
    const config = res.body.data.find(item => item.config_key === 'upload.payment_tracking_images_dir');
    expect(config).toMatchObject({ editable: 1, config_group: 'upload' });
    expect(config.config_value).toContain('payment-tracking');
  });
});

describe('GET /api/config/get-value', () => {
  it('可以根据 key 获取配置值', async () => {
    const res = await request(app)
      .get('/api/config/get-value?key=upload.design_images_dir')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
    expect(typeof res.body.data).toBe('string');
  });

  it('不存在的 key 返回错误', async () => {
    const res = await request(app)
      .get('/api/config/get-value?key=nonexistent.key.xyz')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).not.toBe(0);
  });

  it('缺少 key 参数返回 400', async () => {
    const res = await request(app)
      .get('/api/config/get-value')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(400);
  });
});

describe('PUT /api/config/update', () => {
  it('admin 可以更新配置', async () => {
    if (!editableConfigId) return;
    const res = await request(app)
      .put('/api/config/update')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: editableConfigId, configValue: 'test-value' });
    expect(res.body.code).toBe(0);
  });

  it('缺少 configValue 返回 400', async () => {
    const res = await request(app)
      .put('/api/config/update')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: 99999 });
    expect(res.body.code).toBe(400);
  });

  it('不存在的配置 ID 返回 400', async () => {
    const res = await request(app)
      .put('/api/config/update')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: 99999999, configValue: 'x' });
    expect(res.body.code).toBe(400);
  });
});

describe('POST /api/config/delete', () => {
  it('没有 admin.config 权限不能删除配置', async () => {
    const username = `cfg_op_${Date.now()}`;
    const createOp = await request(app)
      .post('/api/user/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username, password: 'test123456', realName: '配置测试运营', role: 'operator', store: '测试店铺' });
    expect(createOp.body.code).toBe(0);

    const opLogin = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'test123456' });

    const opToken = opLogin.body.data.token;
    expect(opToken).toBeDefined();

    const res = await request(app)
      .post('/api/config/delete')
      .set('Authorization', `Bearer ${opToken}`)
      .send({ id: 1 });
    expect(res.body.code).toBe(403);
  });

  it('有 admin.config 权限的普通用户可以更新配置', async () => {
    if (!editableConfigId) return;
    const username = `cfg_perm_${Date.now()}`;
    await request(app)
      .post('/api/user/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username, password: 'test123456', realName: '配置权限测试', role: 'designer' });

    const userList = await request(app)
      .get('/api/user/list?role=designer')
      .set('Authorization', `Bearer ${adminToken}`);
    const user = userList.body.data.list.find(u => u.username === username);
    expect(user).toBeDefined();

    const saveRes = await request(app)
      .post('/api/user/permissions/save')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: user.id, permissions: ['admin.config'], deniedPermissions: [] });
    expect(saveRes.body.code).toBe(0);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'test123456' });
    const token = loginRes.body.data.token;

    const res = await request(app)
      .put('/api/config/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: editableConfigId, configValue: 'permission-test-value' });
    expect(res.body.code).toBe(0);
  });
});
