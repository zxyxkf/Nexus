/**
 * 积分模块路由
 * sys_score_item — 设计/客服积分项目
 * sys_score_item_operator — 运营积分项目
 */
const express = require('express');
const router = express.Router();
const { execute } = require('../config/database');
const { requireAuth, requireAnyPermission } = require('../middleware/auth');

router.use(requireAuth);

function socketEmit(room) {
  if (global.io) global.io.to(room).emit('task:update');
}

function scoreTable(taskGroup) {
  if (taskGroup === 'operator') return 'sys_score_item_operator';
  if (taskGroup === 'cs') return 'sys_score_item_cs';
  return 'sys_score_item';
}

// 积分项目列表
router.get('/items', async (req, res) => {
  try {
    const { taskGroup } = req.query;
    const table = scoreTable(taskGroup);
    const [rows] = await execute(`SELECT * FROM ${table} ORDER BY id`);
    res.json({ code: 0, data: rows || [] });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '查询失败' });
  }
});

// 积分明细（按用户）
router.get('/records', async (req, res) => {
  try {
    const userId = req.query.userId || req.user.id;
    const canViewOthers = req.user.role === 'admin' || req.user.role === 'sub_admin' || (req.user.permissions || []).includes('*') || (req.user.permissions || []).includes('task.view.all');
    if (Number(userId) !== Number(req.user.id) && !canViewOthers) {
      return res.status(403).json({ code: 403, msg: '无权查看他人积分明细' });
    }
    const [rows] = await execute(
      `SELECT r.*,
              COALESCE(si.name, cs.name, op.name) as item_name
       FROM sys_score_record r
       LEFT JOIN sys_score_item si ON r.score_item_id = si.id
       LEFT JOIN sys_score_item_cs cs ON r.score_item_id = cs.id
       LEFT JOIN sys_score_item_operator op ON r.score_item_id = op.id
       WHERE r.user_id = ? ORDER BY r.create_time DESC LIMIT 50`,
      [userId]
    );
    const [total] = await execute(
      'SELECT COALESCE(SUM(score),0) as total FROM sys_score_record WHERE user_id = ?',
      [userId]
    );
    res.json({ code: 0, data: { list: rows || [], totalScore: total[0]?.total || 0 } });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '查询失败' });
  }
});

// 新增/修改积分项目（仅管理员）
router.post('/save', requireAnyPermission(['admin.config'], 'admin'), async (req, res) => {
  try {
    const { id, name, score, scoreDesc, taskGroup } = req.body;
    if (!name || !name.trim()) {
      return res.json({ code: 400, msg: '项目名称不能为空' });
    }
    if (score === undefined || score === null || isNaN(Number(score))) {
      return res.json({ code: 400, msg: '分值不能为空' });
    }

    const table = scoreTable(taskGroup);

    if (id) {
      const [existing] = await execute(`SELECT id FROM ${table} WHERE name = ? AND id != ?`, [name.trim(), id]);
      if (existing.length > 0) {
        return res.json({ code: 400, msg: `项目名称「${name.trim()}」已存在` });
      }
      await execute(
        `UPDATE ${table} SET name = ?, score = ?, score_desc = ? WHERE id = ?`,
        [name.trim(), Number(score), scoreDesc || '', id]
      );
      res.json({ code: 0, msg: '更新成功' });
    } else {
      const [existing] = await execute(`SELECT id FROM ${table} WHERE name = ?`, [name.trim()]);
      if (existing.length > 0) {
        return res.json({ code: 400, msg: `项目名称「${name.trim()}」已存在` });
      }
      const [result] = await execute(
        `INSERT INTO ${table} (name, score, score_desc) VALUES (?, ?, ?)`,
        [name.trim(), Number(score), scoreDesc || '']
      );
      res.json({ code: 0, msg: '添加成功', data: { id: result.insertId || result.lastID } });
    }
  } catch (err) {
    res.status(500).json({ code: 500, msg: '保存失败' });
  }
});

// 删除积分项目（仅管理员）
router.post('/delete', requireAnyPermission(['admin.config'], 'admin'), async (req, res) => {
  try {
    const { id, taskGroup } = req.body;
    if (!id) {
      return res.json({ code: 400, msg: '请选择要删除的项目' });
    }
    const table = scoreTable(taskGroup);
    await execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
    res.json({ code: 0, msg: '删除成功' });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '删除失败' });
  }
});

// ===== 基础美工分值审核 =====

// 待审核列表（组长查看 pending 状态的任务）
router.get('/review/list', requireAnyPermission(['score.review.basic'], 'admin', 'sub_admin'), async (req, res) => {
  try {
    const { page = 1, pageSize = 15, publisherId, designerId, sortField, sortOrder } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let where = `t.task_group = 'cs' AND t.score_review_status = 'pending' AND t.status IN ('doing', 'finished')`;
    const params = [];

    if (publisherId) { where += ' AND t.publisher_id = ?'; params.push(publisherId); }
    if (designerId) { where += ' AND t.designer_id = ?'; params.push(designerId); }

    // 可排序字段白名单：字段名写死，前端 sortField 仅用于查表，不拼接进 SQL
    const allowedSort = { create_time: 't.create_time', task_no: 't.task_no', applied_score: 't.applied_score' };
    const orderColumn = allowedSort[sortField] || 't.create_time';
    const direction = String(sortOrder).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const [rows] = await execute(
      `SELECT t.id, t.task_no, t.title, t.description, t.status, t.score, t.applied_score,
              t.score_review_status, t.score_review_time, t.score_review_score,
              t.wangwang_id, t.ref_path, t.style_number,
              t.designer_id, t.designer_name, t.publisher_name, t.create_time,
              t.specified_color
       FROM task_info t
       WHERE ${where}
       ORDER BY ${orderColumn} ${direction}, t.id ${direction}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    const [countResult] = await execute(
      `SELECT COUNT(*) as total FROM task_info t WHERE ${where}`, params
    );

    // 挂载文件
    const list = rows || [];
    if (list.length) {
      const taskIds = list.map(r => r.id);
      const placeholders = taskIds.map(() => '?').join(',');
      const [files] = await execute(
        `SELECT * FROM task_file WHERE task_id IN (${placeholders}) ORDER BY create_time ASC`,
        taskIds
      );
      const filesByTask = {};
      for (const f of files) {
        (filesByTask[f.task_id] = filesByTask[f.task_id] || []).push(f);
      }
      for (const row of list) {
        row.files = filesByTask[row.id] || [];
      }
    }

    res.json({ code: 0, data: { list, total: countResult[0]?.total || 0 } });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '查询失败' });
  }
});

// 审核记录（已通过/已驳回）
router.get('/review/records', requireAnyPermission(['score.records.basic'], 'admin', 'sub_admin'), async (req, res) => {
  try {
    const { page = 1, pageSize = 15, publisherId, designerId, status, dateStart, dateEnd, sortField, sortOrder } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let where = `t.task_group = 'cs' AND t.score_review_status IN ('approved', 'rejected')`;
    const params = [];

    if (publisherId) { where += ' AND t.publisher_id = ?'; params.push(publisherId); }
    if (designerId) { where += ' AND t.designer_id = ?'; params.push(designerId); }
    if (status) { where += ' AND t.score_review_status = ?'; params.push(status); }
    if (dateStart) { where += ' AND COALESCE(t.score_review_time, t.update_time) >= ?'; params.push(dateStart + ' 00:00:00'); }
    if (dateEnd) { where += ' AND COALESCE(t.score_review_time, t.update_time) <= ?'; params.push(dateEnd + ' 23:59:59'); }

    const allowedSort = { score_review_time: 'COALESCE(t.score_review_time, t.update_time)', update_time: 't.update_time', create_time: 't.create_time', applied_score: 't.applied_score', score: 't.score' };
    const orderBy = allowedSort[sortField] || 'COALESCE(t.score_review_time, t.update_time)';
    const direction = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const [rows] = await execute(
      `SELECT t.id, t.task_no, t.title, t.score, t.applied_score, t.score_review_status,
              t.score_review_reason, t.score_review_time, t.score_review_score,
              t.wangwang_id, t.style_number,
              t.designer_id, t.designer_name, t.publisher_name, t.create_time, t.update_time
       FROM task_info t
       WHERE ${where}
       ORDER BY ${orderBy} ${direction}
       LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    const [countResult] = await execute(
      `SELECT COUNT(*) as total FROM task_info t WHERE ${where}`, params
    );

    // 挂载文件
    const list = rows || [];
    if (list.length) {
      const taskIds = list.map(r => r.id);
      const placeholders = taskIds.map(() => '?').join(',');
      const [files] = await execute(
        `SELECT * FROM task_file WHERE task_id IN (${placeholders}) ORDER BY create_time ASC`,
        taskIds
      );
      const filesByTask = {};
      for (const f of files) {
        (filesByTask[f.task_id] = filesByTask[f.task_id] || []).push(f);
      }
      for (const row of list) {
        row.files = filesByTask[row.id] || [];
      }
    }

    res.json({ code: 0, data: { list, total: countResult[0]?.total || 0 } });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '查询失败' });
  }
});

// 通过分值申请
router.post('/review/approve', requireAnyPermission(['score.review.basic'], 'admin', 'sub_admin'), async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) return res.json({ code: 400, msg: '任务ID不能为空' });
    const [task] = await execute(`SELECT id, status, applied_score, score_review_status FROM task_info WHERE id = ?`, [taskId]);
    if (!task.length) return res.json({ code: 400, msg: '任务不存在' });
    if (!['doing', 'finished'].includes(task[0].status) || task[0].score_review_status !== 'pending') {
      return res.json({ code: 400, msg: '该分值申请已失效或无需审核' });
    }
    await execute(
      `UPDATE task_info
       SET score_review_status = 'approved',
           score_review_reason = '',
           score_review_time = NOW(),
           score_review_score = applied_score,
           score = CASE WHEN status = 'finished' THEN applied_score ELSE score END,
           update_time = NOW()
       WHERE id = ?`,
      [taskId]
    );
    socketEmit('group:cs');
    res.json({ code: 0, msg: '分值审核通过' });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '操作失败' });
  }
});

// 驳回分值申请
router.post('/review/reject', requireAnyPermission(['score.review.basic'], 'admin', 'sub_admin'), async (req, res) => {
  try {
    const { taskId, reason } = req.body;
    if (!taskId) return res.json({ code: 400, msg: '任务ID不能为空' });
    if (!reason || !reason.trim()) return res.json({ code: 400, msg: '请填写不予通过的原因' });
    const [task] = await execute(`SELECT id, status, score_review_status FROM task_info WHERE id = ?`, [taskId]);
    if (!task.length) return res.json({ code: 400, msg: '任务不存在' });
    if (!['doing', 'finished'].includes(task[0].status) || task[0].score_review_status !== 'pending') {
      return res.json({ code: 400, msg: '该分值申请已失效或无需审核' });
    }
    await execute(
      `UPDATE task_info
       SET score = 1,
           score_review_status = 'rejected',
           score_review_reason = ?,
           score_review_time = NOW(),
           score_review_score = 0,
           update_time = NOW()
       WHERE id = ?`,
      [reason.trim(), taskId]
    );
    socketEmit('group:cs');
    res.json({ code: 0, msg: '分值申请已驳回' });
  } catch (err) {
    res.status(500).json({ code: 500, msg: '操作失败' });
  }
});

module.exports = router;
