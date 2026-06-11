/**
 * 任务动作 — 路由层（multer + HTTP 参数提取 + 调用 Service）
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const { requireRole, requireAnyPermission } = require('../../middleware/auth');
const taskService = require('../../services/task.service');
const { fixFilenameEncoding } = require('../../utils/upload');
const { getMaxFileSizeMB, getMaxFileCount } = require('../../utils/share');

// ==================== 接单 ====================

router.post('/accept', requireAnyPermission(['designer.hall.design', 'basic.hall.cs', 'assistant.hall.operator'], 'designer', 'basic_designer', 'operator_assistant'), async (req, res, next) => {
  try {
    const result = await taskService.acceptTask(req.body.taskId, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// ==================== 上传文件 ====================

router.post('/upload-files', requireAnyPermission(['task.upload.work', 'task.create.design', 'task.create.operator', 'task.create.cs'], 'designer', 'basic_designer', 'operator', 'cs_agent', 'operator_assistant'), (req, res, next) => {
  const tmpDir = path.join(os.tmpdir(), 'd-design-tmp');
  try { fs.mkdirSync(tmpDir, { recursive: true }); } catch (_) {}

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tmpDir),
    filename: (req, file, cb) => {
      file.originalname = fixFilenameEncoding(file.originalname);
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${uuidv4().replace(/-/g, '')}${ext}`);
    }
  });

  const fileFilter = (req, file, cb) => {
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      return cb(new Error('文件名不合法'), false);
    }
    cb(null, true);
  };

  multer({ storage, fileFilter, limits: { fileSize: getMaxFileSizeMB() * 1024 * 1024, files: getMaxFileCount() } })
    .array('files', getMaxFileCount())(req, res, async (err) => {
      if (err) return res.json({ code: 400, msg: err.message });

      try {
        const { taskId } = req.body;
        const fileCategory = req.body.fileCategory || 'work';
        const actualQuantity = parseInt(req.body.actualQuantity) || 0;
        const appliedScore = parseFloat(req.body.appliedScore) || 0;
        const workPath = (req.body.workPath || '').trim();
        const hasWorkPathField = Object.prototype.hasOwnProperty.call(req.body, 'workPath');
        const replaceExisting = req.body.replaceExisting === '1' || req.body.replaceExisting === 'true';
        const saveOnly = req.body.saveOnly === '1' || req.body.saveOnly === 'true';
        const rejectRecordId = req.body.rejectRecordId ? parseInt(req.body.rejectRecordId) : null;
        const result = await taskService.uploadFiles(taskId, req.files, fileCategory, actualQuantity, appliedScore, workPath, req.user, { replaceExisting, hasWorkPathField, saveOnly, rejectRecordId });
        res.json({ code: 0, ...result });
      } catch (err) { next(err); }
    });
});

// ==================== 转移任务 ====================

router.post('/transfer', requireRole('basic_designer'), async (req, res, next) => {
  try {
    const result = await taskService.transferTask(req.body.taskId, req.body.newDesignerId, req.body.reason, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// ==================== 提交完成 ====================

router.post('/finish', requireAnyPermission(['task.upload.work'], 'designer', 'basic_designer', 'operator_assistant'), async (req, res, next) => {
  try {
    const qty = parseInt(req.body.actualQuantity) || 0;
    const result = await taskService.finishTask(req.body.taskId, qty, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// ==================== 审核 ====================

router.post('/review', requireAnyPermission(['task.review.own', 'task.review.store', 'task.review.all'], 'operator', 'admin', 'cs_agent'), async (req, res, next) => {
  try {
    const { taskId, action, rejectReason } = req.body;
    const result = await taskService.reviewTask(taskId, action, rejectReason, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// 批量审核
router.post('/batch-review', requireAnyPermission(['task.review.own', 'task.review.store', 'task.review.all'], 'operator', 'admin', 'cs_agent'), async (req, res, next) => {
  try {
    const result = await taskService.batchReview(req.body.taskIds, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// ==================== 撤回任务 ====================

router.post('/withdraw', requireAnyPermission(['task.create.design', 'task.create.operator', 'task.create.cs'], 'operator', 'admin', 'cs_agent'), async (req, res, next) => {
  try {
    const result = await taskService.withdrawTask(req.body.taskId, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// ==================== 撤回提交 ====================

router.post('/undo-submit', requireAnyPermission(['task.upload.work'], 'designer', 'basic_designer', 'operator_assistant'), async (req, res, next) => {
  try {
    const result = await taskService.undoSubmit(req.body.taskId, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

module.exports = router;
