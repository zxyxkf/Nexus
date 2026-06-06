/**
 * 积分计算逻辑单元测试
 * 验证月度统计、设计师积分、完成率等计算
 */

// 复制自 task.service.js 的纯函数
const CN_MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const CN_MONTHS_SHORT = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function buildMonthlyTable(users, rawData) {
  return users.map(u => {
    const userRows = rawData.filter(r => Number(r.designer_id) === Number(u.id));
    const months = [];
    for (let m = 1; m <= 12; m++) {
      const row = userRows.find(r => Number(r.month) === m);
      months.push({
        month: CN_MONTHS_SHORT[m - 1],
        published: row ? Number(row.published) : 0,
        finished: row ? Number(row.finished) : 0,
        unsubmitted: row ? Number(row.unsubmitted) : 0
      });
    }
    return { id: u.id, name: u.name, months };
  });
}

function buildDesignerStats(users, tasks, scoreItems, refDate) {
  const now = refDate || new Date();
  const thisYear = now.getFullYear();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);

  return users.map(d => {
    const userTasks = tasks.filter(t => Number(t.designer_id) === Number(d.id));
    const finishedTasks = userTasks.filter(t => t.status === 'finished');

    let totalScore = 0, currentMonthScore = 0, todayScore = 0, yesterdayScore = 0;

    const monthlyMap = {};
    for (let m = 1; m <= 12; m++) {
      monthlyMap[m] = { month: CN_MONTHS_SHORT[m - 1], score: 0, finished: 0, total: 0 };
    }

    const projectMap = {};

    for (const task of userTasks) {
      const actualQty = Number(task.actual_quantity) || 0;
      const score = (Number(task.score) || 0) * (actualQty > 0 ? actualQty : 1);
      const ft = task.finish_time ? new Date(task.finish_time) : null;
      const isValidFt = ft && !isNaN(ft.getTime());

      if (task.status === 'finished') {
        totalScore += score;
        if (isValidFt) {
          if (ft.getFullYear() === thisYear && ft.getMonth() + 1 === now.getMonth() + 1) currentMonthScore += score;
          if (ft.getFullYear() === today.getFullYear() && ft.getMonth() === today.getMonth() && ft.getDate() === today.getDate()) todayScore += score;
          if (ft.getFullYear() === yesterday.getFullYear() && ft.getMonth() === yesterday.getMonth() && ft.getDate() === yesterday.getDate()) yesterdayScore += score;
        }
      }

      const ct = task.create_time ? new Date(task.create_time) : null;
      if (ct && !isNaN(ct.getTime()) && ct.getFullYear() === thisYear) {
        const m = ct.getMonth() + 1;
        monthlyMap[m].total += 1;
        if (task.status === 'finished') {
          monthlyMap[m].score += score;
          monthlyMap[m].finished += 1;
        }
      }

      const siid = task.score_item_id;
      if (siid) projectMap[siid] = (projectMap[siid] || 0) + 1;
    }

    const total = userTasks.length || 1;
    const finished = finishedTasks.length;

    return {
      id: d.id, name: d.name || d.username,
      total_score: totalScore,
      current_month_score: currentMonthScore,
      today_score: todayScore,
      yesterday_score: yesterdayScore,
      finished_count: finished,
      total_count: userTasks.length,
      completion_rate: Math.round(finished / total * 1000) / 10,
      monthly_stats: Object.values(monthlyMap).map(m => ({
        ...m,
        rate: m.total > 0 ? Math.round(m.finished / m.total * 1000) / 10 : null
      })),
      project_stats: scoreItems.map(si => ({ project_name: si.name, count: projectMap[si.id] || 0 }))
    };
  });
}

function buildPublisherMonthlyStats(publishers, tasks, refYear) {
  const thisYear = refYear || new Date().getFullYear();
  return publishers.map(p => {
    const publisherTasks = tasks.filter(t => Number(t.publisher_id) === Number(p.id));
    const monthlyMap = {};
    for (let m = 1; m <= 12; m++) {
      monthlyMap[m] = { month: CN_MONTHS_SHORT[m - 1], count: 0 };
    }
    for (const task of publisherTasks) {
      const ct = task.create_time ? new Date(task.create_time) : null;
      if (ct && !isNaN(ct.getTime()) && ct.getFullYear() === thisYear) {
        monthlyMap[ct.getMonth() + 1].count += 1;
      }
    }
    return { id: p.id, name: p.name || p.username, publish_count: publisherTasks.length, monthly_stats: Object.values(monthlyMap) };
  });
}

// ==================== 测试 ====================

describe('积分计算', () => {
  const refDate = new Date('2026-05-15T12:00:00');

  describe('buildDesignerStats', () => {
    const users = [{ id: 1, name: '张三', username: 'zhangsan' }];
    const scoreItems = [
      { id: 1, name: '主图设计' },
      { id: 2, name: '详情页' },
    ];

    it('空任务返回零积分', () => {
      const stats = buildDesignerStats(users, [], scoreItems, refDate);
      expect(stats[0].total_score).toBe(0);
      expect(stats[0].finished_count).toBe(0);
      expect(stats[0].total_count).toBe(0);
      expect(stats[0].completion_rate).toBe(0);
    });

    it('正确累加已完成任务积分', () => {
      const tasks = [
        { id: 1, designer_id: 1, status: 'finished', score: 10, actual_quantity: 2, finish_time: '2026-05-10', create_time: '2026-05-01', score_item_id: 1 },
        { id: 2, designer_id: 1, status: 'finished', score: 5, actual_quantity: 1, finish_time: '2026-05-12', create_time: '2026-05-02', score_item_id: 2 },
      ];
      const stats = buildDesignerStats(users, tasks, scoreItems, refDate);
      // 10*2 + 5*1 = 25
      expect(stats[0].total_score).toBe(25);
      expect(stats[0].finished_count).toBe(2);
      expect(stats[0].completion_rate).toBe(100);
    });

    it('积分 = score × actual_quantity', () => {
      const tasks = [
        { id: 1, designer_id: 1, status: 'finished', score: 3, actual_quantity: 5, finish_time: '2026-05-01', create_time: '2026-05-01', score_item_id: 1 },
      ];
      const stats = buildDesignerStats(users, tasks, scoreItems, refDate);
      expect(stats[0].total_score).toBe(15);
    });

    it('actual_quantity 为 0 或缺失时按 1 计算', () => {
      const tasks = [
        { id: 1, designer_id: 1, status: 'finished', score: 10, actual_quantity: 0, finish_time: '2026-05-01', create_time: '2026-05-01', score_item_id: 1 },
        { id: 2, designer_id: 1, status: 'finished', score: 10, finish_time: '2026-05-02', create_time: '2026-05-02', score_item_id: 1 },
      ];
      const stats = buildDesignerStats(users, tasks, scoreItems, refDate);
      // 10*1 + 10*1 = 20
      expect(stats[0].total_score).toBe(20);
    });

    it('未完成的任务不计入积分', () => {
      const tasks = [
        { id: 1, designer_id: 1, status: 'finished', score: 10, actual_quantity: 1, finish_time: '2026-05-01', create_time: '2026-05-01', score_item_id: 1 },
        { id: 2, designer_id: 1, status: 'doing', score: 10, actual_quantity: 1, create_time: '2026-05-05', score_item_id: 1 },
        { id: 3, designer_id: 1, status: 'rejected', score: 10, actual_quantity: 1, create_time: '2026-05-10', score_item_id: 1 },
      ];
      const stats = buildDesignerStats(users, tasks, scoreItems, refDate);
      expect(stats[0].total_score).toBe(10);
      expect(stats[0].finished_count).toBe(1);
      expect(stats[0].total_count).toBe(3);
    });

    it('计算当前月积分（五月）', () => {
      const tasks = [
        { id: 1, designer_id: 1, status: 'finished', score: 10, actual_quantity: 1, finish_time: '2026-05-01', create_time: '2026-05-01', score_item_id: 1 },
        { id: 2, designer_id: 1, status: 'finished', score: 5, actual_quantity: 1, finish_time: '2026-04-20', create_time: '2026-04-20', score_item_id: 1 },
        { id: 3, designer_id: 1, status: 'finished', score: 3, actual_quantity: 1, finish_time: '2026-06-01', create_time: '2026-06-01', score_item_id: 1 },
      ];
      const stats = buildDesignerStats(users, tasks, scoreItems, refDate);
      expect(stats[0].current_month_score).toBe(10); // 只有五月
    });

    it('完成率精确到小数点后一位', () => {
      const tasks = [
        { id: 1, designer_id: 1, status: 'finished', score: 10, actual_quantity: 1, finish_time: '2026-05-01', create_time: '2026-05-01', score_item_id: 1 },
        { id: 2, designer_id: 1, status: 'doing', score: 10, actual_quantity: 1, create_time: '2026-05-02', score_item_id: 1 },
        { id: 3, designer_id: 1, status: 'doing', score: 10, actual_quantity: 1, create_time: '2026-05-03', score_item_id: 1 },
      ];
      const stats = buildDesignerStats(users, tasks, scoreItems, refDate);
      expect(stats[0].completion_rate).toBe(33.3);
    });

    it('正确统计各积分项分布', () => {
      const tasks = [
        { id: 1, designer_id: 1, status: 'finished', score: 10, actual_quantity: 1, finish_time: '2026-05-01', create_time: '2026-05-01', score_item_id: 1 },
        { id: 2, designer_id: 1, status: 'doing', score: 10, actual_quantity: 1, create_time: '2026-05-02', score_item_id: 1 },
        { id: 3, designer_id: 1, status: 'finished', score: 10, actual_quantity: 1, finish_time: '2026-05-03', create_time: '2026-05-03', score_item_id: 2 },
        { id: 4, designer_id: 1, status: 'doing', score: 10, actual_quantity: 1, create_time: '2026-05-04', score_item_id: 2 },
      ];
      const stats = buildDesignerStats(users, tasks, scoreItems, refDate);
      expect(stats[0].project_stats).toEqual([
        { project_name: '主图设计', count: 2 },
        { project_name: '详情页', count: 2 },
      ]);
    });
  });

  describe('buildMonthlyTable', () => {
    it('空数据返回 12 个月均为零', () => {
      const users = [{ id: 1, name: '张三' }];
      const result = buildMonthlyTable(users, []);
      expect(result[0].months).toHaveLength(12);
      expect(result[0].months[0]).toEqual({ month: '1月', published: 0, finished: 0, unsubmitted: 0 });
    });

    it('正确将月度数据填入对应月份', () => {
      const users = [{ id: 1, name: '张三' }];
      const rawData = [
        { designer_id: 1, month: 5, published: 10, finished: 8, unsubmitted: 2 },
        { designer_id: 1, month: 6, published: 15, finished: 12, unsubmitted: 3 },
      ];
      const result = buildMonthlyTable(users, rawData);
      expect(result[0].months[4]).toEqual({ month: '5月', published: 10, finished: 8, unsubmitted: 2 });
      expect(result[0].months[5]).toEqual({ month: '6月', published: 15, finished: 12, unsubmitted: 3 });
      expect(result[0].months[0]).toEqual({ month: '1月', published: 0, finished: 0, unsubmitted: 0 });
    });
  });

  describe('buildPublisherMonthlyStats', () => {
    it('按创建时间统计每月发布量', () => {
      const publishers = [{ id: 1, name: '运营A' }];
      const tasks = [
        { id: 1, publisher_id: 1, create_time: new Date('2026-05-01') },
        { id: 2, publisher_id: 1, create_time: new Date('2026-05-15') },
        { id: 3, publisher_id: 1, create_time: new Date('2026-06-01') },
        { id: 4, publisher_id: 2, create_time: new Date('2026-05-01') },
      ];
      const result = buildPublisherMonthlyStats(publishers, tasks, 2026);
      expect(result[0].publish_count).toBe(3);
      expect(result[0].monthly_stats[4].count).toBe(2); // 五月
      expect(result[0].monthly_stats[5].count).toBe(1); // 六月
    });
  });
});
