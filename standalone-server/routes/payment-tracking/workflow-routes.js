const express = require('express');
const { requireAuth, requireAnyPermission, requirePermission } = require('../../middleware/auth');
const workflowService = require('../../services/payment-tracking/workflow.service');

const router = express.Router();

router.use(requireAuth);

router.put(
  '/records/:id/stages/:stageCode',
  requirePermission('payment.selection.view'),
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
  requirePermission('payment.selection.view'),
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
  requirePermission('payment.selection.view'),
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
  requireAnyPermission(['payment.selection.view', 'payment.records.view']),
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
  requirePermission('payment.stage_reopen'),
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
