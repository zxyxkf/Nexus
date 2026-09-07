const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const AppError = require('../../utils/AppError');
const { requireAnyPermission } = require('../../middleware/auth');
const { getMaxFileSizeMB } = require('../../utils/share');
const service = require('../../services/task-style-snapshot.service');

const router = express.Router();
const tempDir = path.join(os.tmpdir(), 'nexus-style-snapshots');
const MAX_TOTAL_EDITED_BYTES = 512 * 1024 * 1024;

function cleanupTempFiles(files) {
  for (const file of files || []) {
    try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
  }
}

function receiveEditedImages(req, res, next) {
  fs.mkdirSync(tempDir, { recursive: true });
  multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, tempDir),
      filename: (_req, _file, cb) => cb(null, `${uuidv4().replace(/-/g, '')}.png`)
    }),
    limits: {
      fileSize: getMaxFileSizeMB() * 1024 * 1024,
      files: 200,
      fields: 10
    }
  }).any()(req, res, error => {
    if (!error) {
      const totalBytes = (req.files || []).reduce((sum, file) => sum + Number(file.size || 0), 0);
      if (totalBytes <= MAX_TOTAL_EDITED_BYTES) return next();
      cleanupTempFiles(req.files);
      return next(new AppError(400, '编辑后的款式图总大小不能超过 512MB'));
    }
    cleanupTempFiles(req.files);
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
      cleanupTempFiles(req.files);
      res.json({ code: 0, msg: '款式素材已保存', data: result });
    } catch (error) {
      cleanupTempFiles(req.files);
      next(error);
    }
  }
);

module.exports = router;
