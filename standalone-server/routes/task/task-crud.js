/**
 * 任务 CRUD — 路由层（仅 HTTP 参数提取 + 调用 Service）
 */
const express = require('express');
const router = express.Router();
const { requireRole, requireAnyPermission } = require('../../middleware/auth');
const taskService = require('../../services/task.service');

// 创建任务
router.post('/create', requireAnyPermission(['task.create.design', 'task.create.operator', 'task.create.cs'], 'operator', 'admin', 'cs_agent'), async (req, res, next) => {
  try {
    const result = await taskService.createTask(req.body, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// 任务详情
router.get('/detail', async (req, res, next) => {
  try {
    const data = await taskService.getTaskDetail(req.query.taskId, req.user);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

// 删除任务
router.post('/delete', requireRole('admin', 'sub_admin'), async (req, res, next) => {
  try {
    const result = await taskService.deleteTask(req.body.taskId, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// 编辑草稿并重新发布
router.put('/update', requireAnyPermission(['task.create.design', 'task.create.operator', 'task.create.cs'], 'operator', 'admin', 'cs_agent'), async (req, res, next) => {
  try {
    const result = await taskService.updateTask(req.body, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// 客服重开已完成基础美工任务
router.post('/reopen-finished-cs', requireAnyPermission(['task.create.cs'], 'cs_agent'), async (req, res, next) => {
  try {
    const result = await taskService.reopenFinishedCsTask(req.body, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// 客服修改已完成基础美工任务编号
router.put('/cs-task-no', requireAnyPermission(['task.create.cs'], 'cs_agent'), async (req, res, next) => {
  try {
    const result = await taskService.updateCsTaskNo(req.body.taskId, req.body.taskNo, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// 批量删除
router.post('/batch-delete', requireRole('admin', 'sub_admin'), async (req, res, next) => {
  try {
    const result = await taskService.batchDelete(req.body.taskIds);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// 批量重新分配
router.post('/batch-reassign', requireRole('admin', 'sub_admin'), async (req, res, next) => {
  try {
    const { taskIds, designerId, designerName } = req.body;
    const result = await taskService.batchReassign(taskIds, designerId, designerName);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

module.exports = router;
