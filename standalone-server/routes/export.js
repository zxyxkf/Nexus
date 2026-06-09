/**
 * 数据导出模块路由 - Excel 导出
 */

const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const { execute } = require('../config/database');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

function sendExcel(res, workbook, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(filename)}`);
  return workbook.xlsx.writeBuffer().then(buf => res.send(Buffer.from(buf)));
}

/**
 * GET /api/export/tasks - 导出任务列表
 */
router.get('/tasks', async (req, res) => {
  try {
    const { keyword, status, taskGroup, publisherId, designerId, startDate, endDate, taskIds } = req.query;
    let sql = `SELECT * FROM task_info WHERE 1=1`;
    const params = [];

    if (taskIds) {
      const ids = String(taskIds).split(',').map(v => Number(v)).filter(Boolean);
      if (ids.length) {
        sql += ` AND id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
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
router.get('/dashboard', async (req, res) => {
  try {
    const [tasks] = await execute(`SELECT status, COUNT(*) as cnt FROM task_info GROUP BY status`);
    const [users] = await execute(`SELECT role, COUNT(*) as cnt FROM sys_user GROUP BY role`);

    const workbook = new ExcelJS.Workbook();

    // 统计概览
    const sheet = workbook.addWorksheet('统计概览');
    sheet.addRow(['指标', '数值']);
    sheet.addRow(['任务总数', tasks.reduce((s, t) => s + t.cnt, 0)]);
    const statusMap = { wait: '待接单', accepted: '已接单', doing: '作图中', finished: '已完成', rejected: '已驳回' };
    tasks.forEach(t => sheet.addRow([`${statusMap[t.status] || t.status}`, t.cnt]));
    sheet.addRow([]);
    sheet.addRow(['用户统计']);
    const roleMap = { admin: '管理员', operator: '运营', designer: '美工', basic_designer: '基础美工', cs_agent: '客服', sub_admin: '子管理员' };
    users.forEach(u => sheet.addRow([`${roleMap[u.role] || u.role}`, u.cnt]));
    sheet.getColumn(1).width = 20;
    sheet.getColumn(2).width = 15;

    const dateStr = new Date().toISOString().slice(0, 10);
    await sendExcel(res, workbook, `统计报表_${dateStr}.xlsx`);
  } catch (err) {
    console.error('[Export] 报表导出失败:', err.message);
    res.status(500).json({ code: 500, msg: '导出失败: ' + err.message });
  }
});

module.exports = router;
