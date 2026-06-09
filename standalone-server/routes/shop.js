/**
 * 店铺管理路由
 */
const express = require('express');
const router = express.Router();
const { getPool } = require('../config/database');
const { requireAuth, requireAnyPermission } = require('../middleware/auth');

router.use(requireAuth);

// 获取店铺列表（所有登录用户可访问）
router.get('/list', async (req, res, next) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT id, name, sort_order, create_time FROM sys_shop ORDER BY sort_order ASC, id ASC'
    );
    res.json({ code: 0, msg: '查询成功', data: rows });
  } catch (err) { next(err); }
});

// 创建店铺（管理员）
router.post('/create', requireAnyPermission(['admin.config'], 'admin'), async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.json({ code: 400, msg: '店铺名称不能为空' });
    const pool = getPool();
    const [exists] = await pool.execute('SELECT id FROM sys_shop WHERE name = ?', [name]);
    if (exists.length > 0) return res.json({ code: 400, msg: '店铺名称已存在' });
    const [result] = await pool.execute('INSERT INTO sys_shop (name) VALUES (?)', [name]);
    res.json({ code: 0, msg: '店铺创建成功', data: { id: result.insertId } });
  } catch (err) { next(err); }
});

// 更新店铺（管理员）
router.put('/update', requireAnyPermission(['admin.config'], 'admin'), async (req, res, next) => {
  try {
    const { id, name } = req.body;
    if (!id) return res.json({ code: 400, msg: '缺少店铺ID' });
    if (!name) return res.json({ code: 400, msg: '店铺名称不能为空' });
    const pool = getPool();
    const [exists] = await pool.execute('SELECT id FROM sys_shop WHERE name = ? AND id != ?', [name, id]);
    if (exists.length > 0) return res.json({ code: 400, msg: '店铺名称已存在' });
    await pool.execute('UPDATE sys_shop SET name = ? WHERE id = ?', [name, id]);
    res.json({ code: 0, msg: '店铺更新成功' });
  } catch (err) { next(err); }
});

// 删除店铺（管理员）
router.delete('/delete', requireAnyPermission(['admin.config'], 'admin'), async (req, res, next) => {
  try {
    const { id } = req.body;
    if (!id) return res.json({ code: 400, msg: '缺少店铺ID' });
    const pool = getPool();
    // 检查是否有运营人员关联此店铺
    const [users] = await pool.execute('SELECT COUNT(*) as cnt FROM sys_user WHERE store = (SELECT name FROM sys_shop WHERE id = ?) AND role = "operator" AND status = 1', [id]);
    if (users[0].cnt > 0) return res.json({ code: 400, msg: '该店铺下有运营人员，无法删除' });
    await pool.execute('DELETE FROM sys_shop WHERE id = ?', [id]);
    res.json({ code: 0, msg: '店铺已删除' });
  } catch (err) { next(err); }
});

module.exports = router;
