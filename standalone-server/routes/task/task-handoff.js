const express = require('express');
const { requireAnyPermission } = require('../../middleware/auth');
const csHandoffService = require('../../services/cs-handoff.service');

const router = express.Router();

router.get('/cs-shift/status', requireAnyPermission(['cs.shift.toggle'], 'cs_agent'), async (req, res, next) => {
  try {
    const status = await csHandoffService.getShiftStatus(req.user);
    res.json({ code: 0, msg: '查询成功', data: { status } });
  } catch (err) { next(err); }
});

router.post('/cs-shift/status', requireAnyPermission(['cs.shift.toggle'], 'cs_agent'), async (req, res, next) => {
  try {
    const data = await csHandoffService.setShiftStatus(req.body.status, req.user);
    res.json({ code: 0, msg: data.status === 'online' ? '已上线' : '已下线', data });
  } catch (err) { next(err); }
});

router.get('/cs-handoff', requireAnyPermission(['cs.handoff.tasks'], 'cs_agent', 'admin', 'sub_admin'), async (req, res, next) => {
  try {
    const data = await csHandoffService.listPooledTasks(req.query, req.user);
    res.json({ code: 0, msg: '查询成功', data });
  } catch (err) { next(err); }
});

router.post('/cs-handoff/:taskId/claim', requireAnyPermission(['cs.handoff.claim'], 'cs_agent'), async (req, res, next) => {
  try {
    const data = await csHandoffService.claimPooledTask(req.params.taskId, req.user);
    res.json({ code: 0, msg: '任务继承成功', data });
  } catch (err) { next(err); }
});

module.exports = router;
