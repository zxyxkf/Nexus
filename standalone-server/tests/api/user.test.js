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

describe('用户权限配置', () => {
  const permissionUsers = [];

  afterAll(async () => {
    for (const user of permissionUsers) {
      await request(app)
        .post('/api/user/delete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ id: user.id });
    }
  });

  it('页面权限会自动继承对应的动作权限', async () => {
    const username = `perm_user_${Date.now()}`;
    await request(app)
      .post('/api/user/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username,
        password: 'test123456',
        realName: '权限继承测试',
        role: 'designer'
      })
      .expect(200);

    const listRes = await request(app)
      .get('/api/user/list?role=designer')
      .set('Authorization', `Bearer ${adminToken}`);
    const permissionUser = listRes.body.data.list.find(u => u.username === username);
    expect(permissionUser).toBeDefined();
    permissionUsers.push(permissionUser);

    const saveRes = await request(app)
      .post('/api/user/permissions/save')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: permissionUser.id,
        permissions: ['operator.publish.design'],
        deniedPermissions: ['designer.hall.design']
      });
    expect(saveRes.body.code).toBe(0);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'test123456' });

    expect(loginRes.body.code).toBe(0);
    expect(loginRes.body.data.user.permissions).toContain('operator.publish.design');
    expect(loginRes.body.data.user.permissions).toContain('task.create.design');
    expect(loginRes.body.data.user.permissions).toContain('task.view.store');
    expect(loginRes.body.data.user.permissions).not.toContain('designer.hall.design');
  });

  it('超级管理员可以配置自身权限但始终保留用户管理权限', async () => {
    const listRes = await request(app)
      .get('/api/user/list?role=admin')
      .set('Authorization', `Bearer ${adminToken}`);
    const adminUser = listRes.body.data.list.find(u => u.username === 'admin');
    expect(adminUser).toBeDefined();

    const saveRes = await request(app)
      .post('/api/user/permissions/save')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: adminUser.id,
        permissions: [],
        deniedPermissions: ['dashboard.design', 'admin.users']
      });
    expect(saveRes.body.code).toBe(0);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'admin123' });

    expect(loginRes.body.code).toBe(0);
    expect(loginRes.body.data.user.permissions).toContain('admin.users');
    expect(loginRes.body.data.user.permissions).not.toContain('dashboard.design');
  });

  it('额外授予的管理页权限在重新登录后生效并可访问对应接口', async () => {
    const username = `perm_admin_page_${Date.now()}`;
    await request(app)
      .post('/api/user/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username,
        password: 'test123456',
        realName: '额外权限测试',
        role: 'designer'
      })
      .expect(200);

    const listRes = await request(app)
      .get('/api/user/list?role=designer')
      .set('Authorization', `Bearer ${adminToken}`);
    const user = listRes.body.data.list.find(u => u.username === username);
    expect(user).toBeDefined();
    permissionUsers.push(user);

    const beforeLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'test123456' });
    expect(beforeLoginRes.body.code).toBe(0);

    const deniedLogRes = await request(app)
      .get('/api/log/list')
      .set('Authorization', `Bearer ${beforeLoginRes.body.data.token}`);
    expect(deniedLogRes.status).toBe(403);

    const saveRes = await request(app)
      .post('/api/user/permissions/save')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: user.id,
        permissions: ['admin.logs', 'admin.config'],
        deniedPermissions: []
      });
    expect(saveRes.body.code).toBe(0);
    expect(saveRes.body.data.effective).toEqual(expect.arrayContaining(['admin.logs', 'admin.config']));

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'test123456' });

    expect(loginRes.body.code).toBe(0);
    expect(loginRes.body.data.user.permissions).toContain('admin.logs');
    expect(loginRes.body.data.user.permissions).toContain('admin.config');

    const token = loginRes.body.data.token;
    const logRes = await request(app)
      .get('/api/log/list')
      .set('Authorization', `Bearer ${token}`);
    expect(logRes.body.code).toBe(0);

    const configListRes = await request(app)
      .get('/api/config/list')
      .set('Authorization', `Bearer ${token}`);
    expect(configListRes.body.code).toBe(0);
    const editableConfig = configListRes.body.data.find(c => c.editable === 1);
    expect(editableConfig).toBeDefined();

    const configUpdateRes = await request(app)
      .put('/api/config/update')
      .set('Authorization', `Bearer ${token}`)
      .send({ id: editableConfig.id, configValue: editableConfig.config_value || 'test-value' });
    expect(configUpdateRes.body.code).toBe(0);
  });

  it('保存权限会撤销目标用户旧 refresh token', async () => {
    const username = `perm_revoke_${Date.now()}`;
    await request(app)
      .post('/api/user/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        username,
        password: 'test123456',
        realName: '权限刷新测试',
        role: 'designer'
      })
      .expect(200);

    const listRes = await request(app)
      .get('/api/user/list?role=designer')
      .set('Authorization', `Bearer ${adminToken}`);
    const user = listRes.body.data.list.find(u => u.username === username);
    expect(user).toBeDefined();
    permissionUsers.push(user);

    const oldLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'test123456' });
    expect(oldLoginRes.body.code).toBe(0);

    const saveRes = await request(app)
      .post('/api/user/permissions/save')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ userId: user.id, permissions: ['admin.logs'], deniedPermissions: [] });
    expect(saveRes.body.code).toBe(0);

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: oldLoginRes.body.data.refreshToken });
    expect(refreshRes.body.code).toBe(401);
  });
});
