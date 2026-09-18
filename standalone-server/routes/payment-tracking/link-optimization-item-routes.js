const express = require('express');
const { requireAuth, requireAnyPermission, ownsPermission } = require('../../middleware/auth');
const linkOptimizationItemService = require('../../services/payment-tracking/link-optimization-item.service');

const router = express.Router();
router.use(requireAuth);

function canManageConfig(user) {
  return user?.role === 'admin'
    || (user?.permissions || []).includes('*')
    || ownsPermission(user, 'admin.config');
}

router.get(
  '/link-optimization-items',
  requireAnyPermission([
    'payment.selection.view',
    'payment.records.view',
    'payment.manage.all',
    'admin.config'
  ], 'admin'),
  async (req, res, next) => {
    try {
      const wantsInactive = ['1', 'true', 'yes'].includes(String(req.query.includeInactive || '').toLowerCase());
      const data = await linkOptimizationItemService.listItems({
        includeInactive: wantsInactive && canManageConfig(req.user)
      });
      res.json({ code: 0, msg: '查询成功', data });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/link-optimization-items', requireAnyPermission(['admin.config'], 'admin'), async (req, res, next) => {
  try {
    const data = await linkOptimizationItemService.createItem(req.body || {});
    res.json({ code: 0, msg: '链接优化项目创建成功', data });
  } catch (error) {
    next(error);
  }
});

router.put('/link-optimization-items/:id', requireAnyPermission(['admin.config'], 'admin'), async (req, res, next) => {
  try {
    const data = await linkOptimizationItemService.updateItem(req.params.id, req.body || {});
    res.json({ code: 0, msg: '链接优化项目更新成功', data });
  } catch (error) {
    next(error);
  }
});

router.delete('/link-optimization-items/:id', requireAnyPermission(['admin.config'], 'admin'), async (req, res, next) => {
  try {
    const data = await linkOptimizationItemService.deleteItem(req.params.id);
    res.json({ code: 0, msg: '链接优化项目删除成功', data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
