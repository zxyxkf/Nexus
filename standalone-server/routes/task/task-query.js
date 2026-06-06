/**
 * 任务查询 — 路由层（仅 HTTP 参数提取 + 调用 Service）
 */
const express = require('express');
const router = express.Router();
const { requireRole } = require('../../middleware/auth');
const taskService = require('../../services/task.service');

// 我发布的任务
router.get('/my-published', requireRole('operator', 'admin', 'cs_agent'), async (req, res, next) => {
  try {
    const data = await taskService.getMyPublished(req.query, req.user);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

// 我接单的任务
router.get('/my-accepted', requireRole('designer', 'admin', 'basic_designer', 'operator_assistant'), async (req, res, next) => {
  try {
    const data = await taskService.getMyAccepted(req.query, req.user);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

// 任务大厅
router.get('/hall', requireRole('designer', 'admin', 'basic_designer', 'operator_assistant'), async (req, res, next) => {
  try {
    const data = await taskService.getTaskHall(req.query, req.user);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

// 全量任务（管理端）
router.get('/all', requireRole('admin', 'sub_admin'), async (req, res, next) => {
  try {
    const data = await taskService.getAllTasks(req.query);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

module.exports = router;
