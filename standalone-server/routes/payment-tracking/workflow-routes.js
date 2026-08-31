const express = require('express');
const { requireAuth, requireAnyPermission, requirePermission } = require('../../middleware/auth');
const workflowService = require('../../services/payment-tracking/workflow.service');

const router = express.Router();

router.use(requireAuth);

router.put(
  '/records/:id/stages/:stageCode',
  requireAnyPermission(['payment.selection.view', 'payment.manage.all']),
  async (req, res, next) => {
    try {
      const data = await workflowService.saveStage(
        req.params.id,
        req.params.stageCode,
        req.body || {},
        req.user
      );
      res.json({ code: 0, msg: '保存成功', data });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/records/:id/advance',
  requireAnyPermission(['payment.selection.view', 'payment.manage.all']),
  async (req, res, next) => {
    try {
      const data = await workflowService.advanceStage(req.params.id, req.body || {}, req.user);
      res.json({ code: 0, msg: '已进入下一阶段', data });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/records/:id/end',
  requireAnyPermission(['payment.selection.view', 'payment.manage.all']),
  async (req, res, next) => {
    try {
      const data = await workflowService.endProcess(req.params.id, req.body || {}, req.user);
      res.json({ code: 0, msg: '流程已结束', data });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/records/:id/restore',
  requireAnyPermission(['payment.selection.view', 'payment.records.view', 'payment.manage.all']),
  async (req, res, next) => {
    try {
      const data = await workflowService.restoreProcess(req.params.id, req.body || {}, req.user);
      res.json({ code: 0, msg: '流程已恢复', data });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/records/:id/stages/:stageCode/reopen',
  requireAnyPermission(['payment.stage_reopen', 'payment.manage.all']),
  async (req, res, next) => {
    try {
      const data = await workflowService.reopenStage(
        req.params.id,
        req.params.stageCode,
        req.body || {},
        req.user
      );
      res.json({ code: 0, msg: '历史阶段已重开', data });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
