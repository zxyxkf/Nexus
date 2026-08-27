const express = require('express');
const { requireAuth, requireAnyPermission, requirePermission } = require('../../middleware/auth');
const recordService = require('../../services/payment-tracking/record.service');

const router = express.Router();

router.use(requireAuth);

router.get(
  '/records',
  requireAnyPermission(['payment.selection.view', 'payment.records.view']),
  async (req, res, next) => {
    try {
      const data = await recordService.listRecords(req.query, req.user);
      res.json({ code: 0, msg: '查询成功', data });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/records/:id',
  requireAnyPermission(['payment.selection.view', 'payment.records.view']),
  async (req, res, next) => {
    try {
      const data = await recordService.getRecord(req.params.id, req.user);
      res.json({ code: 0, msg: '查询成功', data });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/records', requirePermission('payment.selection.view'), async (req, res, next) => {
  try {
    const data = await recordService.createManualRecord(req.body || {}, req.user);
    res.json({ code: 0, msg: '创建成功', data });
  } catch (error) {
    next(error);
  }
});

router.delete('/records/:id', requirePermission('payment.delete'), async (req, res, next) => {
  try {
    await recordService.deleteRecord(req.params.id, req.body || {}, req.user);
    res.json({ code: 0, msg: '删除成功' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
