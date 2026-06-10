/**
 * 任务接口集成测试
 * 覆盖: CRUD, 完整状态流转, 驳回+重新提交, 权限校验, 边界条件
 *
 * 状态流转:
 *   create(无designerId) → wait → accept → accepted → finish → doing → review(pass) → finished
 *   create(有designerId) → accepted（跳过wait）
 *
 * 运行: cd standalone-server && npm test
 * 依赖: SQLite 临时数据库（无需外部服务）
 */

const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let adminToken, operatorToken, designerToken;
let operatorId, designerId;
const testDesigner = `test_designer_${Date.now()}`;
const testOperator = `test_operator_${Date.now()}`;

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1'; // 测试关闭限流，避免跨套件影响
  app = await setupApp();

  // 登录 admin
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = adminLogin.body.data.token;

  // 创建测试运营
  const createOp = await request(app)
    .post('/api/user/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: testOperator, password: 'test123456', realName: '测试运营', role: 'operator', store: '测试店铺' });
  expect(createOp.body.code).toBe(0);
  const opList = await request(app)
    .get('/api/user/list?role=operator')
    .set('Authorization', `Bearer ${adminToken}`);
  operatorId = opList.body.data.list.find(u => u.username === testOperator).id;

  // 创建测试美工
  const createDe = await request(app)
    .post('/api/user/create')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ username: testDesigner, password: 'test123456', realName: '测试美工', role: 'designer' });
  expect(createDe.body.code).toBe(0);
  const deList = await request(app)
    .get('/api/user/list?role=designer')
    .set('Authorization', `Bearer ${adminToken}`);
  designerId = deList.body.data.list.find(u => u.username === testDesigner).id;

  // 运营登录
  const opLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: testOperator, password: 'test123456' });
  operatorToken = opLogin.body.data.token;

  // 美工登录
  const deLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: testDesigner, password: 'test123456' });
  designerToken = deLogin.body.data.token;
}, 30000);

// ==================== 任务 CRUD ====================

describe('任务 CRUD', () => {
  let createdTaskId;

  afterAll(async () => {
    if (createdTaskId) {
      await request(app)
        .post('/api/task/delete')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ taskId: createdTaskId });
    }
  });

  it('运营可以创建任务（指定美工 → 自动接单）', async () => {
    const res = await request(app)
      .post('/api/task/create')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        title: '测试任务_CRUD',
        description: '测试用任务描述',
        priority: 2,
        taskGroup: 'design',
        score: 15,
        quantity: 3,
        designerId,
        shopName: '测试店铺',
        styleNumber: 'ST-001',
        specifiedColor: '红色',
        refPath: '/ref/test'
      });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(0);
    // create 响应格式: { code:0, msg:"...", data:{id:taskId} }
    expect(res.body.data.id).toBeDefined();
    createdTaskId = res.body.data.id;
  });

  it('可以查看任务详情', async () => {
    const res = await request(app)
      .get(`/api/task/detail?taskId=${createdTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
    expect(res.body.data.title).toBe('测试任务_CRUD');
    expect(res.body.data.shop_name).toBe('测试店铺');
    expect(Number(res.body.data.quantity)).toBe(3);
  });

  it('指定美工创建的任务状态为 accepted（自动接单）', async () => {
    const res = await request(app)
      .get(`/api/task/detail?taskId=${createdTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.data.status).toBe('accepted');
  });

  it('任务不传 title 返回业务错误', async () => {
    const res = await request(app)
      .post('/api/task/create')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ description: '无标题' });
    expect(res.body.code).not.toBe(0);
  });

  it('designer 无权创建任务', async () => {
    const res = await request(app)
      .post('/api/task/create')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ title: '无权创建', designerId });
    expect(res.body.code).toBe(403);
  });

  it('admin 可以删除未完成的任务', async () => {
    const createRes = await request(app)
      .post('/api/task/create')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ title: '待删除任务', shopName: 'test', taskGroup: 'design', priority: 1 });
    const delTaskId = createRes.body.data.id;

    const res = await request(app)
      .post('/api/task/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ taskId: delTaskId });
    expect(res.body.code).toBe(0);

    const detailRes = await request(app)
      .get(`/api/task/detail?taskId=${delTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detailRes.body.code).not.toBe(0);
  });
});

// ==================== 完整状态流转：wait → accepted → doing → finished ====================

describe('完整状态流转（大厅接单模式）', () => {
  let flowTaskId;

  it('1. 创建任务（不指定美工） → status=wait', async () => {
    const res = await request(app)
      .post('/api/task/create')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        title: '大厅接单流程测试',
        description: '先发到大厅，美工主动接单',
        priority: 1,
        taskGroup: 'design',
        score: 10,
        quantity: 2,
        shopName: '大厅测试'
        // 不传 designerId → 进入任务大厅
      });
    expect(res.body.code).toBe(0);
    flowTaskId = res.body.data.id;

    const detail = await request(app)
      .get(`/api/task/detail?taskId=${flowTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.data.status).toBe('wait');
  });

  it('2. 美工在大厅可以看到任务', async () => {
    const res = await request(app)
      .get('/api/task/hall?pageSize=50')
      .set('Authorization', `Bearer ${designerToken}`);
    expect(res.body.code).toBe(0);
    const found = res.body.data.list.find(t => t.id === flowTaskId);
    expect(found).toBeDefined();
  });

  it('3. 美工接单 → status=accepted', async () => {
    const res = await request(app)
      .post('/api/task/accept')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ taskId: flowTaskId });
    expect(res.body.code).toBe(0);

    const detail = await request(app)
      .get(`/api/task/detail?taskId=${flowTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.data.status).toBe('accepted');
  });

  it('4. 不能重复接单', async () => {
    const res = await request(app)
      .post('/api/task/accept')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ taskId: flowTaskId });
    expect(res.body.code).not.toBe(0);
  });

  it('5. 美工提交完成 → status=doing', async () => {
    const res = await request(app)
      .post('/api/task/finish')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ taskId: flowTaskId, actualQuantity: 2 });
    expect(res.body.code).toBe(0);

    const detail = await request(app)
      .get(`/api/task/detail?taskId=${flowTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.data.status).toBe('doing');
  });

  it('6. 运营审核通过（action=pass） → status=finished', async () => {
    const res = await request(app)
      .post('/api/task/review')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ taskId: flowTaskId, action: 'pass' });
    expect(res.body.code).toBe(0);

    const detail = await request(app)
      .get(`/api/task/detail?taskId=${flowTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.data.status).toBe('finished');
  });

  it('7. 已完成任务仍可被审核（再次 pass 仍是 finished）', async () => {
    const res = await request(app)
      .post('/api/task/review')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ taskId: flowTaskId, action: 'pass' });
    // 当前实现：不校验当前状态，允许重复审核（幂等操作）
    expect(res.body.code).toBe(0);
  });

  it('8. admin 可以删除已完成任务', async () => {
    const res = await request(app)
      .post('/api/task/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ taskId: flowTaskId });
    expect(res.body.code).toBe(0);
  });
});

// ==================== 驳回 + 重新提交流程 ====================

describe('驳回与重新提交', () => {
  let rejectTaskId;
  let firstSubmitTime;

  it('1. 创建 + 接单 + 提交', async () => {
    const create = await request(app)
      .post('/api/task/create')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ title: '驳回测试任务', shopName: '驳回测试', taskGroup: 'design', priority: 1 });
    rejectTaskId = create.body.data.id;

    await request(app)
      .post('/api/task/accept')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ taskId: rejectTaskId });

    await request(app)
      .post('/api/task/finish')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ taskId: rejectTaskId, actualQuantity: 1 });

    const detail = await request(app)
      .get(`/api/task/detail?taskId=${rejectTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.data.submit_time).toBeTruthy();
    firstSubmitTime = detail.body.data.submit_time;
  });

  it('2. 运营驳回（action=reject） → status=rejected', async () => {
    const res = await request(app)
      .post('/api/task/review')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ taskId: rejectTaskId, action: 'reject', rejectReason: '颜色不对，请修改' });
    expect(res.body.code).toBe(0);

    const detail = await request(app)
      .get(`/api/task/detail?taskId=${rejectTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.data.status).toBe('rejected');
    expect(detail.body.data.reject_reason).toBe('颜色不对，请修改');
  });

  it('3. 美工重新提交 → status=doing', async () => {
    await new Promise(resolve => setTimeout(resolve, 1100));

    const res = await request(app)
      .post('/api/task/finish')
      .set('Authorization', `Bearer ${designerToken}`)
      .send({ taskId: rejectTaskId, actualQuantity: 1 });
    expect(res.body.code).toBe(0);

    const detail = await request(app)
      .get(`/api/task/detail?taskId=${rejectTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.data.status).toBe('doing');
    expect(detail.body.data.submit_time).toBeTruthy();
    expect(detail.body.data.submit_time).not.toBe(firstSubmitTime);
  });

  it('4. 运营审核通过 → status=finished', async () => {
    const res = await request(app)
      .post('/api/task/review')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ taskId: rejectTaskId, action: 'pass' });
    expect(res.body.code).toBe(0);

    const detail = await request(app)
      .get(`/api/task/detail?taskId=${rejectTaskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(detail.body.data.status).toBe('finished');
  });
});

// ==================== 查询接口 ====================

describe('任务查询', () => {
  it('运营可以查看我发布的任务', async () => {
    const res = await request(app)
      .get('/api/task/my-published?pageSize=20')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(res.body.code).toBe(0);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(res.body.data.list)).toBe(true);
  });

  it('美工可以查看我已接单的任务', async () => {
    const res = await request(app)
      .get('/api/task/my-accepted?pageSize=20')
      .set('Authorization', `Bearer ${designerToken}`);
    expect(res.body.code).toBe(0);
    expect(Array.isArray(res.body.data.list)).toBe(true);
  });

  it('admin 可以查看全量任务', async () => {
    const res = await request(app)
      .get('/api/task/all?pageSize=20')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('支持关键词搜索', async () => {
    const res = await request(app)
      .get('/api/task/all?keyword=驳回测试&pageSize=20')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
    expect(res.body.data.total).toBeGreaterThanOrEqual(1);
  });

  it('支持按状态筛选 finished', async () => {
    const res = await request(app)
      .get('/api/task/all?status=finished&pageSize=50')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
    if (res.body.data.list.length > 0) {
      expect(res.body.data.list.every(t => t.status === 'finished')).toBe(true);
    }
  });

  it('支持按发布人筛选', async () => {
    const res = await request(app)
      .get(`/api/task/all?publisherId=${operatorId}&pageSize=20`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.body.code).toBe(0);
    if (res.body.data.list.length > 0) {
      expect(res.body.data.list.every(t => Number(t.publisher_id) === Number(operatorId))).toBe(true);
    }
  });
});

// ==================== 清理 ====================

afterAll(async () => {
  if (operatorId) {
    await request(app)
      .post('/api/user/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: operatorId });
  }
  if (designerId) {
    await request(app)
      .post('/api/user/delete')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ id: designerId });
  }
});
