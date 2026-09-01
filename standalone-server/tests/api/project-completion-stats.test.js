const request = require('supertest');
const { setupApp } = require('./helpers/setup');

let app;
let adminToken;
let operatorToken;
let designerToken;
let designerId;
let scoreItem;

const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

function formatDateTime(date) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function parseActiveTasks(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return JSON.parse(value);
}

beforeAll(async () => {
  process.env.DISABLE_RATE_LIMIT = '1';
  app = await setupApp();

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: 'admin', password: 'admin123' });
  adminToken = adminLogin.body.data.token;

  const operatorUsername = `project_stats_operator_${suffix}`;
  const designerUsername = `project_stats_designer_${suffix}`;

  for (const user of [
    { username: operatorUsername, realName: '项目统计运营', role: 'operator', store: '项目统计店铺' },
    { username: designerUsername, realName: '项目统计美工', role: 'designer' }
  ]) {
    const created = await request(app)
      .post('/api/user/create')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ...user, password: 'test123456' });
    expect(created.body.code).toBe(0);
  }

  const users = await request(app)
    .get('/api/user/list?pageSize=100')
    .set('Authorization', `Bearer ${adminToken}`);
  designerId = users.body.data.list.find(user => user.username === designerUsername).id;

  const operatorLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: operatorUsername, password: 'test123456' });
  operatorToken = operatorLogin.body.data.token;

  const designerLogin = await request(app)
    .post('/api/auth/login')
    .send({ username: designerUsername, password: 'test123456' });
  designerToken = designerLogin.body.data.token;

  const scoreItems = await request(app)
    .get('/api/score/items?taskGroup=design')
    .set('Authorization', `Bearer ${operatorToken}`);
  scoreItem = scoreItems.body.data[0];
  expect(scoreItem).toBeDefined();
}, 30000);

describe('美工项目类型完成统计与指定人员负载', () => {
  it('只按审核通过时间统计项目完成数，并从负载中排除待审核任务', async () => {
    const now = new Date();
    const currentMonthTime = formatDateTime(new Date(now.getFullYear(), now.getMonth(), 10, 12, 0, 0));
    const lastMonthTime = formatDateTime(new Date(now.getFullYear(), now.getMonth() - 1, 10, 12, 0, 0));
    const olderTime = formatDateTime(new Date(now.getFullYear() - 2, 0, 10, 12, 0, 0));
    const cases = [
      { name: '当月已完成', status: 'finished', finishTime: currentMonthTime },
      { name: '上月已完成', status: 'finished', finishTime: lastMonthTime },
      { name: '历史已完成', status: 'finished', finishTime: olderTime },
      { name: '其他业务线已完成', status: 'finished', finishTime: currentMonthTime, taskGroup: 'operator' },
      { name: '待审核', status: 'doing', finishTime: currentMonthTime },
      { name: '待做', status: 'accepted', finishTime: null },
      { name: '返工', status: 'rejected', finishTime: null }
    ];
    const taskIds = {};
    const { execute } = require('../../config/database');

    for (const item of cases) {
      const created = await request(app)
        .post('/api/task/create')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({
          title: `${item.name}_${suffix}`,
          taskGroup: 'design',
          priority: 1,
          designerId,
          scoreItemId: scoreItem.id,
          score: scoreItem.score || 1,
          shopName: '项目统计店铺'
        });
      expect(created.body.code).toBe(0);
      taskIds[item.name] = Number(created.body.data.id);
      await execute(
        'UPDATE task_info SET status = ?, finish_time = ?, task_group = ? WHERE id = ?',
        [item.status, item.finishTime, item.taskGroup || 'design', created.body.data.id]
      );
    }

    const adminStats = await request(app)
      .get('/api/task/stats/admin/detail')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminStats.body.code).toBe(0);
    const designer = adminStats.body.data.designerStats.find(item => Number(item.id) === Number(designerId));
    const adminProject = designer.project_stats.find(item => item.project_name === scoreItem.name);
    expect(adminProject).toMatchObject({ count: 3, current_month_count: 1, last_month_count: 1 });
    expect(adminProject.monthly_counts).toHaveLength(12);
    expect(adminProject.monthly_counts[now.getMonth()].count).toBe(1);

    const personalStats = await request(app)
      .get('/api/task/stats/my')
      .set('Authorization', `Bearer ${designerToken}`);
    expect(personalStats.body.code).toBe(0);
    const personalProject = personalStats.body.data.project_stats.find(item => item.project_name === scoreItem.name);
    expect(personalProject).toEqual(adminProject);

    const designerList = await request(app)
      .get('/api/user/designers')
      .set('Authorization', `Bearer ${operatorToken}`);
    expect(designerList.body.code).toBe(0);
    const listedDesigner = designerList.body.data.find(item => Number(item.id) === Number(designerId));
    const activeIds = parseActiveTasks(listedDesigner.active_tasks).map(task => Number(task.id));
    expect(activeIds).toEqual(expect.arrayContaining([taskIds['待做'], taskIds['返工']]));
    expect(activeIds).not.toContain(taskIds['待审核']);
    expect(activeIds).not.toContain(taskIds['当月已完成']);
  });
});
