const express = require('express');
const { requireAuth, requireAnyPermission, ownsPermission } = require('../../middleware/auth');
const promotionService = require('../../services/payment-tracking/promotion.service');

const router = express.Router();
router.use(requireAuth);

function canManageConfig(user) {
  return user?.role === 'admin'
    || (user?.permissions || []).includes('*')
    || ownsPermission(user, 'admin.config');
}

router.get(
  '/promotion-methods',
  requireAnyPermission([
    'payment.selection.view',
    'payment.records.view',
    'payment.manage.all',
    'admin.config'
  ], 'admin'),
  async (req, res, next) => {
    try {
      const wantsInactive = ['1', 'true', 'yes'].includes(String(req.query.includeInactive || '').toLowerCase());
      const data = await promotionService.listMethods({
        includeInactive: wantsInactive && canManageConfig(req.user)
      });
      res.json({ code: 0, msg: '查询成功', data });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/promotion-methods', requireAnyPermission(['admin.config'], 'admin'), async (req, res, next) => {
  try {
    const data = await promotionService.createMethod(req.body || {});
    res.json({ code: 0, msg: '推广方式创建成功', data });
  } catch (error) {
    next(error);
  }
});

router.put('/promotion-methods/:id', requireAnyPermission(['admin.config'], 'admin'), async (req, res, next) => {
  try {
    const data = await promotionService.updateMethod(req.params.id, req.body || {});
    res.json({ code: 0, msg: '推广方式更新成功', data });
  } catch (error) {
    next(error);
  }
});

router.delete('/promotion-methods/:id', requireAnyPermission(['admin.config'], 'admin'), async (req, res, next) => {
  try {
    const data = await promotionService.deleteMethod(req.params.id);
    res.json({ code: 0, msg: '推广方式删除成功', data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
