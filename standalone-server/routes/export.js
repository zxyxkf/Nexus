/**
 * 数据导出模块路由 - Excel 导出
 */

const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { execute } = require('../config/database');
const { requireAuth, requireAnyPermission } = require('../middleware/auth');
const taskService = require('../services/task.service');
const { defaultPermissionsFor } = require('../config/permissions');
const { hasPermission, allowedAllTaskGroups, taskGroupSqlExpr } = require('../utils/task-permissions');

router.use(requireAuth);

function sendExcel(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
  return workbook.xlsx.writeBuffer().then(buf => res.send(Buffer.from(buf)));
}

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

const ROLE_LABELS = {
  admin: '超级管理员',
  sub_admin: '子管理员',
  operator: '运营',
  cs_agent: '客服',
  designer: '美工设计师',
  basic_designer: '基础美工',
  operator_assistant: '运营助理'
};

function roleLabel(role) {
  return ROLE_LABELS[role] || role || '-';
}

function allowedDashboardGroups(user) {
  const rawPermissions = user?.hasPermissionClaim
    ? (Array.isArray(user?.permissions) ? user.permissions : [])
    : defaultPermissionsFor(user?.role, user?.isTeamLead || user?.is_team_lead);
  const permissions = new Set(rawPermissions);
  const allowed = [];
  if (user?.role === 'admin' || permissions.has('*') || permissions.has('dashboard.design')) allowed.push('design');
  if (user?.role === 'admin' || permissions.has('*') || permissions.has('dashboard.operator')) allowed.push('operator');
  if (user?.role === 'admin' || permissions.has('*') || permissions.has('dashboard.cs')) allowed.push('cs');
  return allowed;
}

function addSheet(workbook, name, columns, rows) {
  if (!columns || columns.length === 0) return null;
  const sheet = workbook.addWorksheet(name.slice(0, 31));
  sheet.columns = columns;
  (rows || []).forEach(row => sheet.addRow(row));
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return sheet;
}

function monthlyRows(items, nameKey, nameHeader, valueKey = 'score') {
  return (items || []).map(item => {
    const row = { name: item.name || item.username || '' };
    for (const m of MONTHS) row[m] = 0;
    for (const stat of item.monthly_stats || []) {
      row[stat.month] = Number(stat[valueKey]) || 0;
    }
    return row;
  });
}

function publisherMonthlyRows(items, valueKey = 'count') {
  return (items || []).map(item => {
    const row = {
      name: item.name || item.username || '',
      role: roleLabel(item.role)
    };
    for (const m of MONTHS) row[m] = 0;
    for (const stat of item.monthly_stats || []) {
      row[stat.month] = Number(stat[valueKey]) || 0;
    }
    return row;
  });
}

function dailyRows(items) {
  items = items || [];
  const now = new Date();
  const dayCount = (items?.[0]?.daily_stats || []).length || new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const columns = [{ header: '姓名', key: 'name', width: 16 }];
  for (let day = 1; day <= dayCount; day++) {
    columns.push({ header: `${day}日(完成/待审)`, key: `d${day}`, width: 14 });
  }
  const rows = items.map(item => {
    const row = { name: item.name || '' };
    for (const stat of item.daily_stats || []) {
      row[`d${stat.day}`] = `${stat.finished_score || 0} / ${stat.pending_review_score || 0}`;
    }
    return row;
  });
  return { columns, rows };
}

function projectRows(items) {
  const names = [];
  const seen = new Set();
  for (const item of items || []) {
    for (const stat of item.project_stats || []) {
      if (stat.project_name && !seen.has(stat.project_name)) {
        seen.add(stat.project_name);
        names.push(stat.project_name);
      }
    }
  }
  const columns = [{ header: '美工', key: 'name', width: 16 }, ...names.map(name => ({ header: name, key: name, width: 18 }))];
  const rows = (items || []).map(item => {
    const row = { name: item.name || '' };
    names.forEach(name => { row[name] = 0; });
    for (const stat of item.project_stats || []) row[stat.project_name] = stat.count || 0;
    return row;
  });
  return { columns, rows };
}

function addDesignerSummarySheet(workbook, sheetName, nameHeader, rows) {
  addSheet(workbook, sheetName, [
    { header: nameHeader, key: 'name', width: 16 },
    { header: '总积分', key: 'total_score', width: 12 },
    { header: '当月积分', key: 'current_month_score', width: 12 },
    { header: '今日积分', key: 'today_score', width: 12 },
    { header: '昨日积分', key: 'yesterday_score', width: 12 },
    { header: '已完成', key: 'finished_count', width: 12 },
    { header: '总任务', key: 'total_count', width: 12 },
    { header: '完成率', key: 'completion_rate', width: 12 }
  ], rows || []);
}

function addMonthlySheet(workbook, sheetName, nameHeader, rows) {
  addSheet(workbook, sheetName, [
    { header: nameHeader, key: 'name', width: 16 },
    ...MONTHS.map(m => ({ header: m, key: m, width: 10 }))
  ], rows);
}

function addPublisherMonthlySheet(workbook, sheetName, rows) {
  addSheet(workbook, sheetName, [
    { header: '发布人', key: 'name', width: 16 },
    { header: '角色', key: 'role', width: 14 },
    ...MONTHS.map(m => ({ header: m, key: m, width: 10 }))
  ], rows);
}

/**
 * GET /api/export/tasks - 导出任务列表
 */
router.get('/tasks', async (req, res) => {
  try {
    const { keyword, status, taskGroup, publisherId, designerId, startDate, endDate, taskIds } = req.query;
    let sql = `SELECT * FROM task_info t WHERE 1=1`;
    const params = [];
    const canViewAll = hasPermission(req.user, 'task.view.all');
    const allTaskGroups = allowedAllTaskGroups(req.user);

    if (taskIds) {
      const ids = String(taskIds).split(',').map(v => Number(v)).filter(Boolean);
      if (ids.length) {
        sql += ` AND id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    }
    if (req.user.role !== 'admin' && !canViewAll) {
      const accessParts = ['(publisher_id = ? OR designer_id = ?)'];
      params.push(req.user.id, req.user.id);
      if (allTaskGroups.length) {
        accessParts.push(`${taskGroupSqlExpr('t')} IN (${allTaskGroups.map(() => '?').join(',')})`);
        params.push(...allTaskGroups);
      }
      sql += ` AND (${accessParts.join(' OR ')})`;
    }
    if (keyword) { sql += ` AND (title LIKE ? OR task_no LIKE ?)`; params.push(`%${keyword}%`, `%${keyword}%`); }
    if (status) { sql += ` AND status = ?`; params.push(status); }
    if (taskGroup) {
      if (taskGroup === 'design') sql += ` AND (task_group = ? OR task_group IS NULL OR task_group = '')`;
      else sql += ` AND task_group = ?`;
      params.push(taskGroup);
    }
    if (publisherId) { sql += ` AND publisher_id = ?`; params.push(publisherId); }
    if (designerId) { sql += ` AND designer_id = ?`; params.push(designerId); }
    if (startDate) { sql += ` AND create_time >= ?`; params.push(`${startDate} 00:00:00`); }
    if (endDate) { sql += ` AND create_time <= ?`; params.push(`${endDate} 23:59:59`); }
    sql += ` ORDER BY create_time DESC`;

    const [rows] = await execute(sql, params);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('任务列表');

    sheet.columns = [
      { header: '任务编号', key: 'task_no', width: 20 },
      { header: '任务标题', key: 'title', width: 40 },
      { header: '发布人', key: 'publisher_name', width: 15 },
      { header: '接单美工', key: 'designer_name', width: 15 },
      { header: '状态', key: 'status', width: 12 },
      { header: '款号', key: 'style_number', width: 15 },
      { header: '指定颜色', key: 'specified_color', width: 12 },
      { header: '发布时间', key: 'create_time', width: 20 },
      { header: '完成时间', key: 'finish_time', width: 20 }
    ];

    const statusMap = { wait: '待接单', accepted: '已接单', doing: '作图中', finished: '已完成', rejected: '已驳回' };

    rows.forEach(row => {
      sheet.addRow({
        task_no: row.task_no,
        title: row.title,
        publisher_name: row.publisher_name,
        designer_name: row.designer_name || '',
        status: statusMap[row.status] || row.status,
        style_number: row.style_number || '',
        specified_color: row.specified_color || '',
        create_time: row.create_time,
        finish_time: row.finish_time || ''
      });
    });

    // 状态列着色
    const statusColors = { wait: 'FFE0E0E0', accepted: 'FFFFF3CD', doing: 'FFCCE5FF', finished: 'FFD4EDDA', rejected: 'FFF8D7DA' };
    sheet.eachRow((row, rowIdx) => {
      if (rowIdx > 1) {
        const statusCell = row.getCell(5);
        const color = statusColors[rows[rowIdx - 2]?.status];
        if (color) statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
      }
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    await sendExcel(res, workbook, `任务列表_${dateStr}.xlsx`);
  } catch (err) {
    console.error('[Export] 任务导出失败:', err.message);
    res.status(500).json({ code: 500, msg: '导出失败: ' + err.message });
  }
});

/**
 * GET /api/export/logs - 导出操作日志
 */
router.get('/logs', async (req, res) => {
  try {
    const { username, operation, startDate, endDate } = req.query;
    let sql = `SELECT * FROM sys_oper_log WHERE 1=1`;
    const params = [];

    if (username) { sql += ` AND username = ?`; params.push(username); }
    if (operation) { sql += ` AND operation = ?`; params.push(operation); }
    if (startDate) { sql += ` AND create_time >= ?`; params.push(startDate); }
    if (endDate) { sql += ` AND create_time <= ?`; params.push(endDate); }
    sql += ` ORDER BY create_time DESC`;

    const [rows] = await execute(sql, params);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('操作日志');

    sheet.columns = [
      { header: '用户', key: 'username', width: 15 },
      { header: '操作', key: 'operation', width: 20 },
      { header: '模块', key: 'module', width: 15 },
      { header: '结果', key: 'result_code', width: 10 },
      { header: '报错信息', key: 'error_msg', width: 40 },
      { header: '耗时(ms)', key: 'cost_time', width: 12 },
      { header: 'IP', key: 'ip_addr', width: 18 },
      { header: '时间', key: 'create_time', width: 22 }
    ];

    rows.forEach(row => {
      sheet.addRow({
        username: row.username,
        operation: row.operation,
        module: row.module,
        result_code: row.result_code === 0 ? '成功' : '失败',
        error_msg: row.error_msg || '',
        cost_time: row.cost_time,
        ip_addr: row.ip_addr,
        create_time: row.create_time
      });
    });

    const dateStr = new Date().toISOString().slice(0, 10);
    await sendExcel(res, workbook, `操作日志_${dateStr}.xlsx`);
  } catch (err) {
    console.error('[Export] 日志导出失败:', err.message);
    res.status(500).json({ code: 500, msg: '导出失败: ' + err.message });
  }
});

/**
 * GET /api/export/dashboard - 导出 Dashboard 报表
 */
router.get('/dashboard', requireAnyPermission(['dashboard.design', 'dashboard.operator', 'dashboard.cs'], 'admin', 'sub_admin', 'designer', 'basic_designer', 'operator_assistant', 'operator', 'cs_agent'), async (req, res) => {
  try {
    const requestedGroups = String(req.query.groups || 'design,operator,cs')
      .split(',')
      .map(g => g.trim())
      .filter(g => ['design', 'operator', 'cs'].includes(g));
    const allowedGroups = allowedDashboardGroups(req.user);
    const groups = (requestedGroups.length ? requestedGroups : allowedGroups)
      .filter(group => allowedGroups.includes(group));
    const detailStats = await taskService.getAdminDetailStats(req.user);
    const workbook = new ExcelJS.Workbook();

    if (groups.includes('design')) {
      addDesignerSummarySheet(workbook, '美工综合统计', '美工', detailStats.designerStats);
      addMonthlySheet(workbook, '美工月度积分明细', '美工', monthlyRows(detailStats.designerStats));
      const daily = dailyRows(detailStats.designerDailyStats);
      addSheet(workbook, '美工日统计', daily.columns, daily.rows);
      const projects = projectRows(detailStats.designerStats);
      addSheet(workbook, '项目类型完成统计', projects.columns, projects.rows);
      addPublisherMonthlySheet(workbook, '发布人统计', publisherMonthlyRows(detailStats.operatorStats));
    }

    if (groups.includes('operator')) {
      addDesignerSummarySheet(workbook, '助理综合统计', '助理', detailStats.operatorAssistantStats);
      addMonthlySheet(workbook, '运营助理月度积分明细', '助理', monthlyRows(detailStats.operatorAssistantStats));
      const daily = dailyRows(detailStats.operatorAssistantDailyStats);
      addSheet(workbook, '运营助理日统计', daily.columns, daily.rows);
      addPublisherMonthlySheet(workbook, '运营助理发布人统计', publisherMonthlyRows(detailStats.operatorPublishStats));
    }

    if (groups.includes('cs')) {
      addDesignerSummarySheet(workbook, '基础美工综合统计', '基础美工', detailStats.basicDesignerStats);
      const daily = dailyRows(detailStats.basicDesignerDailyStats);
      addSheet(workbook, '基础美工日统计', daily.columns, daily.rows);
      addPublisherMonthlySheet(workbook, '基础美工发布人统计', publisherMonthlyRows(detailStats.csAgentStats));
    }

    if (workbook.worksheets.length === 0) {
      const sheet = workbook.addWorksheet('暂无数据');
      sheet.addRow(['当前仪表盘分区暂无可导出的表格数据']);
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    await sendExcel(res, workbook, `仪表盘表格_${dateStr}.xlsx`);
  } catch (err) {
    console.error('[Export] 报表导出失败:', err.message);
    res.status(500).json({ code: 500, msg: '导出失败: ' + err.message });
  }
});

module.exports = router;
