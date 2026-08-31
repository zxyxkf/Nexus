const fs = require('fs');
const multer = require('multer');
const express = require('express');
const AppError = require('../../utils/AppError');
const { getMaxFileSizeMB, getMaxFileCount } = require('../../utils/share');
const { requireAuth, requireAnyPermission, optionalAuth } = require('../../middleware/auth');
const imageService = require('../../services/payment-tracking/image.service');

const router = express.Router();

function createUploadMiddleware() {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: getMaxFileSizeMB() * 1024 * 1024,
      files: getMaxFileCount()
    },
    fileFilter: (_req, file, callback) => {
      if (file.originalname.includes('..') || /[\\/]/.test(file.originalname)) {
        return callback(new AppError(400, '文件名不合法'), false);
      }
      const accepted = Object.prototype.hasOwnProperty.call(
        imageService.MIME_EXTENSIONS,
        String(file.mimetype || '').toLowerCase()
      );
      return callback(accepted ? null : new AppError(400, '只允许上传图片'), accepted);
    }
  }).array('files');
}

function receiveImages(req, res, next) {
  createUploadMiddleware()(req, res, next);
}

router.get('/images/:imageId/preview', optionalAuth, async (req, res, next) => {
  try {
    const image = await imageService.getPreview(req.params.imageId, req.user);
    res.setHeader('Content-Type', image.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    const stream = fs.createReadStream(image.filePath);
    stream.on('error', next);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

router.use(requireAuth);

router.post(
  '/records/:id/images/:category',
  requireAnyPermission(['payment.selection.view', 'payment.manage.all']),
  receiveImages,
  async (req, res, next) => {
    try {
      const data = await imageService.uploadImages(
        req.params.id,
        req.params.category,
        req.files,
        req.body?.version,
        req.user,
        req.body?.adjustmentId
      );
      res.json({ code: 0, msg: '上传成功', data });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/records/:id/images/order',
  requireAnyPermission(['payment.selection.view', 'payment.manage.all']),
  async (req, res, next) => {
    try {
      const data = await imageService.reorderImages(
        req.params.id,
        req.body?.imageIds,
        req.body?.version,
        req.user
      );
      res.json({ code: 0, msg: '排序已保存', data });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/records/:id/images/:imageId',
  requireAnyPermission(['payment.selection.view', 'payment.manage.all']),
  async (req, res, next) => {
    try {
      const data = await imageService.deleteImage(
        req.params.id,
        req.params.imageId,
        req.body?.version,
        req.user
      );
      res.json({ code: 0, msg: '图片已删除', data });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
