const express = require('express');
const { requireAuth, requireAnyPermission } = require('../../middleware/auth');
const linkStatusService = require('../../services/payment-tracking/link-status.service');

const router = express.Router();

router.use(requireAuth);

router.put(
  '/records/:id/stages/:stageCode/link-status',
  requireAnyPermission(['payment.selection.view', 'payment.manage.all']),
  async (req, res, next) => {
    try {
      const data = await linkStatusService.saveLinkStatus(
        req.params.id,
        req.params.stageCode,
        req.body || {},
        req.user
      );
      res.json({ code: 0, msg: req.body?.clear === true ? '链接状态已清空' : '链接状态已保存', data });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
