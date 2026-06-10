/**
 * 任务统计 — 路由层（仅 HTTP 参数提取 + 调用 Service）
 */
const express = require('express');
const router = express.Router();
const { requireAnyPermission } = require('../../middleware/auth');
const taskService = require('../../services/task.service');

// 个人统计
router.get('/stats/my', async (req, res, next) => {
  try {
    const data = await taskService.getMyStats(req.user);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

// 仪表盘统计
router.get('/stats/dashboard', requireAnyPermission(['dashboard.design', 'dashboard.operator', 'dashboard.cs'], 'admin', 'sub_admin', 'designer', 'basic_designer', 'operator_assistant', 'operator', 'cs_agent'), async (req, res, next) => {
  try {
    const data = await taskService.getDashboardStats(req.user);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

// 管理端综合统计
router.get('/stats/admin/detail', requireAnyPermission(['dashboard.design', 'dashboard.operator', 'dashboard.cs'], 'admin', 'sub_admin', 'designer', 'basic_designer', 'operator_assistant', 'operator', 'cs_agent'), async (req, res, next) => {
  try {
    const data = await taskService.getAdminDetailStats(req.user);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

module.exports = router;
