/**
 * 系统配置模块路由 - 仅admin可操作
 */

const express = require('express');
const router = express.Router();

const { getPool } = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { initStorageConfig } = require('../utils/share');

router.use(requireAuth);

/**
 * GET /api/config/list - 获取所有配置
 */
router.get('/list', async (req, res, next) => {
  try {
    const { group } = req.query;
    const pool = getPool();

    let sql = 'SELECT * FROM sys_config';
    const params = [];

    if (group) {
      sql += ' WHERE config_group = ?';
      params.push(group);
    }

    sql += ' ORDER BY config_group ASC, id ASC';

    const [rows] = await pool.execute(sql, params);
    res.json({ code: 0, msg: '查询成功', data: rows });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/config/update - 更新配置
 */
router.put('/update', requireRole('admin'), async (req, res, next) => {
  try {
    const { id, configValue } = req.body;

    if (!id || configValue === undefined) {
      return res.json({ code: 400, msg: '参数不完整' });
    }

    const pool = getPool();

    // 检查是否可编辑
    const [configs] = await pool.execute(
      `SELECT id, config_key, editable FROM sys_config WHERE id = ?`,
      [id]
    );

    if (configs.length === 0) {
      return res.json({ code: 400, msg: '配置不存在' });
    }

    if (configs[0].editable === 0) {
      return res.json({ code: 400, msg: '该配置不可编辑' });
    }

    await pool.execute(
      `UPDATE sys_config SET config_value = ? WHERE id = ?`,
      [configValue, id]
    );

    // 如果修改的是上传目录相关配置，刷新内存缓存
    if (configs[0].config_key && configs[0].config_key.startsWith('upload.')) {
      await initStorageConfig(pool);
    }

    res.json({ code: 0, msg: '更新成功' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/config/get-value - 获取单个配置值（根据key）
 */
router.get('/get-value', async (req, res, next) => {
  try {
    const { key } = req.query;

    if (!key) {
      return res.json({ code: 400, msg: '配置键不能为空' });
    }

    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT config_value FROM sys_config WHERE config_key = ?`,
      [key]
    );

    if (rows.length === 0) {
      return res.json({ code: 400, msg: '配置不存在' });
    }

    res.json({ code: 0, msg: '查询成功', data: rows[0].config_value });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/config/delete - 删除配置（仅超级管理员）
 */
router.post('/delete', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.body;
    if (!id) return res.json({ code: 400, msg: '参数不完整' });
    const pool = getPool();
    await pool.execute('DELETE FROM sys_config WHERE id = ?', [id]);
    res.json({ code: 0, msg: '删除成功' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
