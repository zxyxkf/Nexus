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
const AppError = require('../../utils/AppError');
const { fixFilenameEncoding } = require('../../utils/upload');
const { getMaxFileSizeMB, getMaxFileCount } = require('../../utils/share');

function parseIdArray(value, fieldName) {
  if (value === undefined || value === null || value === '') return [];
  let parsed;
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : value;
  } catch (_) {
    throw new AppError(400, `${fieldName}格式不正确`);
  }
  if (!Array.isArray(parsed)) throw new AppError(400, `${fieldName}格式不正确`);
  return [...new Set(parsed.map(Number).filter(id => Number.isInteger(id) && id > 0))];
}

function createOriginalUploadMiddleware() {
  const tmpDir = path.join(os.tmpdir(), 'd-design-tmp');
  try { fs.mkdirSync(tmpDir, { recursive: true }); } catch (_) {}

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, tmpDir),
    filename: (req, file, cb) => {
      file.originalname = fixFilenameEncoding(file.originalname);
      cb(null, `${uuidv4().replace(/-/g, '')}${path.extname(file.originalname).toLowerCase()}`);
    }
  });
  const fileFilter = (req, file, cb) => {
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      return cb(new Error('Invalid file name'), false);
    }
    cb(null, true);
  };
  return multer({
    storage,
    fileFilter,
    limits: { fileSize: getMaxFileSizeMB() * 1024 * 1024, files: getMaxFileCount() }
  });
}

function cleanupTempFiles(files) {
  for (const file of files || []) {
    try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
  }
}

// ==================== 接单 ====================

router.post('/accept', requireAnyPermission(['designer.hall.design', 'basic.hall.cs', 'assistant.hall.operator'], 'designer', 'basic_designer', 'operator_assistant'), async (req, res, next) => {
  try {
    const result = await taskService.acceptTask(req.body.taskId, req.user);
    res.json({ code: 0, ...result });
  } catch (err) { next(err); }
});

// ==================== 上传文件 ====================

router.post('/upload-original', requireAnyPermission(['task.upload.work'], 'basic_designer'), (req, res, next) => {
  createOriginalUploadMiddleware().array('files', getMaxFileCount())(req, res, async (err) => {
    if (err) {
      cleanupTempFiles(req.files);
      return res.json({ code: 400, msg: err.message });
    }
    try {
      const result = await taskService.uploadOriginalFiles(Number(req.body.taskId), req.files || [], req.user);
      res.json({ code: 0, ...result });
    } catch (error) {
      cleanupTempFiles(req.files);
      next(error);
    }
  });
});

router.post('/complete-original-upload', requireAnyPermission(['task.upload.work'], 'basic_designer'), async (req, res, next) => {
  try {
    const result = await taskService.completeOriginalUpload(Number(req.body.taskId), req.user);
    res.json({ code: 0, ...result });
  } catch (error) {
    next(error);
  }
});

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
        const uploadOptions = { replaceExisting, hasWorkPathField, saveOnly, rejectRecordId };
        if (Object.prototype.hasOwnProperty.call(req.body, 'retainedFileIds')) {
          uploadOptions.retainedFileIds = parseIdArray(req.body.retainedFileIds, '保留文件');
        }
        if (Object.prototype.hasOwnProperty.call(req.body, 'modificationReply')) {
          uploadOptions.modificationReply = req.body.modificationReply;
        }
        const result = await taskService.uploadFiles(taskId, req.files, fileCategory, actualQuantity, appliedScore, workPath, req.user, uploadOptions);
        res.json({ code: 0, ...result });
      } catch (err) {
        for (const file of req.files || []) {
          try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
        }
        next(err);
      }
    });
});

router.post('/request-modification', requireAnyPermission(['cs.review.basic', 'task.review.own', 'task.review.store', 'task.review.all'], 'cs_agent', 'admin'), (req, res, next) => {
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
  const cleanupTempFiles = () => {
    for (const file of req.files || []) {
      try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
    }
  };

  multer({ storage, fileFilter, limits: { fileSize: getMaxFileSizeMB() * 1024 * 1024, files: getMaxFileCount() } })
    .array('files', getMaxFileCount())(req, res, async (err) => {
      if (err) {
        cleanupTempFiles();
        return res.json({ code: 400, msg: err.message });
      }
      try {
        const result = await taskService.requestCsModification(
          parseInt(req.body.taskId),
          req.body.note,
          req.files || [],
          req.user
        );
        res.json({ code: 0, ...result });
      } catch (error) {
        cleanupTempFiles();
        next(error);
      }
    });
});

router.post('/complete-modification', requireAnyPermission(['task.upload.work'], 'basic_designer'), (req, res, next) => {
  const tmpDir = path.join(os.tmpdir(), 'd-design-tmp');
  try { fs.mkdirSync(tmpDir, { recursive: true }); } catch (_) {}

  const storage = multer.diskStorage({
    destination: (request, file, cb) => cb(null, tmpDir),
    filename: (request, file, cb) => {
      file.originalname = fixFilenameEncoding(file.originalname);
      cb(null, `${uuidv4().replace(/-/g, '')}${path.extname(file.originalname).toLowerCase()}`);
    }
  });
  const fileFilter = (request, file, cb) => {
    if (file.originalname.includes('..') || file.originalname.includes('/') || file.originalname.includes('\\')) {
      return cb(new Error('文件名不合法'), false);
    }
    cb(null, true);
  };
  const cleanupTempFiles = () => {
    for (const file of req.files || []) {
      try { if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path); } catch (_) {}
    }
  };

  multer({ storage, fileFilter, limits: { fileSize: getMaxFileSizeMB() * 1024 * 1024, files: getMaxFileCount() } })
    .array('files', getMaxFileCount())(req, res, async (err) => {
      if (err) {
        cleanupTempFiles();
        return res.json({ code: 400, msg: err.message });
      }
      try {
        const result = await taskService.completeCsModification(
          parseInt(req.body.taskId),
          parseInt(req.body.rejectRecordId),
          req.body.reply,
          req.body.appliedScore,
          parseIdArray(req.body.retainedFileIds, '保留文件'),
          req.files || [],
          req.user
        );
        res.json({ code: 0, ...result });
      } catch (error) {
        cleanupTempFiles();
        next(error);
      }
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
