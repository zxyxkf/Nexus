const express = require('express');
const { requireAuth, requireAnyPermission, ownsPermission } = require('../../middleware/auth');
const categoryService = require('../../services/payment-tracking/category.service');

const router = express.Router();

router.use(requireAuth);

function canManageConfig(user) {
  return user?.role === 'admin'
    || (user?.permissions || []).includes('*')
    || ownsPermission(user, 'admin.config');
}

router.get(
  '/categories',
  requireAnyPermission([
    'payment.selection.view',
    'payment.records.view',
    'payment.manage.all',
    'admin.config'
  ], 'admin'),
  async (req, res, next) => {
    try {
      const wantsInactive = ['1', 'true', 'yes'].includes(String(req.query.includeInactive || '').toLowerCase());
      const data = await categoryService.listCategories({
        includeInactive: wantsInactive && canManageConfig(req.user)
      });
      res.json({ code: 0, msg: '查询成功', data });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/categories',
  requireAnyPermission(['admin.config'], 'admin'),
  async (req, res, next) => {
    try {
      const data = await categoryService.createCategory(req.body || {});
      res.json({ code: 0, msg: '上架类目创建成功', data });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/categories/:id',
  requireAnyPermission(['admin.config'], 'admin'),
  async (req, res, next) => {
    try {
      const data = await categoryService.updateCategory(req.params.id, req.body || {});
      res.json({ code: 0, msg: '上架类目更新成功', data });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/categories/:id',
  requireAnyPermission(['admin.config'], 'admin'),
  async (req, res, next) => {
    try {
      const data = await categoryService.deleteCategory(req.params.id);
      res.json({ code: 0, msg: '上架类目删除成功', data });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
