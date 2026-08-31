const express = require('express');
const { requireAuth } = require('../../middleware/auth');
const service = require('../../services/payment-tracking/manager-review.service');

const router = express.Router();
router.use(requireAuth);

router.get('/manager-reviews/count', async (req, res, next) => {
  try {
    res.json({ code: 0, msg: '查询成功', data: await service.countRequests(req.query, req.user) });
  } catch (error) { next(error); }
});

router.get('/manager-reviews', async (req, res, next) => {
  try {
    res.json({ code: 0, msg: '查询成功', data: await service.listRequests(req.query, req.user) });
  } catch (error) { next(error); }
});

router.get('/manager-reviews/:id', async (req, res, next) => {
  try {
    res.json({ code: 0, msg: '查询成功', data: await service.getRequestDetail(req.params.id, req.user) });
  } catch (error) { next(error); }
});

router.post('/manager-reviews/:id/approve', async (req, res, next) => {
  try {
    res.json({ code: 0, msg: '审核通过', data: await service.approveRequest(req.params.id, req.body, req.user) });
  } catch (error) { next(error); }
});

router.post('/manager-reviews/:id/reject', async (req, res, next) => {
  try {
    res.json({ code: 0, msg: '已拒绝', data: await service.rejectRequest(req.params.id, req.body, req.user) });
  } catch (error) { next(error); }
});

module.exports = router;
