/**
 * 操作日志模块路由 - 仅admin可查看
 */

const express = require('express');
const router = express.Router();

const { getPool } = require('../config/database');
const { requireAuth, requireAnyPermission } = require('../middleware/auth');

router.use(requireAuth, requireAnyPermission(['admin.logs'], 'admin'));

/**
 * GET /api/log/list - 分页查询操作日志
 */
router.get('/list', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 20, operation, username, startDate, endDate, sortField, sortOrder } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let whereSql = 'WHERE 1=1';
    const params = [];

    if (operation) {
      whereSql += ' AND l.operation = ?';
      params.push(operation);
    }
    if (username) {
      whereSql += ' AND l.username LIKE ?';
      params.push(`%${username}%`);
    }
    if (startDate) {
      whereSql += ' AND l.create_time >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereSql += ' AND l.create_time <= ?';
      params.push(endDate + ' 23:59:59');
    }

    const LOG_SORT_COLUMNS = { create_time: 'l.create_time', username: 'l.username', role: 'l.role' };
    const orderColumn = LOG_SORT_COLUMNS[sortField] || 'l.create_time';
    const direction = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const pool = getPool();

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM sys_oper_log l ${whereSql}`,
      params
    );

    const [rows] = await pool.execute(
      `SELECT * FROM sys_oper_log l ${whereSql}
       ORDER BY ${orderColumn} ${direction}, l.id ${direction}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );

    res.json({
      code: 0,
      msg: '查询成功',
      data: {
        list: rows,
        total: countResult[0].total,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        totalPages: Math.ceil(countResult[0].total / parseInt(pageSize))
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/log/operations - 获取操作类型列表（用于筛选）
 */
router.get('/operations', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT DISTINCT operation FROM sys_oper_log ORDER BY operation ASC`
    );
    res.json({ code: 0, msg: '查询成功', data: rows.map(r => r.operation) });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/log/batch-delete - 批量删除操作日志（仅超级管理员）
 */
router.post('/batch-delete', requireAnyPermission(['admin.logs'], 'admin'), async (req, res, next) => {
  try {
    const { logIds } = req.body;

    if (!logIds || !Array.isArray(logIds) || logIds.length === 0) {
      return res.json({ code: 400, msg: '请选择要删除的日志' });
    }

    const pool = getPool();
    const placeholders = logIds.map(() => '?').join(',');
    const [result] = await pool.execute(
      `DELETE FROM sys_oper_log WHERE id IN (${placeholders})`,
      logIds
    );

    res.json({
      code: 0,
      msg: `成功删除 ${result.affectedRows} 条日志`,
      data: { deleted: result.affectedRows }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
