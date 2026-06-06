/**
 * 全局公告路由
 */
const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth);

/**
 * GET /api/announcement/active - 获取当前活跃公告（所有登录用户可访问）
 */
router.get('/active', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT id, title, content, create_time FROM sys_announcement WHERE is_active = 1 ORDER BY update_time DESC LIMIT 1'
    );
    res.json({ code: 0, msg: '查询成功', data: rows[0] || null });
  } catch (err) { next(err); }
});

/**
 * GET /api/announcement/list - 公告列表（管理员）
 */
router.get('/list', requireRole('admin'), async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT a.*, u.real_name AS creator_name FROM sys_announcement a LEFT JOIN sys_user u ON a.created_by = u.id ORDER BY a.create_time DESC'
    );
    res.json({ code: 0, msg: '查询成功', data: rows });
  } catch (err) { next(err); }
});

/**
 * POST /api/announcement/create - 创建公告（管理员）
 */
router.post('/create', requireRole('admin'), async (req, res, next) => {
  try {
    const { title, content, isActive } = req.body;
    if (!title || !content) {
      return res.json({ code: 400, msg: '标题和内容不能为空' });
    }
    const pool = getPool();
    const userId = req.user?.id;

    // 如果设为活跃，先把其他公告置为不活跃
    if (isActive) {
      await pool.execute('UPDATE sys_announcement SET is_active = 0');
    }

    const [result] = await pool.execute(
      'INSERT INTO sys_announcement (title, content, is_active, created_by) VALUES (?, ?, ?, ?)',
      [title, content, isActive ? 1 : 0, userId]
    );
    res.json({ code: 0, msg: '公告创建成功', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

/**
 * PUT /api/announcement/update - 更新公告（管理员）
 */
router.put('/update', requireRole('admin'), async (req, res, next) => {
  try {
    const { id, title, content, isActive } = req.body;
    if (!id) return res.json({ code: 400, msg: '缺少公告ID' });

    const pool = getPool();

    // 如果设为活跃，先把其他公告置为不活跃
    if (isActive) {
      await pool.execute('UPDATE sys_announcement SET is_active = 0');
    }

    await pool.execute(
      'UPDATE sys_announcement SET title = ?, content = ?, is_active = ? WHERE id = ?',
      [title, content, isActive ? 1 : 0, id]
    );
    res.json({ code: 0, msg: '公告更新成功' });
  } catch (err) { next(err); }
});

/**
 * DELETE /api/announcement/delete - 删除公告（管理员）
 */
router.delete('/delete', requireRole('admin'), async (req, res, next) => {
  try {
    const { id } = req.body;
    if (!id) return res.json({ code: 400, msg: '缺少公告ID' });
    const pool = getPool();
    await pool.execute('DELETE FROM sys_announcement WHERE id = ?', [id]);
    res.json({ code: 0, msg: '公告已删除' });
  } catch (err) { next(err); }
});

module.exports = router;
