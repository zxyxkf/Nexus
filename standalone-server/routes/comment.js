/**
 * 评论模块路由 - 任务沟通留言
 */

const express = require('express');
const router = express.Router();
const { execute } = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { notifyTaskEvent } = require('../utils/notification');

/**
 * GET /api/comment/list - 获取任务评论列表
 */
router.get('/list', requireAuth, async (req, res) => {
  try {
    const taskId = req.query.taskId;
    if (!taskId) return res.json({ code: 400, msg: '缺少taskId' });

    const [rows] = await execute(
      `SELECT * FROM sys_comment WHERE task_id = ? AND is_deleted = 0 ORDER BY create_time ASC`,
      [taskId]
    );
    res.json({ code: 0, data: rows || [] });
  } catch (err) {
    console.error('[Comment] 列表查询失败:', err);
    res.status(500).json({ code: 500, msg: '查询评论失败' });
  }
});

/**
 * POST /api/comment/create - 添加评论
 */
router.post('/create', requireAuth, async (req, res) => {
  try {
    const { taskId, content, images } = req.body;
    if (!taskId || !content?.trim()) {
      return res.json({ code: 400, msg: '参数不完整' });
    }

    await execute(
      `INSERT INTO sys_comment (task_id, user_id, username, real_name, role, content, images)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [taskId, req.user.id, req.user.username, req.user.realName || '', req.user.role, content.trim(), images || '']
    );

    const [tasks] = await execute(
      `SELECT id, title, task_no, publisher_id, designer_id, task_group FROM task_info WHERE id = ?`,
      [taskId]
    );
    if (tasks[0]) await notifyTaskEvent('task_comment', tasks[0], req.user);

    res.json({ code: 0, msg: '评论成功' });
  } catch (err) {
    console.error('[Comment] 创建失败:', err);
    res.status(500).json({ code: 500, msg: '评论失败' });
  }
});

/**
 * POST /api/comment/delete - 删除评论(管理员)
 */
router.post('/delete', requireAdmin, async (req, res) => {
  try {
    const { id } = req.body;
    if (!id) return res.json({ code: 400, msg: '缺少id' });

    await execute(`UPDATE sys_comment SET is_deleted = 1 WHERE id = ?`, [id]);
    res.json({ code: 0, msg: '删除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '删除失败' });
  }
});

module.exports = router;
