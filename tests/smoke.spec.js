/**
 * Nexus 核心业务流程冒烟测试
 * 使用 Playwright APIRequestContext（无浏览器，仅 HTTP 请求）
 *
 * 前置条件:
 *   1. 后端已启动在 http://localhost:18632
 *   2. npm install @playwright/test
 *
 * 运行:
 *   npx playwright test --config=playwright.config.js
 *
 * 测试流程:
 *   admin 登录 → 创建设计师 → 创建任务 → 接单 → 提交 → 审核通过 → 验证
 *                                     → 驳回 → 重新提交 → 审核通过 → 验证
 */

const { test, expect } = require('@playwright/test');

let adminToken;
let designerId;
let designerToken;
let taskId;

const designerUser = `smoke_designer_${Date.now()}`;
const TASK_TITLE = `冒烟测试_${Date.now()}`;

// ==================== 用户与鉴权 ====================

test('admin 登录', async ({ request }) => {
  const res = await request.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin123' }
  });
  const body = await res.json();
  expect(body.code).toBe(0);
  adminToken = body.data.token;
  expect(adminToken).toBeDefined();
});

test('清理可能残留的测试数据', async ({ request }) => {
  const listRes = await request.get('/api/user/list?role=designer&pageSize=100', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const listBody = await listRes.json();
  if (listBody.data) {
    const oldUsers = listBody.data.list.filter(u =>
      u.username && u.username.startsWith('smoke_designer_') && u.username !== designerUser
    );
    for (const u of oldUsers) {
      await request.post('/api/user/delete', {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { id: u.id }
      });
    }
  }
});

test('创建测试设计师账号', async ({ request }) => {
  const res = await request.post('/api/user/create', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      username: designerUser,
      password: 'test123456',
      realName: '冒烟测试美工',
      role: 'designer'
    }
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.code).toBe(0);

  // 获取设计师 ID
  const listRes = await request.get('/api/user/list?role=designer&pageSize=100', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const listBody = await listRes.json();
  const user = listBody.data.list.find(u => u.username === designerUser);
  expect(user).toBeDefined();
  designerId = user.id;
});

test('设计师登录', async ({ request }) => {
  const res = await request.post('/api/auth/login', {
    data: { username: designerUser, password: 'test123456' }
  });
  const body = await res.json();
  expect(body.code).toBe(0);
  designerToken = body.data.token;
});

// ==================== 流程 A：大厅接单 → 通过 ====================

test('A1. admin 创建任务（发到大厅）', async ({ request }) => {
  const res = await request.post('/api/task/create', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      title: `${TASK_TITLE}_A`,
      description: '冒烟测试 — 完整接单→审核通过流程',
      priority: 1,
      taskGroup: 'design',
      score: 10,
      quantity: 2,
      shopName: '冒烟测试店铺'
      // 不传 designerId → 进入任务大厅（status=wait）
    }
  });
  const body = await res.json();
  expect(body.code).toBe(0);
  taskId = body.data.id;
  expect(taskId).toBeDefined();
});

test('A2. 设计师在任务大厅看到任务', async ({ request }) => {
  const res = await request.get('/api/task/hall?pageSize=50', {
    headers: { Authorization: `Bearer ${designerToken}` }
  });
  const body = await res.json();
  expect(body.code).toBe(0);
  const found = body.data.list.find(t => t.title.startsWith(TASK_TITLE));
  expect(found).toBeDefined();
});

test('A3. 设计师接单 → status=accepted', async ({ request }) => {
  const res = await request.post('/api/task/accept', {
    headers: { Authorization: `Bearer ${designerToken}` },
    data: { taskId }
  });
  const body = await res.json();
  expect(body.code).toBe(0);

  // 验证状态
  const detail = await request.get(`/api/task/detail?taskId=${taskId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const detailBody = await detail.json();
  expect(detailBody.data.status).toBe('accepted');
});

test('A4. 设计师提交作品 → status=doing', async ({ request }) => {
  const res = await request.post('/api/task/finish', {
    headers: { Authorization: `Bearer ${designerToken}` },
    data: { taskId, actualQuantity: 2 }
  });
  const body = await res.json();
  expect(body.code).toBe(0);

  const detail = await request.get(`/api/task/detail?taskId=${taskId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  expect(detail.json().then(b => b.data.status)).resolves.toBe('doing');
});

test('A5. admin 审核通过 → status=finished', async ({ request }) => {
  const res = await request.post('/api/task/review', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { taskId, action: 'pass' }
  });
  const body = await res.json();
  expect(body.code).toBe(0);

  const detail = await request.get(`/api/task/detail?taskId=${taskId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const detailBody = await detail.json();
  expect(detailBody.data.status).toBe('finished');
});

// ==================== 流程 B：驳回 → 重新提交 → 通过 ====================

let rejectTaskId;

test('B1. admin 创建第二个任务 + 接单 + 提交', async ({ request }) => {
  // 创建
  const create = await request.post('/api/task/create', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      title: `${TASK_TITLE}_B`,
      description: '冒烟测试 — 驳回→重新提交流程',
      priority: 1,
      taskGroup: 'design',
      score: 15,
      quantity: 1,
      shopName: '驳回测试店铺'
    }
  });
  expect(create.json().then(b => b.code)).resolves.toBe(0);
  const createBody = await create.json();
  rejectTaskId = createBody.data.id;

  // 接单
  await request.post('/api/task/accept', {
    headers: { Authorization: `Bearer ${designerToken}` },
    data: { taskId: rejectTaskId }
  });

  // 提交
  await request.post('/api/task/finish', {
    headers: { Authorization: `Bearer ${designerToken}` },
    data: { taskId: rejectTaskId, actualQuantity: 1 }
  });
});

test('B2. admin 驳回 → status=rejected', async ({ request }) => {
  const res = await request.post('/api/task/review', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { taskId: rejectTaskId, action: 'reject', rejectReason: '测试驳回原因：颜色需要调整' }
  });
  const body = await res.json();
  expect(body.code).toBe(0);

  const detail = await request.get(`/api/task/detail?taskId=${rejectTaskId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const detailBody = await detail.json();
  expect(detailBody.data.status).toBe('rejected');
  expect(detailBody.data.reject_reason).toBe('测试驳回原因：颜色需要调整');
});

test('B3. 设计师重新提交 → status=doing', async ({ request }) => {
  const res = await request.post('/api/task/finish', {
    headers: { Authorization: `Bearer ${designerToken}` },
    data: { taskId: rejectTaskId, actualQuantity: 1 }
  });
  const body = await res.json();
  expect(body.code).toBe(0);
});

test('B4. admin 再次审核通过 → status=finished', async ({ request }) => {
  const res = await request.post('/api/task/review', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { taskId: rejectTaskId, action: 'pass' }
  });
  const body = await res.json();
  expect(body.code).toBe(0);

  const detail = await request.get(`/api/task/detail?taskId=${rejectTaskId}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const detailBody = await detail.json();
  expect(detailBody.data.status).toBe('finished');
});

// ==================== 健康检查 ====================

test('健康检查', async ({ request }) => {
  const res = await request.get('/api/health');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.code).toBe(0);
});

// ==================== 统计 ====================

test('admin 获取仪表盘统计', async ({ request }) => {
  const res = await request.get('/api/task/stats/dashboard', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.code).toBe(0);
});

test('设计师获取个人统计', async ({ request }) => {
  const res = await request.get('/api/score/my-stats', {
    headers: { Authorization: `Bearer ${designerToken}` }
  });
  expect(res.ok()).toBeTruthy();
});

// ==================== 清理 ====================

test('清理：删除测试任务', async ({ request }) => {
  // 删除流程A的任务
  if (taskId) {
    await request.post('/api/task/delete', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { taskId }
    });
  }
  // 删除流程B的任务
  if (rejectTaskId) {
    await request.post('/api/task/delete', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { taskId: rejectTaskId }
    });
  }
});

test('清理：删除测试设计师', async ({ request }) => {
  if (designerId) {
    await request.post('/api/user/delete', {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { id: designerId }
    });
  }
});
