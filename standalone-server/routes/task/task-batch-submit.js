const express = require('express');
const { requireAnyPermission } = require('../../middleware/auth');
const service = require('../../services/batch-submit.service');

const router = express.Router();

router.post(
  '/batch-submit/resolve',
  requireAnyPermission(['task.upload.work'], 'basic_designer'),
  async (req, res, next) => {
    try {
      const result = await service.resolveBatchSubmission(req.body.files, req.user);
      res.json({ code: 0, msg: '文件匹配完成', data: result });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
