const express = require('express');
const { requireAuth, requireAnyPermission } = require('../../middleware/auth');
const openService = require('../../services/payment-tracking/open.service');

const router = express.Router();

router.use(requireAuth);

router.post('/open/task/:taskId', requireAnyPermission(['payment.open', 'payment.manage.all']), async (req, res, next) => {
  try {
    const data = await openService.openFromTask(req.params.taskId, req.user);
    res.json({
      code: 0,
      msg: data.restored ? '已恢复打款记录' : data.alreadyOpened ? '该任务已开启打款' : '打款已开启',
      data
    });
  } catch (error) {
    next(error);
  }
});

router.post('/open/batch', requireAnyPermission(['payment.open', 'payment.manage.all']), async (req, res, next) => {
  try {
    const data = await openService.openBatch(req.body?.taskIds, req.user);
    res.json({ code: 0, msg: '批量开启处理完成', data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
