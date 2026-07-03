/**
 * 通知模块路由 - 站内通知/桌面通知
 */

const express = require('express');
const router = express.Router();
const { execute } = require('../config/database');
const { requireAuth } = require('../middleware/auth');
const { createLogMiddleware } = require('../utils/operLog');

const HIGH_PRIORITY_TYPES = ['task_urge', 'task_reject', 'task_transfer', 'score_review', 'score_reject'];
const MEDIUM_PRIORITY_TYPES = ['task_submit', 'task_review', 'task_assigned'];
const LOW_PRIORITY_TYPES = ['task_accept', 'task_comment', 'system'];
const KNOWN_TYPES = new Set([...HIGH_PRIORITY_TYPES, ...MEDIUM_PRIORITY_TYPES, ...LOW_PRIORITY_TYPES]);
const TYPE_ALIASES = {
  task_submitted: 'task_submit'
};

function priorityCaseSql(alias = '') {
  const col = alias ? `${alias}.type` : 'type';
  const high = HIGH_PRIORITY_TYPES.map(() => '?').join(',');
  const medium = MEDIUM_PRIORITY_TYPES.map(() => '?').join(',');
  return `CASE WHEN ${col} IN (${high}) THEN 3 WHEN ${col} IN (${medium}) THEN 2 ELSE 1 END`;
}

function enrichNotification(row) {
  const type = row.type || 'system';
  const priority = HIGH_PRIORITY_TYPES.includes(type) ? 3 : MEDIUM_PRIORITY_TYPES.includes(type) ? 2 : 1;
  return {
    ...row,
    priority,
    priority_label: priority === 3 ? '重要' : priority === 2 ? '一般' : '普通'
  };
}

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
    const rawType = String(req.query.type || '').trim();
    const type = TYPE_ALIASES[rawType] || rawType;
    const priority = String(req.query.priority || '').trim();

    let whereSql = 'WHERE user_id = ?';
    const params = [userId];
    if (unreadOnly) {
      whereSql += ' AND is_read = 0';
    }
    if (type && KNOWN_TYPES.has(type)) {
      whereSql += ' AND type = ?';
      params.push(type);
    }
    if (priority === 'high') {
      whereSql += ` AND type IN (${HIGH_PRIORITY_TYPES.map(() => '?').join(',')})`;
      params.push(...HIGH_PRIORITY_TYPES);
    } else if (priority === 'medium') {
      whereSql += ` AND type IN (${MEDIUM_PRIORITY_TYPES.map(() => '?').join(',')})`;
      params.push(...MEDIUM_PRIORITY_TYPES);
    } else if (priority === 'low') {
      whereSql += ` AND (type IN (${LOW_PRIORITY_TYPES.map(() => '?').join(',')}) OR type IS NULL OR type = '')`;
      params.push(...LOW_PRIORITY_TYPES);
    }

    const [countRows] = await execute(
      `SELECT COUNT(*) as total FROM sys_notification ${whereSql}`, params
    );
    const total = Number(countRows?.[0]?.total || 0);

    const prioritySql = priorityCaseSql();
    const priorityParams = [...HIGH_PRIORITY_TYPES, ...MEDIUM_PRIORITY_TYPES];
    const [rows] = await execute(
      `SELECT * FROM sys_notification ${whereSql}
       ORDER BY is_read ASC, ${prioritySql} DESC, create_time DESC
       LIMIT ? OFFSET ?`,
      [...params, ...priorityParams, pageSize, offset]
    );

    res.json({ code: 0, data: { list: (rows || []).map(enrichNotification), total } });
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
    const [rows] = await execute(
      `SELECT COUNT(*) as count FROM sys_notification WHERE user_id = ? AND is_read = 0`,
      [req.user.id]
    );
    res.json({ code: 0, data: { count: Number(rows?.[0]?.count || 0) } });
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
    const [taskRows] = await execute(
      `SELECT task_group, publisher_id, designer_id, title FROM task_info WHERE id = ?`,
      [taskId]
    );
    const taskInfo = taskRows && taskRows[0] ? taskRows[0] : {};
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
        eventType: 'task_urge',
        priority: 3,
        taskId,
        taskTitle: taskTitle || taskInfo.title,
        task_group: taskInfo.task_group || undefined,
        publisher_id: taskInfo.publisher_id || undefined,
        designer_id: taskInfo.designer_id || designerId,
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
