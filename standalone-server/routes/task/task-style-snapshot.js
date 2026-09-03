const express = require('express');
const multer = require('multer');
const AppError = require('../../utils/AppError');
const { requireAnyPermission } = require('../../middleware/auth');
const { getMaxFileSizeMB } = require('../../utils/share');
const service = require('../../services/task-style-snapshot.service');

const router = express.Router();

function receiveEditedImages(req, res, next) {
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: getMaxFileSizeMB() * 1024 * 1024,
      files: 200,
      fields: 10
    }
  }).any()(req, res, error => {
    if (!error) return next();
    if (error instanceof multer.MulterError) return next(new AppError(400, '款式图片上传参数不正确'));
    return next(error);
  });
}

router.post(
  '/style-snapshots',
  requireAnyPermission(['task.create.cs'], 'cs_agent', 'admin'),
  receiveEditedImages,
  async (req, res, next) => {
    try {
      let manifest;
      try {
        manifest = JSON.parse(req.body.manifest || '[]');
      } catch (_) {
        throw new AppError(400, '款式图片清单格式无效');
      }
      const result = await service.saveTaskStyleSnapshots({
        taskId: req.body.taskId,
        materialStyleId: req.body.materialStyleId,
        manifest,
        files: req.files || [],
        user: req.user
      });
      res.json({ code: 0, msg: '款式素材已保存', data: result });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
