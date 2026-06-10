/**
 * 通知模块路由 - 站内通知/桌面通知
 */

const express = require('express');
const router = express.Router();
const { execute } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { createLogMiddleware } = require('../utils/operLog');

/**
 * GET /api/notification/list - 获取用户通知列表
 */
router.get('/list', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const offset = (page - 1) * pageSize;
    const unreadOnly = req.query.unreadOnly === 'true';

    let whereSql = 'WHERE user_id = ?';
    const params = [userId];
    if (unreadOnly) {
      whereSql += ' AND is_read = 0';
    }

    const [countResult] = await execute(
      `SELECT COUNT(*) as total FROM sys_notification ${whereSql}`, params
    );
    const total = countResult?.total || 0;

    const [rows] = await execute(
      `SELECT * FROM sys_notification ${whereSql} ORDER BY create_time DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    res.json({ code: 0, data: { list: rows || [], total } });
  } catch (err) {
    console.error('[Notification] 列表查询失败:', err);
    res.status(500).json({ code: 500, msg: '查询通知失败' });
  }
});

/**
 * POST /api/notification/read - 标记已读
 */
router.post('/read', requireAuth, createLogMiddleware('标记通知已读', '通知中心'), async (req, res) => {
  try {
    const { id, all } = req.body;
    if (all) {
      await execute(
        `UPDATE sys_notification SET is_read = 1 WHERE user_id = ?`,
        [req.user.id]
      );
    } else if (id) {
      await execute(
        `UPDATE sys_notification SET is_read = 1 WHERE id = ? AND user_id = ?`,
        [id, req.user.id]
      );
    }
    res.json({ code: 0, msg: '已标记已读' });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '操作失败' });
  }
});

/**
 * POST /api/notification/delete - 删除通知
 */
router.post('/delete', requireAuth, createLogMiddleware('删除通知', '通知中心'), async (req, res) => {
  try {
    const { id, all } = req.body;
    if (all) {
      await execute(
        `DELETE FROM sys_notification WHERE user_id = ?`,
        [req.user.id]
      );
    } else if (id) {
      await execute(
        `DELETE FROM sys_notification WHERE id = ? AND user_id = ?`,
        [id, req.user.id]
      );
    }
    res.json({ code: 0, msg: '删除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '删除失败' });
  }
});

/**
 * GET /api/notification/unread-count - 未读数量
 */
router.get('/unread-count', requireAuth, async (req, res) => {
  try {
    const [result] = await execute(
      `SELECT COUNT(*) as count FROM sys_notification WHERE user_id = ? AND is_read = 0`,
      [req.user.id]
    );
    res.json({ code: 0, data: { count: result?.count || 0 } });
  } catch (err) {
    res.json({ code: 0, data: { count: 0 } });
  }
});

/**
 * POST /api/notification/urge - 催促提醒（客服/运营均可使用）
 */
router.post('/urge', requireAuth, createLogMiddleware('催促任务', '通知中心'), async (req, res) => {
  try {
    const { taskId, taskTitle, designerId } = req.body;
    if (!taskId || !designerId) return res.json({ code: 400, msg: '参数不完整' });
    const senderName = req.user.realName || req.user.username
    const content = `${senderName} 催促您尽快完成任务「${taskTitle}」`
    const [updateResult] = await execute(
      `UPDATE task_info
       SET urge_time = NOW(), update_time = NOW()
       WHERE id = ? AND designer_id = ? AND status = 'accepted'`,
      [taskId, designerId]
    );
    if (!updateResult || updateResult.affectedRows === 0) {
      return res.json({ code: 400, msg: '仅待做任务可以催促置顶' });
    }
    await execute(
      `INSERT INTO sys_notification (user_id, type, title, content, task_id)
       VALUES (?, 'task_urge', '任务催促提醒', ?, ?)`,
      [designerId, content, taskId]
    );
    // WebSocket 实时推送通知到目标用户
    if (global.io) {
      console.log(`[Urge] 发送催促通知 → userId=${designerId}, taskId=${taskId}, taskTitle=${taskTitle}`)
      global.io.to(`user:${designerId}`).emit('notification:new', {
        type: 'urge',
        taskId,
        taskTitle,
        title: '任务催促提醒',
        content
      });
      global.io.to(`user:${designerId}`).emit('task:update');
    }
    res.json({ code: 0, msg: '催促已发送' });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '操作失败' });
  }
});

module.exports = router;
