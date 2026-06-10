/**
 * 任务查询 — 路由层（仅 HTTP 参数提取 + 调用 Service）
 */
const express = require('express');
const router = express.Router();
const { requireRole, requireAnyPermission } = require('../../middleware/auth');
const taskService = require('../../services/task.service');

// 我发布的任务
router.get('/my-published', requireAnyPermission(['operator.tasks.design', 'operator.tasks.assistant', 'cs.tasks.basic', 'operator.review.design', 'operator.review.assistant', 'cs.review.basic'], 'operator', 'admin', 'cs_agent'), async (req, res, next) => {
  try {
    const data = await taskService.getMyPublished(req.query, req.user);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

// 我接单的任务
router.get('/my-accepted', requireAnyPermission(['designer.tasks.design', 'basic.tasks.cs', 'assistant.tasks.operator'], 'designer', 'admin', 'basic_designer', 'operator_assistant'), async (req, res, next) => {
  try {
    const data = await taskService.getMyAccepted(req.query, req.user);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

// 任务大厅
router.get('/hall', requireAnyPermission(['designer.hall.design', 'basic.hall.cs', 'assistant.hall.operator'], 'designer', 'admin', 'basic_designer', 'operator_assistant'), async (req, res, next) => {
  try {
    const data = await taskService.getTaskHall(req.query, req.user);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

// 全局任务搜索（按当前用户可见范围过滤）
router.get('/search', async (req, res, next) => {
  try {
    const data = await taskService.searchTasks(req.query, req.user);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

// 全量任务（管理端）
router.get('/all', requireAnyPermission(['admin.tasks.design', 'admin.tasks.operator', 'admin.tasks.cs'], 'admin', 'sub_admin'), async (req, res, next) => {
  try {
    const data = await taskService.getAllTasksForUser(req.query, req.user);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

module.exports = router;
